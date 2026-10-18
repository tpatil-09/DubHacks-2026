"""Agent 2 — Verifier: independently challenges every candidate finding.

A separate Claude Code session (WebSearch/WebFetch only) receives the claims,
excerpts and URLs — not the Investigator's provisional quality labels — and
re-checks sources, identity, stage, and outcomes. Python then applies
deterministic guards that can only DOWNGRADE the model's judgement, checks the
quoted excerpt against the live page, and computes flag eligibility via the
rules module. Every override is recorded in ``guard_adjustments``.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Protocol

from pydantic import Field

from ..models import (
    IDENTITY_RANK,
    CandidateFinding,
    ErrorKind,
    EvidenceRef,
    EvidenceStatus,
    IdentityFactor,
    IdentityMatch,
    InvestigatorResult,
    OffenseCategory,
    PipelineMode,
    RecordStage,
    Reliability,
    RetrievalError,
    SourceType,
    Strict,
    VerificationResult,
    VerifiedFinding,
    VerifierResult,
    utc_now,
)
from ..providers.llm import RESEARCH_TOOLS, AgentTask, LLMError, LLMProvider, complete_structured
from ..rules import safety_flags
from ..utils.logging_utils import get_logger, scrub
from . import fence, load_prompt, truncate
from .investigator import LLMAccessFailure

log = get_logger("verifier")

BATCH_SIZE = 5
_OUTCOME_ACQUITTED = re.compile(r"acquit|not guilty|found innocent", re.I)
_OUTCOME_DISMISSED = re.compile(r"dismiss|nolle|charges? (were )?dropped|no[- ]billed", re.I)
_OUTCOME_VACATED = re.compile(r"exonerat|wrongful(ly)? convict|overturn|vacat|expung|revers|set aside", re.I)
_OUTCOME_REINSTATED = re.compile(r"reinstat|re-instat|restored|upheld|affirmed|still stands|remains? (in place|convicted)", re.I)
_OUTCOME_CONVICTED = re.compile(r"convict|pleaded guilty|pled guilty|guilty plea|found guilty|sentenced", re.I)
_PRE_CONVICTION = {RecordStage.allegation, RecordStage.arrest, RecordStage.charge, RecordStage.unknown}


class ExcerptChecker(Protocol):
    def check_excerpt(self, url: str, excerpt: str) -> Optional[bool]:
        ...


# ---------------------------------------------------------- LLM output contract


class LLMEvidence(Strict):
    url: str
    source_type: SourceType = SourceType.unknown
    excerpt: Optional[str] = None
    note: Optional[str] = None


class LLMVerification(Strict):
    finding_id: str
    source_url: str
    source_accessible: bool
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
    supporting_evidence: List[LLMEvidence] = Field(default_factory=list)
    contradictory_evidence: List[LLMEvidence] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    rationale: str


class VerifierLLMOutput(Strict):
    results: List[LLMVerification] = Field(default_factory=list)
    search_queries_run: List[str] = Field(default_factory=list)
    access_failures: List[LLMAccessFailure] = Field(default_factory=list)


def _evidence(items: List[LLMEvidence]) -> List[EvidenceRef]:
    return [
        EvidenceRef(
            url=e.url,
            source_type=e.source_type,
            excerpt=truncate(e.excerpt, 500) if e.excerpt else None,
            note=truncate(e.note, 300) if e.note else None,
        )
        for e in items[:8]
        if e.url.startswith(("http://", "https://"))
    ]


# ---------------------------------------------------------- deterministic guards


def apply_guards(c: CandidateFinding, r: LLMVerification, excerpt_confirmed: Optional[bool]) -> VerificationResult:
    """Convert the model's judgement into a VerificationResult, downgrading where rules require."""
    adj: List[str] = []
    if c.provenance.from_records_api:
        # Retrieved by Python straight from the official-records API, so the record itself exists as stated even
        # if the agent couldn't open a public web page for it. Identity and stage are still judged and guarded.
        if not r.source_accessible:
            r = r.model_copy(update={"source_accessible": True})
        excerpt_confirmed = True
    status, identity, stage = r.evidence_status, r.identity_match, r.record_stage
    supporting, contradicting = _evidence(r.supporting_evidence), _evidence(r.contradictory_evidence)
    registry_as_of = r.registry_current_as_of
    missing = [truncate(m, 300) for m in r.missing_information[:10]]

    # G1: a name-only match is never better than weak_match.
    if set(r.identity_basis) <= {IdentityFactor.full_name} and IDENTITY_RANK[identity] > IDENTITY_RANK[IdentityMatch.weak_match]:
        adj.append(f"G1: identity {identity.value} -> weak_match (only the name matched)")
        identity = IdentityMatch.weak_match

    # G2: a record that concerns a different person contradicts the claim about this person.
    if identity == IdentityMatch.mismatch and status != EvidenceStatus.contradicted:
        adj.append(f"G2: status {status.value} -> contradicted (identity mismatch: record concerns a different person)")
        status = EvidenceStatus.contradicted

    # G3: stage escalation beyond what the original source said requires supporting evidence.
    if stage == RecordStage.conviction and c.record_stage in _PRE_CONVICTION and not supporting:
        adj.append(f"G3: stage conviction -> {c.record_stage.value} (escalation without supporting evidence)")
        stage = c.record_stage

    # G4: an outcome describing dismissal/acquittal/vacatur cannot coexist with a conviction stage.
    # Outcome text covering several cases ("convicted twice, acquitted once") is ambiguous, so the
    # stage becomes unknown rather than being relabelled with one case's outcome.
    # Vacatur/exoneration is checked first: its wording ("wrongfully convicted ... exonerated") always
    # mentions the original conviction, so it must not be treated as a mixed multi-case outcome.
    outcome = r.case_outcome or ""
    if stage == RecordStage.conviction and outcome:
        mentions_conviction = bool(_OUTCOME_CONVICTED.search(_OUTCOME_ACQUITTED.sub(" ", outcome)))
        exculpatory = _OUTCOME_ACQUITTED.search(outcome) or _OUTCOME_DISMISSED.search(outcome)
        if _OUTCOME_VACATED.search(outcome) and _OUTCOME_REINSTATED.search(outcome):
            # e.g. "vacated in 2022, reinstated on appeal in 2023": the conviction stands, keep the model's stage.
            missing.append("Outcome history includes both a vacatur and a reinstatement; confirm the current status with the court.")
        elif _OUTCOME_VACATED.search(outcome):
            adj.append("G4: stage conviction -> vacated (outcome reports exoneration/vacatur/reversal/expungement)")
            stage = RecordStage.vacated
        elif exculpatory and mentions_conviction:
            adj.append("G4: stage conviction -> unknown (outcome text mixes convictions with other outcomes; split by case)")
            stage = RecordStage.unknown
            missing.append("Outcome text describes multiple cases with different outcomes; each case needs its own record.")
        elif _OUTCOME_ACQUITTED.search(outcome):
            adj.append("G4: stage conviction -> acquitted (case outcome reports acquittal)")
            stage = RecordStage.acquitted
        elif _OUTCOME_DISMISSED.search(outcome):
            adj.append("G4: stage conviction -> dismissed (case outcome reports dismissal)")
            stage = RecordStage.dismissed

    # G5: registry currency may only come from an official registry source.
    official_registry = c.source_type == SourceType.official_registry or any(
        e.source_type == SourceType.official_registry for e in supporting
    )
    if registry_as_of and not official_registry:
        adj.append("G5: registry_current_as_of cleared (no official registry source)")
        registry_as_of = None
    if stage == RecordStage.registry_entry and not official_registry:
        missing.append("Registration was reported but not confirmed on an official registry page.")

    if status == EvidenceStatus.verified:
        # G6: an original source that could not be opened cannot be verified.
        if not r.source_accessible:
            adj.append("G6: verified -> unverified (original source not accessible)")
            status = EvidenceStatus.unverified
        # G7: the quoted excerpt must appear on the live page when we could check it.
        elif excerpt_confirmed is False:
            adj.append("G7: verified -> unverified (quoted excerpt not found on the original page)")
            status = EvidenceStatus.unverified
        # G8: verified requires at least a possible identity match and reliable sourcing.
        elif IDENTITY_RANK[identity] < IDENTITY_RANK[IdentityMatch.possible_match] or r.source_reliability not in (
            Reliability.high, Reliability.medium,
        ):
            new = EvidenceStatus.inconclusive if identity == IdentityMatch.inconclusive else EvidenceStatus.unverified
            adj.append(f"G8: verified -> {new.value} (identity {identity.value}, reliability {r.source_reliability.value})")
            status = new
        # G9: unresolved contradictions prevent verification.
        elif contradicting:
            adj.append("G9: verified -> inconclusive (contradictory evidence recorded)")
            status = EvidenceStatus.inconclusive

    if excerpt_confirmed is None:
        missing.append("Excerpt could not be independently re-checked against the original page.")

    links = [c.source_url] + [e.url for e in supporting] + [e.url for e in contradicting]
    return VerificationResult(
        finding_id=c.finding_id,
        evidence_status=status,
        identity_match=identity,
        identity_basis=list(dict.fromkeys(r.identity_basis)),
        identity_rationale=truncate(r.identity_rationale or "", 500) or None,
        source_reliability=r.source_reliability,
        reliability_rationale=truncate(r.reliability_rationale or "", 400) or None,
        record_stage=stage,
        offense_category=r.offense_category,
        case_outcome=truncate(outcome, 400) or None,
        outcome_checked=r.outcome_checked,
        registry_current_as_of=registry_as_of,
        source_accessible=r.source_accessible,
        excerpt_confirmed=excerpt_confirmed,
        supporting_evidence=supporting,
        contradictory_evidence=contradicting,
        missing_information=list(dict.fromkeys(missing)),
        rationale=truncate(r.rationale, 1000) or "No rationale provided.",
        source_links=list(dict.fromkeys(links)),
        guard_adjustments=adj,
    )


