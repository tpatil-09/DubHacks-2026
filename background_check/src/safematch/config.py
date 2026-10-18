"""Environment-driven settings.

Resolution order (first wins): process environment → ``background_check/.env``
→ repo-root ``.env`` (read-only). Values are whitespace-stripped. Secrets are
held in :class:`Settings` but excluded from its ``repr`` and never logged.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

from dotenv import dotenv_values

PROJECT_ROOT = Path(__file__).resolve().parents[2]  # background_check/
SECRET_KEYS = ("CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY",
               "COURTLISTENER_API_TOKEN")
RECORDS_PROVIDER_NAMES = ("courtlistener",)

MODEL_PROVIDERS = ("claude_cli", "mock")
SEARCH_PROVIDERS = ("none", "tavily")


class ConfigError(ValueError):
    """Raised for missing or invalid configuration (never includes secret values)."""


def _load_env_files() -> Dict[str, str]:
    merged: Dict[str, str] = {}
    for path in (PROJECT_ROOT.parent / ".env", PROJECT_ROOT / ".env"):  # later overrides earlier
        if path.is_file():
            for k, v in dotenv_values(path).items():
                if v is not None:
                    merged[k.strip()] = v.strip()
    return merged


@dataclass(frozen=True)
class Settings:
    model_provider: str = "claude_cli"
    model_name: Optional[str] = None
    search_provider: str = "none"
    output_dir: Path = PROJECT_ROOT / "output"
    agent_timeout_seconds: int = 1200
    llm_max_retries: int = 2
    verify_excerpts_with_fetch: bool = True
    claude_cli_path: str = "claude"
    claude_code_oauth_token: Optional[str] = field(default=None, repr=False)
    tavily_api_key: Optional[str] = field(default=None, repr=False)
    # Official-records APIs. CourtListener works without a token at a low rate limit.
    records_providers: tuple = ("courtlistener",)
    courtlistener_api_token: Optional[str] = field(default=None, repr=False)

    def require_live_credentials(self) -> None:
        if self.model_provider == "claude_cli" and not self.claude_code_oauth_token:
            raise ConfigError(
                "CLAUDE_CODE_OAUTH_TOKEN is not set. Run `claude setup-token` and add it to .env, "
                "or use --mock for fixture-only runs."
            )
        if self.search_provider == "tavily" and not self.tavily_api_key:
            raise ConfigError("SEARCH_PROVIDER=tavily but TAVILY_API_KEY is not set")

    def secret_values(self) -> list:
        return [s for s in (self.claude_code_oauth_token, self.tavily_api_key, self.courtlistener_api_token) if s]


def load_settings(overrides: Optional[Dict[str, str]] = None, read_env_files: bool = True) -> Settings:
    env: Dict[str, str] = _load_env_files() if read_env_files else {}
    env.update({k: v.strip() for k, v in os.environ.items()})
    env.update(overrides or {})

    def get(key: str, default: Optional[str] = None) -> Optional[str]:
        val = env.get(key, "")
        return val.strip() if val and val.strip() else default

    model_provider = (get("MODEL_PROVIDER", "claude_cli") or "claude_cli").lower()
    if model_provider == "anthropic":  # documented alias from the original spec; not supported here
        raise ConfigError(
            "MODEL_PROVIDER=anthropic is not implemented; this project uses the Claude Code CLI (claude_cli)."
        )
    if model_provider not in MODEL_PROVIDERS:
        raise ConfigError(f"MODEL_PROVIDER must be one of {MODEL_PROVIDERS}")
    search_provider = (get("SEARCH_PROVIDER", "none") or "none").lower()
    if search_provider not in SEARCH_PROVIDERS:
        raise ConfigError(f"SEARCH_PROVIDER must be one of {SEARCH_PROVIDERS}")

    out = Path(get("OUTPUT_DIR", "./output") or "./output")
    if not out.is_absolute():
        out = (PROJECT_ROOT / out).resolve()

    try:
        timeout = int(get("AGENT_TIMEOUT_SECONDS", "1200") or 1200)
    except ValueError as exc:
        raise ConfigError("AGENT_TIMEOUT_SECONDS must be an integer") from exc

    raw_records = (get("RECORDS_PROVIDERS", "courtlistener") or "").lower()
    records_providers = tuple(x.strip() for x in raw_records.split(",") if x.strip() and x.strip() != "none")
    unknown = [x for x in records_providers if x not in RECORDS_PROVIDER_NAMES]
    if unknown:
        raise ConfigError(f"Unknown RECORDS_PROVIDERS entries {unknown}; use {RECORDS_PROVIDER_NAMES} or none")

    return Settings(
        model_provider=model_provider,
        model_name=get("MODEL_NAME"),
        search_provider=search_provider,
        output_dir=out,
        agent_timeout_seconds=timeout,
        verify_excerpts_with_fetch=(get("VERIFY_EXCERPTS_WITH_FETCH", "true") or "true").lower() != "false",
        claude_cli_path=get("CLAUDE_CLI_PATH", "claude") or "claude",
        claude_code_oauth_token=get("CLAUDE_CODE_OAUTH_TOKEN"),
        tavily_api_key=get("TAVILY_API_KEY"),
        records_providers=records_providers,
        courtlistener_api_token=get("COURTLISTENER_API_TOKEN"),
    )
