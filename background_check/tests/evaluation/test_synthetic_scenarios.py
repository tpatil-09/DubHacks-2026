"""Deterministic evaluation over synthetic scenarios (no network).

Each fixture under tests/fixtures/scenarios/ declares its expected outcome.
Several fixtures deliberately make the mock model OVER-CLAIM (e.g. 'verified'
on a name-only match) to prove the deterministic guards and rules hold.
"""
import pytest

from safematch.models import PersonQuery, RecordStage
from safematch.orchestrator import build_mock_providers_from_file, run_pipeline
from safematch.utils.validation import validate_report
from tests.conftest import SCENARIO_DIR, SCENARIOS, scenario

REQUIRED = {
    "verified_conviction", "same_name_unrelated", "unverified_accusation", "dismissed_charge",
    "conflicting_sources", "no_results", "inaccessible_registry", "search_provider_error",
}


def test_all_required_scenarios_exist():
    assert REQUIRED <= set(SCENARIOS)


@pytest.mark.parametrize("name", SCENARIOS)
def test_scenario(name, settings, tmp_path):
    sc = scenario(name)
    exp = sc["expected"]
    p = build_mock_providers_from_file(SCENARIO_DIR / f"{name}.json")
    res = run_pipeline(PersonQuery.model_validate(sc["query"]), p, settings, tmp_path)
    r = res["report"]
    data = r.model_dump(mode="json")

    assert validate_report(data) == []
    assert r.overall_status.value == exp["overall_status"]
    assert r.safety_indicators.verified_record_flag is exp["verified_record_flag"]
    assert len(r.verified_records) == exp["verified_records"]
    assert len(r.unresolved_findings) == exp["unresolved_findings"]
    assert len(r.contradicted_findings) == exp["contradicted_findings"]

    every = r.verified_records + r.unresolved_findings + r.contradicted_findings
    assert all(f.source_url.startswith("http") and f.finding_id for f in every)
    if "finding_status" in exp:
        assert every[0].evidence_status.value == exp["finding_status"]
    if "finding_identity" in exp:
        assert every[0].identity_match.value == exp["finding_identity"]
    if "finding_stage" in exp:
        assert every[0].record_stage.value == exp["finding_stage"]
    if "case_outcomes" in exp:
        assert len(r.case_outcomes) == exp["case_outcomes"]
    if exp.get("no_conviction_verified"):
        assert not any(f.record_stage == RecordStage.conviction for f in r.verified_records)
    if "limitation_contains" in exp:
        assert any(exp["limitation_contains"] in l for l in r.limitations)
    if not every:
        assert any("not evidence that a person has no record" in l for l in r.limitations)


@pytest.mark.parametrize("name", SCENARIOS)
def test_scenario_tldr(name, settings, tmp_path):
    sc = scenario(name)
    p = build_mock_providers_from_file(SCENARIO_DIR / f"{name}.json")
    r = run_pipeline(PersonQuery.model_validate(sc["query"]), p, settings, tmp_path)["report"]
    data = r.model_dump(mode="json")
    assert list(data)[0] == "tldr", "tldr must be the first field"
    assert r.tldr.record_tier.value == sc["expected"]["record_tier"]
    assert r.tldr.headline and r.tldr.caveats
