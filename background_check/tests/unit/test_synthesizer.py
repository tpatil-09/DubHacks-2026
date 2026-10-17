from safematch.agents.synthesizer import Synthesizer, summary_is_acceptable, template_summary
from safematch.models import (
    REPORT_TOP_LEVEL_KEYS,
    OverallStatus,
    PipelineMode,
    RetrievedVia,
    VerifiedFinding,
    VerifierResult,
)
from safematch.providers.llm import LLMError, MockLLMProvider
from safematch.utils.validation import validate_report
from tests.factories import candidate, query, verification


def _vr(*pairs, mode=PipelineMode.mock, errors=()):
    q = query()
    return VerifierResult(
        mode=mode, query=q, search_scope=q.scope,
        findings=[VerifiedFinding(candidate=c, verification=v) for c, v in pairs],
        retrieval_errors=list(errors),
    )


def _pair(**v_kw):
    c = candidate(retrieved_via=RetrievedVia.fixture, claim=f"claim {sorted(v_kw.items())}")
    return c, verification(c, **v_kw)


def test_empty_report_has_full_schema_and_no_clean_claim():
    r = Synthesizer(None).run(_vr())
    data = r.model_dump(mode="json")
    assert list(data.keys()) == REPORT_TOP_LEVEL_KEYS
    assert r.overall_status == OverallStatus.no_relevant_records_found_in_scope
    assert any("not evidence that a person has no record" in l for l in r.limitations)
    assert validate_report(data) == []


def test_bucketing_and_flag():
    flagged = _pair()
    unverified = _pair(evidence_status="unverified", identity_match="weak_match")
    contradicted = _pair(evidence_status="contradicted", identity_match="mismatch")
    r = Synthesizer(None).run(_vr(flagged, unverified, contradicted))
    assert len(r.verified_records) == 1 and len(r.unresolved_findings) == 1 and len(r.contradicted_findings) == 1
    assert r.safety_indicators.verified_record_flag and r.overall_status == OverallStatus.records_require_attention
    assert r.identity_assessment.distinct_individuals_suspected
    for f in r.verified_records + r.unresolved_findings + r.contradicted_findings:
        assert f.finding_id and f.source_url


def test_live_mode_fixture_evidence_never_flags():
    r = Synthesizer(None).run(_vr(_pair(), mode=PipelineMode.live))
    assert not r.safety_indicators.verified_record_flag


def test_news_conviction_is_historical_report_only():
    c = candidate(source_type="news_report", retrieved_via=RetrievedVia.fixture)
    v = verification(c, supporting_evidence=[{"url": c.source_url, "source_type": "news_report"}])
    r = Synthesizer(None).run(_vr((c, v)))
    assert r.verified_records[0].historical_report_only
    assert not r.safety_indicators.verified_record_flag


def test_bad_llm_summaries_replaced_by_templates():
    c, v = _pair(evidence_status="unverified", identity_match="weak_match", record_stage="allegation")
    bad = "This person is dangerous and was convicted. See https://x.example"
    llm = MockLLMProvider({"synthesizer": {"summaries": [{"finding_id": c.finding_id, "summary": bad}]}})
    r = Synthesizer(llm).run(_vr((c, v)))
    f = r.unresolved_findings[0]
    assert f.summary == f"{f.why_unresolved} {template_summary(VerifiedFinding(candidate=c, verification=v))}"
    assert "dangerous" not in f.summary


def test_summary_failure_falls_back_with_limitation():
    llm = MockLLMProvider({"synthesizer": [LLMError("x")] * 3})
    r = Synthesizer(llm).run(_vr(_pair()))
    assert r.verified_records[0].summary
    assert any("templates" in l for l in r.limitations)


def test_summary_checks():
    c, v = _pair(evidence_status="unverified", record_stage="charge")
    vf = VerifiedFinding(candidate=c, verification=v)
    assert not summary_is_acceptable("Verified record of a charge.", vf)
    assert not summary_is_acceptable("They were convicted.", vf)
    assert summary_is_acceptable("An unverified report of a charge; no conviction was found.", vf)
    assert not summary_is_acceptable("They are clearly guilty of the charge.", vf)
    assert not summary_is_acceptable("They were found guilty of the charge.", vf)


def test_not_guilty_wording_is_allowed_for_acquittals():
    # Regression from the live evaluation: "found not guilty" was wrongly rejected as a banned term.
    c, v = _pair(evidence_status="verified", record_stage="acquitted")
    vf = VerifiedFinding(candidate=c, verification=v)
    assert summary_is_acceptable("A news report states a jury found them not guilty in 2016.", vf)


# ------------------------------------------------------------------ TLDR / tier

from safematch.agents.synthesizer import compute_tier, tldr_rejection_reason  # noqa: E402
from safematch.models import RecordTier  # noqa: E402


def test_tier_cleared_when_only_exculpatory_outcomes():
    vr = _vr(_pair(record_stage="vacated"), _pair(record_stage="dismissed", identity_match="possible_match"))
    assert compute_tier(vr, flagged=False) == RecordTier.cleared_outcomes_only


def test_tier_charge_cleared_by_its_own_outcome():
    vr = _vr(_pair(record_stage="charge", case_outcome="All charges dismissed in 2025"))
    assert compute_tier(vr, flagged=False) == RecordTier.cleared_outcomes_only


