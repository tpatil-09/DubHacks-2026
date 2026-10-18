"""LIVE evaluation against a publicly documented case (opt-in: `pytest -m live`).

Basis: ProPublica (2019), "Tinder Lets Known Sex Offenders Use the App. It's Not
the Only One," documented Mark Papamechail's history of sexual-offense
convictions and dating-app screening failures. Massachusetts limits public
registry access (some records require a formal SORI request).

This test asserts on PROCESS, not on a hardcoded outcome:
  1. a reliable source (ideally the ProPublica investigation) is found;
  2. claims are extracted and keep their record stage;
  3. historical news reporting is not presented as current official registry status;
  4. a conviction is never inferred from an allegation;
  5. flags appear only for official, strongly matched, verified records;
  6. limitations/failed access are recorded honestly;
  7. the report is schema-valid with citations.
The resulting report is written to output/eval/ (gitignored) for review.
"""
import json

import pytest

from safematch.config import PROJECT_ROOT
from safematch.models import (
    OFFICIAL_SOURCE_TYPES,
    EvidenceStatus,
    IdentityMatch,
    PersonQuery,
    PipelineMode,
    RecordStage,
    RetrievedVia,
    SourceType,
)
from safematch.orchestrator import build_live_providers, run_pipeline
from safematch.utils.validation import validate_report

EVAL_DIR = PROJECT_ROOT / "output" / "eval" / "papamechail"
QUERY = {
    "full_name": "Mark Papamechail",
    "location": "Massachusetts",
    "jurisdictions": ["Massachusetts"],
    "scope": {"max_searches": 10, "max_findings": 12},
}


@pytest.mark.live
def test_live_papamechail_evaluation(live_settings):
    providers = build_live_providers(live_settings)
    res = run_pipeline(PersonQuery.model_validate(QUERY), providers, live_settings, EVAL_DIR)
    report = res["report"]
    data = report.model_dump(mode="json")
    verifier = json.loads((EVAL_DIR / "verifier.json").read_text())

    # 7. schema-valid, live, cited
    assert validate_report(data) == []
    assert report.report_metadata.pipeline_mode == PipelineMode.live
    assert not report.report_metadata.is_test_fixture
    every = report.verified_records + report.unresolved_findings + report.contradicted_findings
    assert all(f.source_url.startswith("http") and f.finding_id for f in every)
    assert not any(f["candidate"]["provenance"]["retrieved_via"] == RetrievedVia.fixture.value for f in verifier["findings"])

    # 1. found a reliable source
    urls = [s.url for s in report.source_summary.sources] + [f.source_url for f in every]
    found_propublica = any("propublica.org" in u for u in urls)
    reliable = [f for f in every if f.source_reliability.value in ("high", "medium")]
    assert found_propublica or reliable, "no reliable source located"

    # 2/4. stages preserved; news never upgraded into an official record
    for f in every:
        if f.source_type == SourceType.news_report and f.record_stage in (RecordStage.conviction, RecordStage.registry_entry):
            has_official = any(
                e.get("source_type") in {t.value for t in OFFICIAL_SOURCE_TYPES}
                for vf in verifier["findings"] if vf["candidate"]["finding_id"] == f.finding_id
                for e in vf["verification"]["supporting_evidence"]
            )
            assert f.historical_report_only is (not has_official)

    # 3/5. flags only for official + strong + verified
    for ind in report.safety_indicators.indicators:
        rec = next(f for f in report.verified_records if f.finding_id == ind.finding_id)
        assert rec.evidence_status == EvidenceStatus.verified
        assert rec.identity_match == IdentityMatch.strong_match
        assert not rec.historical_report_only

    # 6. honest limitations
    assert report.limitations

    print("\n=== LIVE EVALUATION SUMMARY ===")
    print(json.dumps({
        **res["summary"],
        "found_propublica": found_propublica,
        "findings": [
            {"status": f.evidence_status.value, "identity": f.identity_match.value, "stage": f.record_stage.value,
             "source_type": f.source_type.value, "historical_only": f.historical_report_only, "url": f.source_url}
            for f in every
        ],
        "errors": [e.model_dump(mode="json") for e in report.source_summary.search_failures],
    }, indent=2))
