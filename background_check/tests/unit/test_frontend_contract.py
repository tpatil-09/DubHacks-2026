"""report.json must match the frontend contract (claude.md section 7 / web/src/types/safetyReport.ts)."""
import pytest

from safematch.frontend_contract import REQUIRED_NOTICE, case_status, to_frontend_report, validate_frontend_report
from safematch.models import PersonQuery, RecordStage
from safematch.orchestrator import build_mock_providers_from_file, run_pipeline
from tests.conftest import SCENARIO_DIR, SCENARIOS, scenario


def _frontend(name, settings, tmp_path):
    sc = scenario(name)
    p = build_mock_providers_from_file(SCENARIO_DIR / f"{name}.json")
    report = run_pipeline(PersonQuery.model_validate(sc["query"]), p, settings, tmp_path)["report"]
    return report, to_frontend_report(report)


@pytest.mark.parametrize("name", SCENARIOS)
def test_every_scenario_produces_a_valid_frontend_report(name, settings, tmp_path):
    report, fe = _frontend(name, settings, tmp_path)
    assert validate_frontend_report(fe) == []
    assert list(fe)[0] == "tldr"
    assert fe["human_review_required"] is True and fe["is_synthetic"] is True
    assert fe["limitations"][0] == REQUIRED_NOTICE
    assert fe["summary"].startswith(report.tldr.tier_label)
    by_id = {f.finding_id: f for f in report.verified_records + report.unresolved_findings + report.contradicted_findings}
    for f in fe["findings"]:
        src = by_id[f["finding_id"]]
        # Never show a conviction the pipeline did not establish as a conviction stage.
        if f["case_status"] in ("conviction", "guilty_plea"):
            assert src.record_stage == RecordStage.conviction
        assert src.identity_match.value != "mismatch"
        assert src.evidence_status.value != "contradicted"


def test_other_people_and_contradicted_claims_are_excluded_and_counted(settings, tmp_path):
    _, fe = _frontend("demo_mixed", settings, tmp_path)
    assert len(fe["findings"]) == 2  # flagged conviction + unverified allegation; the same-name record is excluded
    assert any("other people with the same or a similar name were excluded" in l for l in fe["limitations"])


def test_partial_search_is_marked_incomplete(settings, tmp_path):
    _, fe = _frontend("search_provider_error", settings, tmp_path)
    assert fe["scope"]["search_completed"] is False and fe["errors"]


def test_exonerated_conviction_is_never_a_conviction(settings, tmp_path):
    report, fe = _frontend("exonerated", settings, tmp_path)
    assert [f["case_status"] for f in fe["findings"]] == ["unknown"] or all(
        f["case_status"] in ("dismissed", "unknown") for f in fe["findings"]
    )
    rf = report.verified_records[0].model_copy(update={"disposition": "Conviction vacated and indictment dismissed"})
    assert case_status(rf) == "dismissed"


def test_rejects_bad_enum():
    bad = {"schema_version": "1.0", "report_id": "r", "generated_at": "2026-10-17T00:00:00+00:00",
           "subject": {"name_provided": "x"}, "scope": {"sources_searched": [], "sources_not_accessible": [], "search_completed": True},
           "summary": "s", "findings": [{"finding_id": "f", "description": "d", "record_type": "criminal_case",
                                         "case_status": "vacated", "identity_assessment": "mismatch", "identity_rationale": "",
                                         "event_date": None, "jurisdiction": None, "source_url": "https://a.example/x",
                                         "source_title": "t", "source_type": "news_report", "retrieved_at": "2026-10-17T00:00:00+00:00",
                                         "conflicts": [], "limitations": []}],
           "limitations": [], "errors": [], "human_review_required": True}
    errs = validate_frontend_report(bad)
    assert any("case_status" in e for e in errs) and any("identity_assessment" in e for e in errs)
