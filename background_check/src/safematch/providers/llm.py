"""LLM providers.

``ClaudeCLIProvider`` runs each agent as a headless Claude Code session via the
documented ``claude -p`` interface, authenticated by ``CLAUDE_CODE_OAUTH_TOKEN``.
The token is passed only to the local ``claude`` subprocess environment.

Hardening for every session:
  * ``--tools`` restricts the built-in tool set to an explicit allowlist
    (WebSearch/WebFetch for research agents, nothing for the Synthesizer), so
    prompt-injected web content cannot reach Bash, file edits, or sub-agents.
  * ``--strict-mcp-config`` loads no MCP servers; ``--setting-sources ""`` skips
    user/project settings and hooks; ``--no-session-persistence``.
  * Runs in an empty temporary working directory with a minimal environment
    (``ANTHROPIC_API_KEY`` is never forwarded).
  * ``--json-schema`` requests structured output, which is then re-validated
    with Pydantic and retried a bounded number of times.
"""
from __future__ import annotations

import copy
import json
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, Type, TypeVar, Union

from pydantic import BaseModel, ValidationError

from ..utils.logging_utils import get_logger, scrub

log = get_logger("llm")
T = TypeVar("T", bound=BaseModel)

RESEARCH_TOOLS = ["WebSearch", "WebFetch"]
_UNSUPPORTED_SCHEMA_KEYS = {"default", "title", "maxLength", "minLength", "maxItems", "minItems", "maximum", "minimum"}


class LLMError(RuntimeError):
    """An agent session failed or returned output that could not be validated."""


@dataclass
class AgentTask:
    name: str  # "investigator" | "verifier" | "synthesizer"
    system_prompt: str
    user_prompt: str
    output_model: Type[BaseModel]
    tools: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)  # structured inputs (used by mocks/tests)
    timeout_seconds: Optional[int] = None


class LLMProvider(Protocol):
    name: str
    is_mock: bool

    def run(self, task: AgentTask) -> Dict[str, Any]:
        """Execute one agent session and return its raw JSON object output."""


