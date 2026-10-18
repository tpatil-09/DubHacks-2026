import json

import pytest
from pydantic import ValidationError

from safematch.config import ConfigError, Settings, load_settings
from safematch.models import REPORT_TOP_LEVEL_KEYS, PersonQuery, make_finding_id
from safematch.utils.validation import SCHEMA_PATH, generate_report_schema, validate_report, write_json_atomic


def test_finding_id_is_stable_and_case_insensitive_on_claim():
    assert make_finding_id("https://a.example/x", "Claim") == make_finding_id("https://a.example/x", "claim ")
    assert make_finding_id("https://a.example/x", "a") != make_finding_id("https://a.example/y", "a")


def test_query_requires_two_part_name_and_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        PersonQuery(full_name="Madonna")
    with pytest.raises(ValidationError):
        PersonQuery.model_validate({"full_name": "Jane Example", "date_of_birth": "1990-01-01"})
    with pytest.raises(ValidationError):
        PersonQuery(full_name="Jane Example", age_min=40, age_max=30)
    assert PersonQuery(full_name="  Jane   Example ").full_name == "Jane Example"


def test_committed_schema_matches_models():
    committed = json.loads(SCHEMA_PATH.read_text())
    assert committed == generate_report_schema(), "run `python -m safematch.cli export-schema`"
    assert committed["required"] == REPORT_TOP_LEVEL_KEYS
    assert committed["properties"]["overall_status"]["$ref"].endswith("OverallStatus")


def test_validate_report_rejects_malformed():
    errs = validate_report({"report_metadata": {}})
    assert errs and any("required" in e for e in errs)


def test_atomic_write(tmp_path):
    p = write_json_atomic(tmp_path / "x" / "r.json", {"a": 1})
    assert json.loads(p.read_text()) == {"a": 1}
    assert [f.name for f in p.parent.iterdir()] == ["r.json"]


def test_settings_strip_whitespace_and_hide_secrets(monkeypatch):
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "  sk-ant-oat01-SECRETVALUE123  ")
    s = load_settings(read_env_files=False)
    assert s.claude_code_oauth_token == "sk-ant-oat01-SECRETVALUE123"
    assert "SECRETVALUE" not in repr(s)


def test_settings_validation(monkeypatch):
    monkeypatch.setenv("MODEL_PROVIDER", "anthropic")
    with pytest.raises(ConfigError):
        load_settings(read_env_files=False)
    with pytest.raises(ConfigError) as ei:
        Settings(model_provider="claude_cli", claude_code_oauth_token=None).require_live_credentials()
    assert "--mock" in str(ei.value)
