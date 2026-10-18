from safematch.agents.verifier import Verifier, apply_guards
from safematch.models import EvidenceStatus, IdentityMatch, InvestigatorResult, PipelineMode, RecordStage, RetrievedVia, SourceType
from safematch.providers.llm import LLMError, MockLLMProvider
from safematch.providers.source_retrieval import FixtureFetcher
from tests.factories import candidate, llm_verification, query


def test_clean_verified_passes_unchanged():
    c = candidate()
    v = apply_guards(c, llm_verification(c), excerpt_confirmed=True)
    assert v.evidence_status == EvidenceStatus.verified and v.guard_adjustments == []


def test_name_only_match_capped_at_weak():
    c = candidate()
    v = apply_guards(c, llm_verification(c, identity_basis=["full_name"]), True)
    assert v.identity_match == IdentityMatch.weak_match
    assert v.evidence_status == EvidenceStatus.unverified
    assert any(a.startswith("G1") for a in v.guard_adjustments)


def test_mismatch_becomes_contradicted():
    c = candidate()
    v = apply_guards(c, llm_verification(c, identity_match="mismatch"), True)
    assert v.evidence_status == EvidenceStatus.contradicted


def test_allegation_not_escalated_to_conviction_without_support():
    c = candidate(record_stage="allegation", source_type=SourceType.social_post)
    v = apply_guards(c, llm_verification(c, record_stage="conviction", supporting_evidence=[]), True)
    assert v.record_stage == RecordStage.allegation


def test_acquittal_outcome_overrides_conviction_stage():
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="Defendant found not guilty at trial"), True)
    assert v.record_stage == RecordStage.acquitted


def test_dismissal_outcome_overrides_conviction_stage():
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="All charges dismissed"), True)
    assert v.record_stage == RecordStage.dismissed


def test_mixed_multi_case_outcome_is_not_relabelled_as_acquittal():
    # Regression from the live evaluation: "convicted twice ... acquitted in one case".
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="Convicted of rape twice; acquitted in one later case"), True)
    assert v.record_stage == RecordStage.unknown
    assert any("multiple cases" in m for m in v.missing_information)


def test_exoneration_becomes_vacated_not_mixed():
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="Wrongfully convicted in 1992; exonerated in 2018"), True)
    assert v.record_stage == RecordStage.vacated


def test_not_guilty_alone_is_acquittal_not_mixed():
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="Jury returned a not guilty verdict"), True)
    assert v.record_stage == RecordStage.acquitted


def test_inaccessible_source_cannot_be_verified():
    c = candidate()
    v = apply_guards(c, llm_verification(c, source_accessible=False), None)
    assert v.evidence_status == EvidenceStatus.unverified


def test_excerpt_not_on_page_cannot_be_verified():
    c = candidate()
    v = apply_guards(c, llm_verification(c), excerpt_confirmed=False)
    assert v.evidence_status == EvidenceStatus.unverified
    assert any(a.startswith("G7") for a in v.guard_adjustments)


def test_low_reliability_cannot_be_verified():
    c = candidate()
    v = apply_guards(c, llm_verification(c, source_reliability="low"), True)
    assert v.evidence_status == EvidenceStatus.unverified


def test_contradictions_block_verification():
    c = candidate()
    r = llm_verification(c, contradictory_evidence=[{"url": "https://courts.example/y", "source_type": "official_court_record"}])
    assert apply_guards(c, r, True).evidence_status == EvidenceStatus.inconclusive


def test_registry_date_cleared_without_official_registry():
    c = candidate(source_type=SourceType.news_report, record_stage="registry_entry")
    r = llm_verification(c, record_stage="registry_entry", registry_current_as_of="2026-01-01",
                         supporting_evidence=[{"url": "https://news.example/x", "source_type": "news_report"}])
    v = apply_guards(c, r, True)
    assert v.registry_current_as_of is None


def _inv(*cands):
    q = query()
    return InvestigatorResult(mode=PipelineMode.mock, query=q, search_scope=q.scope, candidate_findings=list(cands))


def test_verifier_does_not_receive_investigator_quality_labels():
    c = candidate(retrieved_via=RetrievedVia.fixture)
    llm = MockLLMProvider({"verifier": lambda t: {"results": [llm_verification(c).model_dump(mode="json")]}})
    Verifier(llm).run(_inv(c))
    sent = llm.calls[0].user_prompt
    assert "provisional_source_quality" not in sent and "provisional_relevance" not in sent
    assert c.finding_id in sent


def test_verifier_session_failure_yields_inconclusive_not_verified():
    c = candidate(retrieved_via=RetrievedVia.fixture)
    llm = MockLLMProvider({"verifier": [LLMError("boom")] * 3})
    res = Verifier(llm, max_retries=2).run(_inv(c))
    v = res.findings[0].verification
    assert v.evidence_status == EvidenceStatus.inconclusive and not v.flag_eligible
    assert any(e.kind.value == "agent_failed" for e in res.retrieval_errors)


def test_missing_result_for_finding_is_inconclusive():
    c = candidate(retrieved_via=RetrievedVia.fixture)
    llm = MockLLMProvider({"verifier": {"results": []}})
    res = Verifier(llm).run(_inv(c))
    assert res.findings[0].verification.evidence_status == EvidenceStatus.inconclusive


def test_excerpt_checker_is_applied():
    c = candidate(retrieved_via=RetrievedVia.fixture)
    llm = MockLLMProvider({"verifier": {"results": [llm_verification(c).model_dump(mode="json")]}})
    fetcher = FixtureFetcher({c.source_url: {"status": 200, "text": "An unrelated page about something else entirely."}})
    res = Verifier(llm, excerpt_checker=fetcher).run(_inv(c))
    v = res.findings[0].verification
    assert v.excerpt_confirmed is False and v.evidence_status == EvidenceStatus.unverified


def test_reinstated_conviction_is_not_relabelled_vacated():
    # Regression from a live run: "vacated in 2022, reinstated on appeal in 2023" means the conviction stands.
    c = candidate()
    v = apply_guards(c, llm_verification(c, case_outcome="Conviction vacated in 2022; reinstated by the appellate court in 2023"), True)
    assert v.record_stage == RecordStage.conviction
    assert any("reinstatement" in m for m in v.missing_information)


def test_api_records_count_as_opened_and_grounded():
    c = candidate()
    c = c.model_copy(update={"provenance": c.provenance.model_copy(update={"from_records_api": True})})
    v = apply_guards(c, llm_verification(c, source_accessible=False), excerpt_confirmed=False)
    assert v.evidence_status == EvidenceStatus.verified and v.source_accessible and v.excerpt_confirmed