def inline_json_schema(model: Type[BaseModel]) -> Dict[str, Any]:
    """Pydantic JSON schema with ``$ref``s inlined and unsupported keywords dropped."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return resolve(copy.deepcopy(defs[node["$ref"].split("/")[-1]]))
            return {k: resolve(v) for k, v in node.items() if k not in _UNSUPPORTED_SCHEMA_KEYS}
        if isinstance(node, list):
            return [resolve(x) for x in node]
        return node

    return resolve(schema)


def extract_json_object(text: str) -> Dict[str, Any]:
    """Parse a JSON object from model text, tolerating ```json fences or surrounding prose."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise LLMError("model output contained no JSON object")
        try:
            obj = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMError(f"model output was not valid JSON: {exc.msg}") from exc
    if not isinstance(obj, dict):
        raise LLMError("model output JSON was not an object")
    return obj


Runner = Callable[..., subprocess.CompletedProcess]


class ClaudeCLIProvider:
    name = "claude_cli"
    is_mock = False

    def __init__(
        self,
        oauth_token: str,
        cli_path: str = "claude",
        model: Optional[str] = None,
        timeout_seconds: int = 600,
        runner: Optional[Runner] = None,
    ) -> None:
        if not oauth_token:
            raise LLMError("CLAUDE_CODE_OAUTH_TOKEN is required for the claude_cli provider")
        self._token = oauth_token
        self.cli_path = cli_path
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._runner = runner or subprocess.run

    def build_command(self, task: AgentTask) -> List[str]:
        cmd = [
            self.cli_path,
            "-p",
            "--output-format", "json",
            "--no-session-persistence",
            "--strict-mcp-config",
            "--setting-sources", "",  # ignore user/project/local settings, hooks and plugins
            "--permission-mode", "dontAsk",
            "--tools", ",".join(task.tools),
            "--system-prompt", task.system_prompt,
            "--json-schema", json.dumps(inline_json_schema(task.output_model)),
        ]
        if task.tools:
            cmd += ["--allowedTools", ",".join(task.tools)]
        if self.model:
            cmd += ["--model", self.model]
        return cmd

    def build_env(self) -> Dict[str, str]:
        env = {k: os.environ[k] for k in ("PATH", "HOME", "USER", "LANG", "TMPDIR") if k in os.environ}
        env["CLAUDE_CODE_OAUTH_TOKEN"] = self._token
        return env  # deliberately excludes ANTHROPIC_API_KEY and every other secret

    def run(self, task: AgentTask) -> Dict[str, Any]:
        workdir = tempfile.mkdtemp(prefix=f"safematch-{task.name}-")
        timeout = task.timeout_seconds or self.timeout_seconds
        log.info("starting Claude Code session for %s (tools=%s, timeout=%ss)", task.name, task.tools or "none", timeout)
        try:
            proc = self._runner(
                self.build_command(task),
                input=task.user_prompt,
                capture_output=True,
                text=True,
                env=self.build_env(),
                cwd=workdir,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise LLMError(f"{task.name} session timed out after {timeout}s") from None
        except FileNotFoundError:
            raise LLMError(f"Claude Code CLI not found at '{self.cli_path}'") from None
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

        if not proc.stdout.strip():
            raise LLMError(f"{task.name} session produced no output (exit {proc.returncode}): {scrub(proc.stderr)[:300]}")
        try:
            envelope = json.loads(proc.stdout)
        except json.JSONDecodeError:
            raise LLMError(f"{task.name} session returned non-JSON envelope: {scrub(proc.stdout)[:300]}") from None
        if envelope.get("is_error"):
            raise LLMError(f"{task.name} session error: {scrub(str(envelope.get('result')))[:300]}")
        log.info(
            "%s session finished: turns=%s duration=%.0fs",
            task.name, envelope.get("num_turns"), (envelope.get("duration_ms") or 0) / 1000,
        )
        structured = envelope.get("structured_output")
        if isinstance(structured, dict):
            return structured
        return extract_json_object(str(envelope.get("result") or ""))


Responder = Union[Dict[str, Any], Callable[[AgentTask], Dict[str, Any]], Exception, List[Any]]


class MockLLMProvider:
    """Deterministic provider for tests and ``--mock`` runs. Makes no network calls.

    ``responses`` maps an agent name to a dict, a callable(task) -> dict, an
    Exception to raise, or a list of those consumed in order (for retry tests).
    """

    name = "mock"
    is_mock = True

    def __init__(self, responses: Dict[str, Responder]) -> None:
        self._responses = {k: (list(v) if isinstance(v, list) else v) for k, v in responses.items()}
        self.calls: List[AgentTask] = []

    def run(self, task: AgentTask) -> Dict[str, Any]:
        self.calls.append(task)
        if task.name not in self._responses:
            raise LLMError(f"mock provider has no response for agent '{task.name}'")
        resp = self._responses[task.name]
        if isinstance(resp, list):
            if not resp:
                raise LLMError(f"mock provider exhausted responses for '{task.name}'")
            resp = resp.pop(0)
        if isinstance(resp, Exception):
            raise resp
        if callable(resp):
            resp = resp(task)
        return copy.deepcopy(resp)


def complete_structured(provider: LLMProvider, task: AgentTask, max_retries: int = 2) -> T:
    """Run ``task`` and validate its output against ``task.output_model``.

    Validation failures are fed back to the model and retried up to
    ``max_retries`` times; afterwards an :class:`LLMError` is raised.
    Provider/session errors are retried the same way.
    """
    last_error = ""
    base_prompt = task.user_prompt
    for attempt in range(max_retries + 1):
        if attempt:
            task.user_prompt = (
                f"{base_prompt}\n\nYour previous response was rejected: {last_error[:600]}\n"
                "Return ONLY a JSON object that matches the required schema."
            )
        try:
            raw = provider.run(task)
            return task.output_model.model_validate(raw)  # type: ignore[return-value]
        except ValidationError as exc:
            last_error = f"schema validation failed: {exc.error_count()} error(s): " + "; ".join(
                f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()[:8]
            )
        except LLMError as exc:
            last_error = str(exc)
        log.warning("%s attempt %d/%d failed: %s", task.name, attempt + 1, max_retries + 1, scrub(last_error)[:300])
    task.user_prompt = base_prompt
    raise LLMError(f"{task.name} failed after {max_retries + 1} attempt(s): {scrub(last_error)[:500]}")
