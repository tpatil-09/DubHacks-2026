"""Shared, strictly validated data models for the SafeMatch pipeline.

All three agents communicate exclusively through these models. Unknown values
are represented as ``None`` (or an explicit ``unknown`` enum member) — never
invented.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SCHEMA_VERSION = "1.0"
FLAG_LABEL = "Verified record requiring attention"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def make_finding_id(source_url: str, claim: str) -> str:
    """Stable ID: identical (url, claim) pairs always map to the same ID."""
    digest = hashlib.sha256(f"{source_url.strip()}\n{claim.strip().lower()}".encode("utf-8"))
    return "f_" + digest.hexdigest()[:16]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", use_enum_values=False)


# --------------------------------------------------------------------------- enums


class SourceType(str, Enum):
    official_court_record = "official_court_record"
    official_registry = "official_registry"
    news_report = "news_report"
    social_post = "social_post"
    secondary_source = "secondary_source"
    unknown = "unknown"


OFFICIAL_SOURCE_TYPES = frozenset({SourceType.official_court_record, SourceType.official_registry})


class EvidenceStatus(str, Enum):
    verified = "verified"
    unverified = "unverified"
    contradicted = "contradicted"
    inconclusive = "inconclusive"


class IdentityMatch(str, Enum):
    strong_match = "strong_match"
    possible_match = "possible_match"
    weak_match = "weak_match"
    mismatch = "mismatch"
    inconclusive = "inconclusive"


IDENTITY_RANK = {
    IdentityMatch.mismatch: 0,
    IdentityMatch.inconclusive: 1,
    IdentityMatch.weak_match: 2,
    IdentityMatch.possible_match: 3,
    IdentityMatch.strong_match: 4,
}


class IdentityFactor(str, Enum):
    """Legitimate identifiers that can link a record to the queried person."""

    full_name = "full_name"
    middle_name_or_initial = "middle_name_or_initial"
    location = "location"
    age_or_birth_year = "age_or_birth_year"
    case_identifier = "case_identifier"
    other_disambiguator = "other_disambiguator"


class RecordStage(str, Enum):
    allegation = "allegation"
    arrest = "arrest"
    charge = "charge"
    conviction = "conviction"
    registry_entry = "registry_entry"
    dismissed = "dismissed"
    acquitted = "acquitted"
    vacated = "vacated"  # conviction vacated, overturned, expunged, or the person was exonerated
    unknown = "unknown"


class OffenseCategory(str, Enum):
    sexual_offense = "sexual_offense"
    domestic_violence = "domestic_violence"
    other_serious_violent = "other_serious_violent"
    other = "other"
    unknown = "unknown"


SERIOUS_OFFENSES = frozenset(
    {OffenseCategory.sexual_offense, OffenseCategory.domestic_violence, OffenseCategory.other_serious_violent}
)


class Reliability(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"
    unknown = "unknown"


class Relevance(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ErrorKind(str, Enum):
    search_failed = "search_failed"
    access_denied = "access_denied"
    fetch_failed = "fetch_failed"
    agent_failed = "agent_failed"
    blocked_by_policy = "blocked_by_policy"
    record_requires_formal_request = "record_requires_formal_request"


class OverallStatus(str, Enum):
    records_require_attention = "records_require_attention"
    findings_require_review = "findings_require_review"
    no_relevant_records_found_in_scope = "no_relevant_records_found_in_scope"
    partial = "partial"
    inconclusive = "inconclusive"


class RecordTier(str, Enum):
    """How serious the records LINKED to the person are, from most to least serious.

    Computed deterministically from verified findings (never by the model). It
    describes the evidence found, not the person; there is still no risk score.
    """

    verified_record_requires_attention = "verified_record_requires_attention"
    reported_conviction_unconfirmed = "reported_conviction_unconfirmed"
    unresolved_allegations_or_charges = "unresolved_allegations_or_charges"
    cleared_outcomes_only = "cleared_outcomes_only"
    no_linked_records = "no_linked_records"
    insufficient_information = "insufficient_information"


TIER_LABELS = {
    RecordTier.verified_record_requires_attention: "Verified record requiring attention",
    RecordTier.reported_conviction_unconfirmed: "Conviction or registration reported, not confirmed on an official record",
    RecordTier.unresolved_allegations_or_charges: "Allegations or charges with no confirmed outcome",
    RecordTier.cleared_outcomes_only: "Accused or charged, but cleared (dismissed, acquitted, or exonerated)",
    RecordTier.no_linked_records: "No records linked to this person in the search scope",
    RecordTier.insufficient_information: "Not enough information: key sources could not be checked",
}


class PipelineMode(str, Enum):
    live = "live"
    mock = "mock"


class RetrievedVia(str, Enum):
    claude_code_websearch = "claude_code_websearch"
    claude_code_webfetch = "claude_code_webfetch"
    tavily = "tavily"
    fixture = "fixture"


# ------------------------------------------------------------------------ query


class SearchScope(Strict):
    source_types: List[SourceType] = Field(
        default_factory=lambda: [
            SourceType.official_court_record,
            SourceType.official_registry,
            SourceType.news_report,
        ]
    )
    offense_categories: List[OffenseCategory] = Field(default_factory=lambda: sorted(SERIOUS_OFFENSES, key=str))
    include_public_social_media: bool = False
    max_searches: int = Field(default=40, ge=1, le=60)
    max_findings: int = Field(default=30, ge=1, le=60)


class PersonQuery(Strict):
    """Voluntarily supplied search information. No DOB or home address required."""

    full_name: str = Field(min_length=3, max_length=120)
    middle_name: Optional[str] = Field(default=None, max_length=60)
    location: Optional[str] = Field(default=None, max_length=120, description="City/state the person supplied")
    jurisdictions: List[str] = Field(default_factory=list, max_length=10)
    age_min: Optional[int] = Field(default=None, ge=18, le=120)
    age_max: Optional[int] = Field(default=None, ge=18, le=120)
    other_identifiers: List[str] = Field(default_factory=list, max_length=10)
    scope: SearchScope = Field(default_factory=SearchScope)

    @field_validator("full_name")
    @classmethod
    def _name_has_two_parts(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v.split(" ")) < 2:
            raise ValueError("full_name must include at least a first and last name")
        return v

    @model_validator(mode="after")
    def _age_range(self) -> "PersonQuery":
        if self.age_min and self.age_max and self.age_min > self.age_max:
            raise ValueError("age_min must be <= age_max")
        return self


# ---------------------------------------------------------------- investigator


class SourceDocument(Strict):
    url: str
    title: Optional[str] = None
    source_type: SourceType = SourceType.unknown
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    accessible: bool = True
    access_note: Optional[str] = None
    retrieved_at: str = Field(default_factory=utc_now)
    retrieved_via: RetrievedVia = RetrievedVia.claude_code_webfetch


class RetrievalError(Strict):
    kind: ErrorKind
    target: str = Field(description="URL or search query that failed")
    detail: str = Field(max_length=500)
    stage: str = Field(description="investigator | verifier | synthesizer")


class Provenance(Strict):
    agent: str
    retrieved_via: RetrievedVia
    search_query: Optional[str] = None
    retrieved_at: str = Field(default_factory=utc_now)


class CandidateFinding(Strict):
    finding_id: str
    source_url: str
    source_title: Optional[str] = None
    source_type: SourceType
    excerpt: str = Field(max_length=1200)
    claim: str = Field(max_length=600)
    retrieved_at: str
    evidence_status: EvidenceStatus = EvidenceStatus.unverified
    record_stage: RecordStage = RecordStage.unknown
    offense_category: OffenseCategory = OffenseCategory.unknown
    publication_date: Optional[str] = None
    event_date: Optional[str] = None
    jurisdiction: Optional[str] = None
    case_identifier: Optional[str] = None
    disposition: Optional[str] = None
    identity_evidence: List[str] = Field(default_factory=list)
    provisional_relevance: Relevance = Relevance.medium
    provisional_source_quality: Reliability = Reliability.unknown
    provenance: Provenance


class InvestigatorResult(Strict):
    stage: str = "investigator"
    mode: PipelineMode
    query: PersonQuery
    search_scope: SearchScope
    search_queries_run: List[str] = Field(default_factory=list)
    sources_checked: List[SourceDocument] = Field(default_factory=list)
    candidate_findings: List[CandidateFinding] = Field(default_factory=list)
    retrieval_errors: List[RetrievalError] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    started_at: str = Field(default_factory=utc_now)
    completed_at: Optional[str] = None


# -------------------------------------------------------------------- verifier


class EvidenceRef(Strict):
    url: str
    source_type: SourceType = SourceType.unknown
    excerpt: Optional[str] = Field(default=None, max_length=800)
    note: Optional[str] = Field(default=None, max_length=400)


class VerificationResult(Strict):
    finding_id: str
    evidence_status: EvidenceStatus
    identity_match: IdentityMatch
    identity_basis: List[IdentityFactor] = Field(default_factory=list)
    identity_rationale: Optional[str] = None
    source_reliability: Reliability
    reliability_rationale: Optional[str] = None
    record_stage: RecordStage
    offense_category: OffenseCategory
    case_outcome: Optional[str] = None
    outcome_checked: bool = False
    registry_current_as_of: Optional[str] = None
    source_accessible: bool = True
    excerpt_confirmed: Optional[bool] = Field(
        default=None, description="Deterministic check that the excerpt appears on the live page (None = not checked)"
    )
    supporting_evidence: List[EvidenceRef] = Field(default_factory=list)
    contradictory_evidence: List[EvidenceRef] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    rationale: str = Field(max_length=1200)
    source_links: List[str] = Field(default_factory=list)
    flag_eligible: bool = False
    flag_rule_failures: List[str] = Field(default_factory=list)
    guard_adjustments: List[str] = Field(
        default_factory=list, description="Audit trail of deterministic overrides applied to the LLM judgement"
    )


class VerifiedFinding(Strict):
    candidate: CandidateFinding
    verification: VerificationResult

    @model_validator(mode="after")
    def _ids_match(self) -> "VerifiedFinding":
        if self.candidate.finding_id != self.verification.finding_id:
            raise ValueError("candidate and verification finding_id differ")
        return self


class VerifierResult(Strict):
    stage: str = "verifier"
    mode: PipelineMode
    query: PersonQuery
    search_scope: SearchScope
    search_queries_run: List[str] = Field(default_factory=list)
    sources_checked: List[SourceDocument] = Field(default_factory=list)
    findings: List[VerifiedFinding] = Field(default_factory=list)
    retrieval_errors: List[RetrievalError] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
    started_at: str = Field(default_factory=utc_now)
    completed_at: Optional[str] = None


# ------------------------------------------------------------------ final report


class SubjectSummary(Strict):
    full_name: str
    middle_name: Optional[str] = None
    location: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None


class ReportMetadata(Strict):
    report_id: str
    schema_version: str = SCHEMA_VERSION
    generated_at: str
    subject: SubjectSummary
    pipeline_mode: PipelineMode
    model_provider: str
    search_provider: str
    is_test_fixture: bool
    disclaimer: str


class IdentityAssessment(Strict):
    overall_identity_match: IdentityMatch
    distinct_individuals_suspected: bool
    findings_by_identity_match: Dict[str, int]
    notes: List[str] = Field(default_factory=list)


class ReportFinding(Strict):
    finding_id: str
    source_url: str
    source_type: SourceType
    source_title: Optional[str] = None
    excerpt: Optional[str] = None
    retrieved_at: str
    claim: str
    why_unresolved: Optional[str] = Field(
        default=None, description="Unverified/inconclusive findings only: why, in plain language. Also the first sentence of summary."
    )
    summary: str
    evidence_status: EvidenceStatus
    identity_match: IdentityMatch
    record_stage: RecordStage
    offense_category: OffenseCategory
    source_reliability: Reliability
    historical_report_only: bool
    publication_date: Optional[str] = None
    event_date: Optional[str] = None
    jurisdiction: Optional[str] = None
    case_identifier: Optional[str] = None
    disposition: Optional[str] = None
    supporting_urls: List[str] = Field(default_factory=list)
    contradictory_evidence: List[EvidenceRef] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    rationale: str


class CaseOutcome(Strict):
    finding_id: str
    source_url: str
    record_stage: RecordStage
    disposition: Optional[str] = None
    case_identifier: Optional[str] = None
    jurisdiction: Optional[str] = None
    outcome_source_type: SourceType
    evidence_status: EvidenceStatus


class SourceRef(Strict):
    url: str
    title: Optional[str] = None
    source_type: SourceType
    accessible: bool


class SourceSummary(Strict):
    total_sources_checked: int
    accessible_sources: int
    inaccessible_sources: int
    sources_by_type: Dict[str, int]
    search_queries_run: List[str]
    search_failures: List[RetrievalError]
    sources: List[SourceRef]


class SafetyIndicator(Strict):
    finding_id: str
    label: str = FLAG_LABEL
    rule_id: str
    basis: str
    source_url: str
    record_stage: RecordStage
    offense_category: OffenseCategory


class SafetyIndicators(Strict):
    verified_record_flag: bool
    label: Optional[str] = None
    indicators: List[SafetyIndicator] = Field(default_factory=list)
    rules_version: str
    note: str


class TLDRPoint(Strict):
    text: str
    finding_ids: List[str] = Field(description="Findings this point is based on")


class ReportTLDR(Strict):
    """Top-of-report summary: a deterministic tier plus a checked plain-language headline."""

    record_tier: RecordTier
    tier_label: str
    headline: str
    key_points: List[TLDRPoint] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)
    written_by: str = Field(description="'model' if the headline was model-written and passed checks, else 'template'")


class FinalReport(Strict):
    tldr: ReportTLDR
    report_metadata: ReportMetadata
    identity_assessment: IdentityAssessment
    verified_records: List[ReportFinding]
    unresolved_findings: List[ReportFinding]
    contradicted_findings: List[ReportFinding]
    case_outcomes: List[CaseOutcome]
    source_summary: SourceSummary
    safety_indicators: SafetyIndicators
    limitations: List[str]
    overall_status: OverallStatus

    @model_validator(mode="after")
    def _flag_consistency(self) -> "FinalReport":
        si = self.safety_indicators
        if si.verified_record_flag != bool(si.indicators):
            raise ValueError("verified_record_flag must be true iff indicators are present")
        verified_ids = {f.finding_id for f in self.verified_records}
        for ind in si.indicators:
            if ind.finding_id not in verified_ids:
                raise ValueError(f"indicator {ind.finding_id} does not reference a verified record")
        all_ids = verified_ids | {f.finding_id for f in self.unresolved_findings + self.contradicted_findings}
        for p in self.tldr.key_points:
            if not p.finding_ids or not set(p.finding_ids) <= all_ids:
                raise ValueError("every TLDR key point must cite finding_ids present in the report")
        if (self.tldr.record_tier == RecordTier.verified_record_requires_attention) != si.verified_record_flag:
            raise ValueError("record_tier 'verified_record_requires_attention' must match verified_record_flag")
        return self


REPORT_TOP_LEVEL_KEYS = list(FinalReport.model_fields.keys())