def test_tier_open_charge_is_unresolved():
    vr = _vr(_pair(record_stage="charge"), _pair(record_stage="dismissed"))
    assert compute_tier(vr, flagged=False) == RecordTier.unresolved_allegations_or_charges


def test_tier_reported_conviction_and_flag_precedence():
    vr = _vr(_pair(record_stage="conviction", evidence_status="unverified", identity_match="possible_match"))
    assert compute_tier(vr, flagged=False) == RecordTier.reported_conviction_unconfirmed
    assert compute_tier(vr, flagged=True) == RecordTier.verified_record_requires_attention


def test_tier_ignores_other_people_and_unknown_when_known_exists():
    other = _pair(record_stage="conviction", identity_match="mismatch", evidence_status="contradicted")
    unknown = _pair(record_stage="unknown")
    vacated = _pair(record_stage="vacated")
    assert compute_tier(_vr(other), flagged=False) == RecordTier.no_linked_records
    assert compute_tier(_vr(other, unknown, vacated), flagged=False) == RecordTier.cleared_outcomes_only


def test_tldr_headline_checks():
    cleared = RecordTier.cleared_outcomes_only
    assert tldr_rejection_reason("He was convicted in 1992 but exonerated in 2018; the convictions were vacated.", cleared) is None
    assert tldr_rejection_reason("He was convicted of rape in 1992.", cleared)
    assert tldr_rejection_reason("Verified conviction found.", RecordTier.reported_conviction_unconfirmed)
    assert tldr_rejection_reason("No records were linked to this person.", RecordTier.no_linked_records) is None
    assert tldr_rejection_reason("He is a dangerous man.", RecordTier.unresolved_allegations_or_charges)


def test_tldr_points_never_cite_contradicted_findings():
    linked = _pair(record_stage="vacated")
    fake = _pair(record_stage="conviction", evidence_status="contradicted", identity_match="inconclusive")
    lc, fc = linked[0].finding_id, fake[0].finding_id
    llm = MockLLMProvider({"synthesizer": {"summaries": [], "tldr_headline": "He was exonerated and the conviction was vacated.",
                                           "tldr_points": [{"text": "A reported murder conviction was contradicted.", "finding_ids": [fc]},
                                                           {"text": "His conviction was vacated after exoneration.", "finding_ids": [lc]}]}})
    r = Synthesizer(llm).run(_vr(linked, fake))
    cited = {i for p in r.tldr.key_points for i in p.finding_ids}
    assert fc not in cited and lc in cited


def test_identity_context_source_is_not_an_allegation():
    # Regression from a live run: a college roster (no stage, no offense) was the only linked source.
    roster = _pair(record_stage="unknown", offense_category="unknown", evidence_status="unverified", identity_match="possible_match")
    assert compute_tier(_vr(roster), flagged=False) == RecordTier.no_linked_records
    serious_unknown = _pair(record_stage="unknown", offense_category="sexual_offense", identity_match="possible_match")
    assert compute_tier(_vr(serious_unknown), flagged=False) == RecordTier.unresolved_allegations_or_charges


# ------------------------------------------------------------- why_unresolved

from safematch.agents.synthesizer import why_unresolved  # noqa: E402


def test_why_unresolved_leads_unresolved_summaries():
    c = candidate(source_type="news_report", retrieved_via=RetrievedVia.fixture, claim="news conviction")
    v = verification(c, evidence_status="unverified", identity_match="weak_match", identity_basis=["full_name"],
                     supporting_evidence=[{"url": c.source_url, "source_type": "news_report"}])
    vf = VerifiedFinding(candidate=c, verification=v)
    reason = why_unresolved(vf)
    assert reason == "Current official status was not confirmed, and the match is by name only, so it may be a different person."
    r = Synthesizer(None).run(_vr((c, v)))
    f = r.unresolved_findings[0]
    assert f.why_unresolved == reason and f.summary.startswith(reason)


def test_why_unresolved_snippet_and_open_charge():
    c = candidate(source_type="secondary_source", record_stage="charge", retrieved_via=RetrievedVia.fixture, claim="snippet charge")
    v = verification(c, evidence_status="unverified", identity_match="possible_match", record_stage="charge",
                     identity_basis=["full_name", "location"], source_accessible=False, supporting_evidence=[])
    reason = why_unresolved(VerifiedFinding(candidate=c, verification=v))
    assert reason.startswith("Current official status was not confirmed, details come only from a search snippet")
    assert "no final outcome was found" in reason and reason.endswith("so it may be a different person.")


def test_verified_and_contradicted_have_no_why_unresolved():
    r = Synthesizer(None).run(_vr(_pair(), _pair(evidence_status="contradicted", identity_match="mismatch")))
    assert r.verified_records[0].why_unresolved is None and r.contradicted_findings[0].why_unresolved is None


def test_tldr_cannot_claim_exclusion_when_nothing_was_ruled_out():
    t = RecordTier.insufficient_information
    assert tldr_rejection_reason("Records about others with the same name were excluded.", t, any_excluded=False)
    assert tldr_rejection_reason("Records about others with the same name were excluded.", t, any_excluded=True) is None
