"""End-to-end pipeline with mock providers — no credentials or network required."""
import json
import subprocess
import sys

import pytest

from safematch.models import PersonQuery
from safematch.orchestrator import PipelineError, Providers, build_mock_providers_from_file, run_pipeline, run_verifier
from safematch.utils.validation import validate_report
from tests.conftest import ROOT, SCENARIO_DIR, scenario


def test_full_pipeline_writes_all_stages(settings, tmp_path):
    sc = scenario("demo_mixed")
    p = build_mock_providers_from_file(SCENARIO_DIR / "demo_mixed.json")
    res = run_pipeline(PersonQuery.model_validate(sc["query"]), p, settings, tmp_path)
    for key in ("investigator_path", "verifier_path", "report_path"):
        assert (tmp_path / res[key].split("/")[-1]).exists()
    report = json.loads((tmp_path / "report.json").read_text())
    assert validate_report(report) == []
    assert report["report_metadata"]["is_test_fixture"] is True
    assert report["report_metadata"]["pipeline_mode"] == "mock"
    assert res["summary"]["verified_record_flag"] is True


def test_live_stage_refuses_mock_input(settings, tmp_path):
    sc = scenario("no_results")
    p = build_mock_providers_from_file(SCENARIO_DIR / "no_results.json")
    run_pipeline(PersonQuery.model_validate(sc["query"]), p, settings, tmp_path)
    from safematch.models import InvestigatorResult

    inv = InvestigatorResult.model_validate_json((tmp_path / "investigator.json").read_text())

    class FakeLive:
        name, is_mock = "claude_cli", False

        def run(self, task):  # pragma: no cover - must not be reached
            raise AssertionError("should not run")

    with pytest.raises(PipelineError, match="mock mode"):
        run_verifier(inv, Providers(llm=FakeLive()), settings)


def _cli(*args, cwd=ROOT):
    return subprocess.run([sys.executable, "-m", "safematch.cli", *args], cwd=cwd, capture_output=True, text=True, timeout=120)


def test_cli_stage_by_stage_and_validate(tmp_path):
    out = str(tmp_path)
    q = str(ROOT / "test_cases" / "example.json")
    r1 = _cli("investigator", "--mock", "--query-file", q, "--output-dir", out)
    assert r1.returncode == 0, r1.stderr
    r2 = _cli("verifier", "--mock", "--input", f"{out}/investigator.json", "--output-dir", out)
    assert r2.returncode == 0, r2.stderr
    r3 = _cli("synthesizer", "--mock", "--input", f"{out}/verifier.json", "--output-dir", out)
    assert r3.returncode == 0, r3.stderr
    r4 = _cli("validate-report", "--input", f"{out}/report.json")
    assert r4.returncode == 0 and "VALID" in r4.stdout


def test_cli_run_and_bad_inputs(tmp_path):
    q = str(ROOT / "test_cases" / "example.json")
    r = _cli("run", "--mock", "--query-file", q, "--output-dir", str(tmp_path), "--report-name", "custom.json")
    assert r.returncode == 0, r.stderr
    assert (tmp_path / "custom.json").exists()

    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"report_metadata": {}}))
    assert _cli("validate-report", "--input", str(bad)).returncode == 1
    assert _cli("run", "--mock", "--query-file", str(tmp_path / "missing.json")).returncode == 2
    assert _cli("--help").returncode == 0
