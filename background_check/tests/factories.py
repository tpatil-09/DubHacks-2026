"""Small builders for unit tests (synthetic data only)."""
from __future__ import annotations

from typing import Any, Dict

from safematch.agents.verifier import LLMVerification
from safematch.models import (
    CandidateFinding,
    PersonQuery,
    Provenance,
    RetrievedVia,
    SourceType,
    VerificationResult,
    make_finding_id,
    utc_now,
)

URL = "https://courts.exampleland.example/cases/CR-1"


def query(**kw: Any) -> PersonQuery:
    base: Dict[str, Any] = {"full_name": "Alex Fixture Doe", "location": "Springfield, Exampleland"}
    base.update(kw)
    return PersonQuery.model_validate(base)


def candidate(**kw: Any) -> CandidateFinding:
    claim = kw.pop("claim", "Court record states Alex Fixture Doe was convicted of sexual assault.")
    url = kw.pop("source_url", URL)
    via = kw.pop("retrieved_via", RetrievedVia.claude_code_webfetch)
    base: Dict[str, Any] = dict(
        finding_id=make_finding_id(url, claim),
        source_url=url,
        source_type=SourceType.official_court_record,
        excerpt="Alex Fixture Doe was found guilty of sexual assault.",
        claim=claim,
        retrieved_at=utc_now(),
        record_stage="conviction",
        offense_category="sexual_offense",
        provenance=Provenance(agent="investigator", retrieved_via=via),
    )
    base.update(kw)
    return CandidateFinding.model_validate(base)


def llm_verification(c: CandidateFinding, **kw: Any) -> LLMVerification:
    base: Dict[str, Any] = dict(
        finding_id=c.finding_id,
        source_url=c.source_url,
        source_accessible=True,
        evidence_status="verified",
        identity_match="strong_match",
        identity_basis=["full_name", "middle_name_or_initial", "location", "age_or_birth_year"],
        source_reliability="high",
        record_stage="conviction",
        offense_category="sexual_offense",
        case_outcome="Convicted; no appeal found",
        outcome_checked=True,
        supporting_evidence=[{"url": c.source_url, "source_type": "official_court_record"}],
        contradictory_evidence=[],
        rationale="Official docket confirms the conviction.",
    )
    base.update(kw)
    return LLMVerification.model_validate(base)


def verification(c: CandidateFinding, **kw: Any) -> VerificationResult:
    base: Dict[str, Any] = dict(
        finding_id=c.finding_id,
        evidence_status="verified",
        identity_match="strong_match",
        identity_basis=["full_name", "location", "age_or_birth_year"],
        source_reliability="high",
        record_stage="conviction",
        offense_category="sexual_offense",
        outcome_checked=True,
        supporting_evidence=[{"url": c.source_url, "source_type": "official_court_record"}],
        rationale="ok",
    )
    base.update(kw)
    return VerificationResult.model_validate(base)
