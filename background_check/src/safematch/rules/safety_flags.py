"""Deterministic safety-indicator rules. No LLM is involved in these decisions.

A ``verified_record_flag`` is raised for a finding only if EVERY rule passes:

R1_OFFICIAL_SOURCE   The claim is supported by an official court record or
                     official registry source rated high reliability.
R2_STRONG_IDENTITY   Identity match is ``strong_match`` (never from name alone).
R3_VERIFIED          Evidence status is ``verified``.
R4_ELIGIBLE_RECORD   Either (a) a conviction for a sexual offense, domestic
                     violence, or other serious violent offense, or (b) an
                     official registry entry with a stated current-as-of date.
R5_OUTCOME_CHECKED   Case outcome / record status was checked.
R6_NO_CONTRADICTION  No contradictory evidence is recorded.
R7_NOT_FIXTURE       Evidence did not come from a test fixture (live runs only).

Allegations, arrests, pending charges, dismissals, acquittals, news-only or
social-media-only evidence, and weak/inconclusive identity matches can never
raise a flag.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from ..models import (
    FLAG_LABEL,
    OFFICIAL_SOURCE_TYPES,
    SERIOUS_OFFENSES,
    CandidateFinding,
    EvidenceStatus,
    IdentityMatch,
    RecordStage,
    Reliability,
    RetrievedVia,
    SafetyIndicator,
    SourceType,
    VerificationResult,
)

RULES_VERSION = "2026-10-17.1"


@dataclass
class RuleOutcome:
    eligible: bool
    rule_id: str = ""
    failures: List[str] = field(default_factory=list)
    basis: str = ""


def _official_support(c: CandidateFinding, v: VerificationResult) -> bool:
    if v.source_reliability != Reliability.high:
        return False
    if c.source_type in OFFICIAL_SOURCE_TYPES:
        return True
    return any(ev.source_type in OFFICIAL_SOURCE_TYPES for ev in v.supporting_evidence)


def evaluate(c: CandidateFinding, v: VerificationResult, live_mode: bool = True) -> RuleOutcome:
    failures: List[str] = []
    if not _official_support(c, v):
        failures.append("R1_OFFICIAL_SOURCE: no high-reliability official court/registry source")
    if v.identity_match != IdentityMatch.strong_match:
        failures.append(f"R2_STRONG_IDENTITY: identity is {v.identity_match.value}")
    if v.evidence_status != EvidenceStatus.verified:
        failures.append(f"R3_VERIFIED: status is {v.evidence_status.value}")

    is_conviction = v.record_stage == RecordStage.conviction and v.offense_category in SERIOUS_OFFENSES
    official_registry = c.source_type == SourceType.official_registry or any(
        ev.source_type == SourceType.official_registry for ev in v.supporting_evidence
    )
    is_registry = v.record_stage == RecordStage.registry_entry and official_registry and bool(v.registry_current_as_of)
    if not (is_conviction or is_registry):
        failures.append(
            f"R4_ELIGIBLE_RECORD: stage={v.record_stage.value}, offense={v.offense_category.value}"
            + (", registry entry lacks official current-as-of date" if v.record_stage == RecordStage.registry_entry else "")
        )
    if not v.outcome_checked:
        failures.append("R5_OUTCOME_CHECKED: case outcome/record status not checked")
    if v.contradictory_evidence:
        failures.append(f"R6_NO_CONTRADICTION: {len(v.contradictory_evidence)} contradictory source(s)")
    if live_mode and c.provenance.retrieved_via == RetrievedVia.fixture:
        failures.append("R7_NOT_FIXTURE: fixture evidence cannot flag a live profile")

    if failures:
        return RuleOutcome(eligible=False, failures=failures)

    if is_conviction:
        rule_id = "VR1_SERIOUS_VIOLENT_CONVICTION"
        basis = (
            f"Official record shows a conviction ({v.offense_category.value.replace('_', ' ')})"
            + (f", case {c.case_identifier}" if c.case_identifier else "")
            + (f", {c.jurisdiction}" if c.jurisdiction else "")
            + "; identity strongly matched and outcome checked."
        )
    else:
        rule_id = "VR2_CURRENT_OFFICIAL_REGISTRY_ENTRY"
        basis = (
            f"Official registry lists an entry current as of {v.registry_current_as_of}"
            + (f" ({c.jurisdiction})" if c.jurisdiction else "")
            + "; identity strongly matched. Registry coverage is limited to that jurisdiction's public data."
        )
    return RuleOutcome(eligible=True, rule_id=rule_id, basis=basis)


def build_indicator(c: CandidateFinding, v: VerificationResult, outcome: RuleOutcome) -> SafetyIndicator:
    assert outcome.eligible
    return SafetyIndicator(
        finding_id=c.finding_id,
        label=FLAG_LABEL,
        rule_id=outcome.rule_id,
        basis=outcome.basis,
        source_url=c.source_url,
        record_stage=v.record_stage,
        offense_category=v.offense_category,
    )