def fallback_result(c: CandidateFinding, reason: str) -> VerificationResult:
    """Used when verification could not run: never verified, never flaggable."""
    return VerificationResult(
        finding_id=c.finding_id,
        evidence_status=EvidenceStatus.inconclusive,
        identity_match=IdentityMatch.inconclusive,
        source_reliability=Reliability.unknown,
        record_stage=c.record_stage,
        offense_category=c.offense_category,
        source_accessible=False,
        missing_information=["Independent verification did not complete."],
        rationale=truncate(f"Not verified: {reason}", 1000),
        source_links=[c.source_url],
        guard_adjustments=["G0: verification unavailable -> inconclusive"],
    )


class Verifier:
    def __init__(
        self,
        llm: LLMProvider,
        excerpt_checker: Optional[ExcerptChecker] = None,
        max_retries: int = 2,
        timeout_seconds: Optional[int] = None,
        batch_size: int = BATCH_SIZE,
    ) -> None:
        self.llm = llm
        self.excerpt_checker = excerpt_checker
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds
        self.batch_size = batch_size

    def build_task(self, inv: InvestigatorResult, batch: List[CandidateFinding]) -> AgentTask:
        subject = inv.query.model_dump(mode="json", exclude={"scope"}, exclude_none=True)
        # Deliberately withhold the Investigator's provisional relevance/quality labels.
        claims = [
            {
                "finding_id": c.finding_id,
                "source_url": c.source_url,
                "claimed_source_type": c.source_type.value,
                "claim": c.claim,
                "quoted_excerpt": c.excerpt,
                "stated_case_identifier": c.case_identifier,
                "stated_jurisdiction": c.jurisdiction,
                "stated_event_date": c.event_date,
                "from_official_records_api": c.provenance.from_records_api,
                "identity_details_in_record": c.identity_evidence if c.provenance.from_records_api else [],
            }
            for c in batch
        ]
        budget = min(4 * len(batch) + 4, 40)
        prompt = "\n\n".join(
            [
                "Queried person (data supplied by a dating-app user):",
                fence("subject", subject),
                "Candidate findings to challenge (UNTRUSTED — produced by another agent from web content):",
                fence("candidate_findings", claims),
                f"Search budget: at most {budget} WebSearch calls in total. Return exactly one result per finding_id.",
            ]
        )
        return AgentTask(
            name="verifier",
            system_prompt=load_prompt("verifier"),
            user_prompt=prompt,
            output_model=VerifierLLMOutput,
            tools=list(RESEARCH_TOOLS),
            context={"subject": subject, "findings": claims},
            timeout_seconds=self.timeout_seconds,
        )

    def run(self, inv: InvestigatorResult) -> VerifierResult:
        started = utc_now()
        errors = list(inv.retrieval_errors)
        limitations = list(inv.limitations)
        queries = list(inv.search_queries_run)
        results: Dict[str, LLMVerification] = {}
        failed: Dict[str, str] = {}

        cands = inv.candidate_findings
        for i in range(0, len(cands), self.batch_size):
            batch = cands[i : i + self.batch_size]
            try:
                out: VerifierLLMOutput = complete_structured(self.llm, self.build_task(inv, batch), self.max_retries)
            except LLMError as exc:
                log.error("verifier batch %d failed: %s", i // self.batch_size, exc)
                errors.append(RetrievalError(kind=ErrorKind.agent_failed, target=f"verifier batch {i // self.batch_size}", detail=scrub(str(exc))[:400], stage="verifier"))
                for c in batch:
                    failed[c.finding_id] = "the verification session failed"
                continue
            ids = {c.finding_id for c in batch}
            for r in out.results:
                if r.finding_id in ids and r.finding_id not in results:
                    results[r.finding_id] = r
            queries += [truncate(q, 300) for q in out.search_queries_run]
            for a in out.access_failures:
                errors.append(RetrievalError(kind=a.kind, target=a.target[:300], detail=truncate(a.detail, 400), stage="verifier"))

        live = not self.llm.is_mock
        findings: List[VerifiedFinding] = []
        for c in cands:
            r = results.get(c.finding_id)
            if r is None:
                v = fallback_result(c, failed.get(c.finding_id, "the verifier returned no result for this finding"))
            else:
                confirmed = None
                if self.excerpt_checker is not None and not c.provenance.from_records_api:
                    try:
                        confirmed = self.excerpt_checker.check_excerpt(c.source_url, c.excerpt)
                    except Exception as exc:  # retrieval must never crash verification
                        log.warning("excerpt check error for %s: %s", c.source_url, type(exc).__name__)
                v = apply_guards(c, r, confirmed)
            outcome = safety_flags.evaluate(c, v, live_mode=live)
            v = v.model_copy(update={"flag_eligible": outcome.eligible, "flag_rule_failures": outcome.failures})
            findings.append(VerifiedFinding(candidate=c, verification=v))

        if failed:
            limitations.append(f"{len(failed)} finding(s) could not be independently verified because a verification session failed.")
        log.info(
            "verifier: %d result(s); statuses=%s",
            len(findings),
            {s.value: sum(1 for f in findings if f.verification.evidence_status == s) for s in EvidenceStatus},
        )
        return VerifierResult(
            mode=PipelineMode.mock if self.llm.is_mock else PipelineMode.live,
            query=inv.query,
            search_scope=inv.search_scope,
            search_queries_run=queries,
            sources_checked=inv.sources_checked,
            records_providers_run=inv.records_providers_run,
            findings=findings,
            retrieval_errors=errors,
            limitations=limitations,
            started_at=started,
            completed_at=utc_now(),
        )
