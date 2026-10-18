from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

import pytest

from safematch.config import Settings, load_settings
from safematch.mock_scenarios import load_scenario

ROOT = Path(__file__).resolve().parents[1]
SCENARIO_DIR = ROOT / "tests" / "fixtures" / "scenarios"
SCENARIOS = sorted(p.stem for p in SCENARIO_DIR.glob("*.json"))


def pytest_collection_modifyitems(config, items):
    """Live tests run only with `pytest -m live` or RUN_LIVE=1."""
    markexpr = config.getoption("-m") or ""
    run_live = os.environ.get("RUN_LIVE") == "1" or ("live" in markexpr and "not live" not in markexpr)
    if run_live:
        return
    skip = pytest.mark.skip(reason="live test: run with `pytest -m live` (uses real Claude Code + web searches)")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(model_provider="mock", output_dir=tmp_path, llm_max_retries=2)


@pytest.fixture
def live_settings() -> Settings:
    return load_settings()


def scenario(name: str) -> Dict[str, Any]:
    return load_scenario(SCENARIO_DIR / f"{name}.json")
