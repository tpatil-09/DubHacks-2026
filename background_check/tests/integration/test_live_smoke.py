"""LIVE smoke test of the Claude Code CLI provider (opt-in: `pytest -m live`)."""
from typing import List

import pytest
from pydantic import BaseModel

from safematch.orchestrator import build_live_providers
from safematch.providers.llm import AgentTask, complete_structured


class _Out(BaseModel):
    urls: List[str]


@pytest.mark.live
def test_claude_cli_structured_websearch(live_settings):
    llm = build_live_providers(live_settings).llm
    task = AgentTask(
        name="smoke",
        system_prompt="You are a research tool. Use WebSearch once and return JSON only.",
        user_prompt="Find the URL of ProPublica's 2019 article about Tinder and registered sex offenders. Return up to 2 URLs.",
        output_model=_Out,
        tools=["WebSearch"],
        timeout_seconds=240,
    )
    out = complete_structured(llm, task, max_retries=1)
    assert out.urls and all(u.startswith("http") for u in out.urls)
