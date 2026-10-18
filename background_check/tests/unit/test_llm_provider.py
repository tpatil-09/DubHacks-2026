import json
import logging
import subprocess

import pytest

from safematch.agents.investigator import InvestigatorLLMOutput
from safematch.providers.llm import (
    AgentTask,
    ClaudeCLIProvider,
    LLMError,
    MockLLMProvider,
    complete_structured,
    extract_json_object,
    inline_json_schema,
)
from safematch.utils.logging_utils import SecretScrubber, register_secrets, scrub

TOKEN = "sk-ant-oat01-TESTTOKENVALUE-abcdefgh"


def _task(tools=("WebSearch", "WebFetch")):
    return AgentTask(name="investigator", system_prompt="sys", user_prompt="go", output_model=InvestigatorLLMOutput, tools=list(tools))


class FakeRunner:
    def __init__(self, stdout, returncode=0):
        self.stdout, self.returncode, self.calls = stdout, returncode, []

    def __call__(self, cmd, **kw):
        self.calls.append((cmd, kw))
        return subprocess.CompletedProcess(cmd, self.returncode, stdout=self.stdout, stderr="")


def test_command_restricts_tools_and_env(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-api-SHOULD-NOT-LEAK")
    runner = FakeRunner(json.dumps({"is_error": False, "structured_output": {"findings": []}}))
    p = ClaudeCLIProvider(TOKEN, runner=runner, model="sonnet")
    assert p.run(_task()) == {"findings": []}
    cmd, kw = runner.calls[0]
    assert cmd[cmd.index("--tools") + 1] == "WebSearch,WebFetch"
    assert "--strict-mcp-config" in cmd and "--no-session-persistence" in cmd
    assert cmd[cmd.index("--model") + 1] == "sonnet"
    assert "ANTHROPIC_API_KEY" not in kw["env"] and kw["env"]["CLAUDE_CODE_OAUTH_TOKEN"] == TOKEN
    assert kw["input"] == "go"
    assert TOKEN not in " ".join(cmd)


def test_synthesizer_style_task_has_no_tools():
    runner = FakeRunner(json.dumps({"is_error": False, "result": '```json\n{"findings": []}\n```'}))
    ClaudeCLIProvider(TOKEN, runner=runner).run(_task(tools=()))
    cmd = runner.calls[0][0]
    assert cmd[cmd.index("--tools") + 1] == "" and "--allowedTools" not in cmd


def test_error_envelope_is_scrubbed():
    register_secrets([TOKEN])
    runner = FakeRunner(json.dumps({"is_error": True, "result": f"bad token {TOKEN}"}))
    with pytest.raises(LLMError) as ei:
        ClaudeCLIProvider(TOKEN, runner=runner).run(_task())
    assert TOKEN not in str(ei.value)


def test_timeout_raises_llm_error():
    def runner(cmd, **kw):
        raise subprocess.TimeoutExpired(cmd, 1)

    with pytest.raises(LLMError, match="timed out"):
        ClaudeCLIProvider(TOKEN, runner=runner).run(_task())


def test_inline_schema_has_no_refs():
    s = json.dumps(inline_json_schema(InvestigatorLLMOutput))
    assert "$ref" not in s and "$defs" not in s


def test_extract_json_object_variants():
    assert extract_json_object('prose {"a": 1} more') == {"a": 1}
    with pytest.raises(LLMError):
        extract_json_object("no json here")


def test_complete_structured_gives_up_after_retries():
    llm = MockLLMProvider({"investigator": [{"findings": 1}, {"findings": 2}, {"findings": 3}]})
    with pytest.raises(LLMError, match="3 attempt"):
        complete_structured(llm, _task(), max_retries=2)


def test_scrubber_redacts_token_patterns(caplog):
    assert "sk-ant-" not in scrub("token sk-ant-oat01-zzzzzzzzzzzzzzzz end")
    assert "tvly-" not in scrub("key tvly-abcdefghijklmnop")
    rec = logging.LogRecord("safematch.x", logging.INFO, __file__, 1, "auth %s", (TOKEN,), None)
    SecretScrubber().filter(rec)
    assert TOKEN not in rec.getMessage()
