"""Agent 3 — Synthesizer: builds the fixed-schema FinalReport from VerifierResult.

Every structural field (buckets, statuses, flags, sources, overall status) is
computed deterministically from the Verifier output. The model is used only to
phrase short neutral summaries; each summary is checked and replaced by a
template if it adds URLs, uses banned language, or omits required caveats.
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

from pydantic import Field

from ..models import (
    FLAG_LABEL,
    IDENTITY_RANK,
    OFFICIAL_SOURCE_TYPES,
    CaseOutcome,
    ErrorKind,
    EvidenceStatus,
    FinalReport,
    IdentityAssessment,
    IdentityFactor,
    IdentityMatch,
    TIER_LABELS,
    OverallStatus,
    PipelineMode,
    RecordTier,
    RecordStage,
    ReportFinding,
    ReportMetadata,
    ReportTLDR,
    SERIOUS_OFFENSES,
    SafetyIndicators,
    SourceRef,
    SourceSummary,
    Strict,
    SubjectSummary,
    TLDRPoint,
    VerifiedFinding,
    VerifierResult,
    utc_now,
)
from ..providers.llm import AgentTask, LLMError, LLMProvider, complete_structured
from ..rules import safety_flags
from ..utils.logging_utils import get_logger
from . import fence, load_prompt, truncate

log = get_logger("synthesizer")

DISCLAIMER = (
    "Havenly background research is a limited, automated review of publicly accessible sources. It is not a "
    "certified, FCRA-compliant, or comprehensive criminal background check, and an absence of findings is not "
    "evidence that a person has no record. Findings must be reviewed by a person before any action is taken."
)
SUMMARY_LIMIT = 350
_BANNED = re.compile(
    r"\b(dangerous|predator|predatory|monster|evil|psychopath|sociopath|threat to|will (re)?offend|likely to (re)?offend"
    r"|(is|are|clearly|obviously|definitely|undoubtedly) guilty)\b",
    re.I,
)
_URL = re.compile(r"https?://|www\.", re.I)
# Court-outcome wording ("found guilty", "pleaded guilty") counts as describing a conviction; "not guilty" does not.
_CONVICTION_WORDS = re.compile(r"\bconvict(ed|ion)\b|(?<!not )\b(found|pleaded|pled) guilty\b", re.I)
_SEARCH_FAILURE_KINDS = {ErrorKind.search_failed, ErrorKind.agent_failed}
_ACCESS_FAILURE_KINDS = {ErrorKind.access_denied, ErrorKind.fetch_failed, ErrorKind.record_requires_formal_request}


class LLMSummary(Strict):
    finding_id: str
    summary: str


class LLMPoint(Strict):
    text: str
    finding_ids: List[str] = Field(default_factory=list)


class SynthesizerLLMOutput(Strict):
    summaries: List[LLMSummary] = Field(default_factory=list)
    tldr_headline: Optional[str] = None
    tldr_points: List[LLMPoint] = Field(default_factory=list)


def is_historical_report_only(f: VerifiedFinding) -> bool:
    c, v = f.candidate, f.verification
    official = c.source_type in OFFICIAL_SOURCE_TYPES or any(e.source_type in OFFICIAL_SOURCE_TYPES for e in v.supporting_evidence)
    return not official and v.record_stage in (RecordStage.conviction, RecordStage.registry_entry)


def template_summary(f: VerifiedFinding) -> str:
    c, v = f.candidate, f.verification
    src = c.source_type.value.replace("_", " ")
    stage = v.record_stage.value.replace("_", " ")
    status_txt = {
        EvidenceStatus.verified: "Verified",
        EvidenceStatus.unverified: "Unverified",
        EvidenceStatus.contradicted: "Contradicted",
        EvidenceStatus.inconclusive: "Inconclusive",
    }[v.evidence_status]
    parts = [f"{status_txt}: a {src} describes a record at the '{stage}' stage."]
    if v.evidence_status in _UNRESOLVED:
        return truncate(parts[0], SUMMARY_LIMIT)  # the reasons are given by why_unresolved()
    if is_historical_report_only(f):
        parts.append("Reported by news only; current official status was not confirmed.")
    if v.identity_match in (IdentityMatch.weak_match, IdentityMatch.inconclusive):
        parts.append("It may concern a different person with the same name.")
    elif v.identity_match == IdentityMatch.mismatch:
        parts.append("Available identifiers indicate this record concerns a different person.")
    return truncate(" ".join(parts), SUMMARY_LIMIT)


def summary_rejection_reason(summary: str, f: VerifiedFinding) -> Optional[str]:
    """None if the model summary is safe to show; otherwise a short reason it was rejected."""
    v = f.verification
    if not summary.strip() or len(summary) > SUMMARY_LIMIT + 50:
        return "empty or too long"
    if _URL.search(summary):
        return "contains a URL"
    banned = _BANNED.search(summary)
    if banned:
        return f"banned term '{banned.group(0)}'"
    # Must not describe a non-conviction as a conviction without a negation nearby.
    if v.record_stage != RecordStage.conviction and _CONVICTION_WORDS.search(summary):
        vacated_ok = v.record_stage == RecordStage.vacated and re.search(r"exonerat|wrongful|vacat|overturn|revers|expung", summary, re.I)
        if not vacated_ok and not re.search(r"\b(no|not|without|never|unconfirmed|unverified)\b[^.]{0,40}\bconvict", summary, re.I):
            return f"mentions a conviction but stage is {v.record_stage.value}"
    # Must not present an unresolved finding as verified.
    if v.evidence_status != EvidenceStatus.verified and re.search(r"(?<!un)\bverified\b", summary, re.I):
        return f"says 'verified' but status is {v.evidence_status.value}"
    return None


def summary_is_acceptable(summary: str, f: VerifiedFinding) -> bool:
    return summary_rejection_reason(summary, f) is None


_UNRESOLVED = (EvidenceStatus.unverified, EvidenceStatus.inconclusive)


def why_unresolved(f: VerifiedFinding) -> Optional[str]:
    """Deterministic, plain-language reason a finding is unverified/inconclusive (None otherwise).

    Built only from the Verifier's structured output so it can never overstate or soften the gaps.
    Identity comes last because it carries the consequence ("so it may be a different person").
    """
    c, v = f.candidate, f.verification
    if v.evidence_status not in _UNRESOLVED:
        return None
    official = c.source_type in OFFICIAL_SOURCE_TYPES or any(e.source_type in OFFICIAL_SOURCE_TYPES for e in v.supporting_evidence)
    clauses: List[str] = []
    if not official:
        if v.record_stage in (RecordStage.conviction, RecordStage.registry_entry, RecordStage.charge, RecordStage.arrest):
            clauses.append("current official status was not confirmed")
        elif v.record_stage != RecordStage.unknown:
            clauses.append("it was not confirmed on an official court or registry record")
    if not v.source_accessible:
        clauses.append("details come only from a search snippet because the source could not be opened")
    elif v.excerpt_confirmed is False:
        clauses.append("the quoted text was not found on the source page")
    if v.record_stage in _PRE_OUTCOME and not v.case_outcome:
        clauses.append("no final outcome was found")
    if v.contradictory_evidence:
        clauses.append("other sources conflict with it")
    name_only = set(v.identity_basis) <= {IdentityFactor.full_name}
    identity = {
        IdentityMatch.weak_match: ("the match is by name only, so it may be a different person" if name_only
                                   else "the identity link is weak, so it may be a different person"),
        IdentityMatch.possible_match: "only some identifiers match, so it may be a different person",
        IdentityMatch.inconclusive: "it could not be confirmed that this record concerns this person",
    }.get(v.identity_match)
    if not clauses and not identity:
        clauses.append("the available evidence is not enough to confirm or rule out the claim")

    def sentence(parts: List[str]) -> str:
        t = parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + ", and " + parts[-1]
        return t[0].upper() + t[1:] + "."

    if not identity:
        return sentence(clauses)
    if len(clauses) <= 1:  # e.g. "Current official status was not confirmed, and the match is by name only, ..."
        return sentence(clauses + [identity])
    return sentence(clauses) + " " + sentence([identity])  # keep the identity consequence readable


def to_report_finding(f: VerifiedFinding, summary: str) -> ReportFinding:
    c, v = f.candidate, f.verification
    reason = why_unresolved(f)
    return ReportFinding(
        finding_id=c.finding_id,
        source_url=c.source_url,
        source_type=c.source_type,
        source_title=c.source_title,
        excerpt=c.excerpt,
        retrieved_at=c.retrieved_at,
        claim=c.claim,
        why_unresolved=reason,
        summary=f"{reason} {summary}" if reason else summary,
        evidence_status=v.evidence_status,
        identity_match=v.identity_match,
        record_stage=v.record_stage,
        offense_category=v.offense_category,
        source_reliability=v.source_reliability,
        historical_report_only=is_historical_report_only(f),
        publication_date=c.publication_date,
        event_date=c.event_date,
        jurisdiction=c.jurisdiction,
        case_identifier=c.case_identifier,
        disposition=v.case_outcome or c.disposition,
        supporting_urls=[e.url for e in v.supporting_evidence],
        contradictory_evidence=v.contradictory_evidence,
        missing_information=v.missing_information,
        rationale=v.rationale,
    )


# ------------------------------------------------------------------------- TLDR

_LINKED_IDENTITY = (IdentityMatch.strong_match, IdentityMatch.possible_match)
_PRE_OUTCOME = (RecordStage.allegation, RecordStage.arrest, RecordStage.charge)
_CLEARED_STAGES = (RecordStage.dismissed, RecordStage.acquitted, RecordStage.vacated)
_CLEARED_WORDS = re.compile(r"exonerat|vacat|overturn|revers|dismiss|acquit|not guilty|dropped|nolle|expung|did not stand|set aside", re.I)
_NEGATION_NEAR_CONVICT = re.compile(r"\b(no|not|without|never|nor)\b[^.]{0,50}\bconvict|\bconvict\w*[^.]{0,60}\b(vacated|overturned|reversed|did not stand|set aside|expunged)", re.I)
_VERIFIED_RECORD_PHRASE = re.compile(r"\bverified\s+(\w+\s+){0,2}(conviction|registry|registration|record)", re.I)
TLDR_HEADLINE_LIMIT = 320


def linked_findings(vr: VerifierResult) -> List[VerifiedFinding]:
    """Findings plausibly about this person: strong/possible identity and not contradicted."""
    return [
        f for f in vr.findings
        if f.verification.identity_match in _LINKED_IDENTITY and f.verification.evidence_status != EvidenceStatus.contradicted
    ]


def _is_cleared_pre_outcome(f: VerifiedFinding) -> bool:
    v = f.verification
    return v.record_stage in _PRE_OUTCOME and bool(v.case_outcome and _CLEARED_WORDS.search(v.case_outcome))


def compute_tier(vr: VerifierResult, flagged: bool) -> RecordTier:
    """Deterministic severity tier of the records linked to the person (highest applicable wins)."""
    if flagged:
        return RecordTier.verified_record_requires_attention
    # Identity-context sources (a roster, a profile) have neither a stage nor an offense; they are not records.
    linked = [
        f for f in linked_findings(vr)
        if f.verification.record_stage != RecordStage.unknown or f.verification.offense_category in SERIOUS_OFFENSES
    ]
    known = [f for f in linked if f.verification.record_stage != RecordStage.unknown]
    considered = known or linked  # unknown-stage findings matter only when nothing else is known
    if any(f.verification.record_stage in (RecordStage.conviction, RecordStage.registry_entry) for f in considered):
        return RecordTier.reported_conviction_unconfirmed
    if any(
        (f.verification.record_stage in _PRE_OUTCOME and not _is_cleared_pre_outcome(f))
        or f.verification.record_stage == RecordStage.unknown
        for f in considered
    ):
        return RecordTier.unresolved_allegations_or_charges
    if considered:
        return RecordTier.cleared_outcomes_only
    failures = [e for e in vr.retrieval_errors if e.kind in _SEARCH_FAILURE_KINDS | _ACCESS_FAILURE_KINDS]
    return RecordTier.insufficient_information if failures else RecordTier.no_linked_records


def tldr_rejection_reason(text: str, tier: RecordTier, any_excluded: bool = True) -> Optional[str]:
    """None if a model-written TLDR sentence is consistent with the deterministic tier.

    ``any_excluded``: whether any finding was actually ruled out as a different person (identity mismatch).
    """
    if not text.strip() or len(text) > TLDR_HEADLINE_LIMIT:
        return "empty or too long"
    if not any_excluded and re.search(r"\bexclud", text, re.I):
        return "says records were excluded, but none were ruled out (unlinked records are unresolved, not excluded)"
    if _URL.search(text):
        return "contains a URL"
    banned = _BANNED.search(text)
    if banned:
        return f"banned term '{banned.group(0)}'"
    if tier != RecordTier.verified_record_requires_attention and _VERIFIED_RECORD_PHRASE.search(text):
        return "claims a verified record but no flag-eligible record exists"
    if tier not in (RecordTier.verified_record_requires_attention, RecordTier.reported_conviction_unconfirmed):
        if _CONVICTION_WORDS.search(text) and not _NEGATION_NEAR_CONVICT.search(text):
            if not (tier == RecordTier.cleared_outcomes_only and _CLEARED_WORDS.search(text)):
                return f"mentions a conviction without saying it did not stand (tier {tier.value})"
    if tier == RecordTier.cleared_outcomes_only and not _CLEARED_WORDS.search(text) and not re.search(r"clear", text, re.I):
        return "tier is cleared but text does not say how (dismissed/acquitted/exonerated)"
    return None


def template_tldr(tier: RecordTier, vr: VerifierResult, summaries: Dict[str, str]) -> Tuple[str, List[TLDRPoint]]:
    linked = linked_findings(vr)
    mismatches = [f for f in vr.findings if f.verification.identity_match == IdentityMatch.mismatch]
    headline = {
        RecordTier.verified_record_requires_attention:
            "An official record shows a verified conviction or current registry entry that meets Havenly's review rules.",
        RecordTier.reported_conviction_unconfirmed:
            "Sources report a past conviction or sex-offender registration for this person, but it was not confirmed on an official record.",
        RecordTier.unresolved_allegations_or_charges:
            "Sources report allegations or charges involving this person with no confirmed outcome; nothing found establishes a conviction.",
        RecordTier.cleared_outcomes_only:
            "Sources show this person was accused or charged, but every matter found ended in dismissal, acquittal, or a vacated conviction; no standing conviction was found.",
        RecordTier.no_linked_records:
            "No records linked to this person were found in the search scope."
            + (f" {len(mismatches)} record(s) found concern other people with the same name." if mismatches else ""),
        RecordTier.insufficient_information:
            "Nothing linked to this person was found, but key sources could not be checked, so this is not a clear result.",
    }[tier]
    order = {RecordStage.conviction: 0, RecordStage.registry_entry: 1, RecordStage.charge: 2, RecordStage.arrest: 3,
             RecordStage.allegation: 4, RecordStage.vacated: 5, RecordStage.acquitted: 6, RecordStage.dismissed: 7}
    ranked = sorted(linked, key=lambda f: (order.get(f.verification.record_stage, 9),
                                           f.verification.evidence_status != EvidenceStatus.verified))
    points = [TLDRPoint(text=summaries[f.candidate.finding_id], finding_ids=[f.candidate.finding_id]) for f in ranked[:3]]
    if not points and mismatches:
        points = [TLDRPoint(text=f"{len(mismatches)} record(s) were found for other people with the same or a similar name and were not linked to this person.",
                            finding_ids=[f.candidate.finding_id for f in mismatches])]
    return headline, points


def tldr_caveats(vr: VerifierResult) -> List[str]:
    out = []
    weak = [f for f in vr.findings if f.verification.identity_match in (IdentityMatch.weak_match, IdentityMatch.inconclusive)]
    mism = [f for f in vr.findings if f.verification.identity_match == IdentityMatch.mismatch]
    unchecked = [e for e in vr.retrieval_errors if e.kind in _ACCESS_FAILURE_KINDS]
    if weak:
        out.append(f"{len(weak)} finding(s) could not be reliably linked to this person.")
    if mism:
        out.append(f"{len(mism)} finding(s) concern a different person with the same or a similar name.")
    if unchecked:
        out.append(f"{len(unchecked)} source(s), such as registries or court portals, could not be checked.")
    out.append("Public-source research only; not a certified background check.")
    return out


class Synthesizer:
    def __init__(self, llm: Optional[LLMProvider] = None, max_retries: int = 1, search_provider_name: str = "claude_code_websearch") -> None:
        self.llm = llm
        self.max_retries = max_retries
        self.search_provider_name = search_provider_name

    def _narrate(
        self, vr: VerifierResult, tier: RecordTier, limitations: List[str]
    ) -> Tuple[Dict[str, str], Optional[str], List[TLDRPoint]]:
        """One model call: per-finding summaries plus the TLDR. Everything is checked; failures fall back to templates."""
        out: Dict[str, str] = {f.candidate.finding_id: template_summary(f) for f in vr.findings}
        if not self.llm or not vr.findings:
            return out, None, []
        linked_ids = [f.candidate.finding_id for f in linked_findings(vr)]
        payload = [
            {
                "finding_id": f.candidate.finding_id,
                "claim": f.candidate.claim,
                "source_type": f.candidate.source_type.value,
                "evidence_status": f.verification.evidence_status.value,
                "identity_match": f.verification.identity_match.value,
                "record_stage": f.verification.record_stage.value,
                "offense_category": f.verification.offense_category.value,
                "case_outcome": f.verification.case_outcome,
                "historical_report_only": is_historical_report_only(f),
                "verifier_rationale": f.verification.rationale,
            }
            for f in vr.findings
        ]
        tier_block = {
            "record_tier": tier.value,
            "tier_label": TIER_LABELS[tier],
            "finding_ids_linked_to_person": linked_ids,
        }
        task = AgentTask(
            name="synthesizer",
            system_prompt=load_prompt("synthesizer"),
            user_prompt=(
                "Write one neutral summary per finding, then the TLDR for the whole report.\n\n"
                + fence("record_tier", tier_block) + "\n\n" + fence("reviewed_findings", payload)
            ),
            output_model=SynthesizerLLMOutput,
            tools=[],
            context={"findings": payload, "tier": tier_block},
        )
        try:
            res: SynthesizerLLMOutput = complete_structured(self.llm, task, self.max_retries)
        except LLMError as exc:
            log.warning("synthesizer summaries unavailable, using templates: %s", exc)
            limitations.append("Narrative summaries were generated from templates because the summary model was unavailable.")
            return out, None, []
        by_id = {f.candidate.finding_id: f for f in vr.findings}
        rejected = 0
        for s in res.summaries:
            f = by_id.get(s.finding_id)
            if f is None:
                continue
            text = " ".join(s.summary.split())
            reason = summary_rejection_reason(text, f)
            if reason is None:
                out[s.finding_id] = truncate(text, SUMMARY_LIMIT)
            else:
                rejected += 1
                log.warning("synthesizer: summary for %s rejected (%s); template used", s.finding_id, reason)
        missing = len(vr.findings) - len(res.summaries)
        if rejected or missing > 0:
            log.info("synthesizer: %d rejected, %d missing model summary(ies); templates used instead", rejected, max(missing, 0))

        any_excluded = any(f.verification.identity_match == IdentityMatch.mismatch for f in vr.findings)
        headline = " ".join((res.tldr_headline or "").split()) or None
        if headline:
            reason = tldr_rejection_reason(headline, tier, any_excluded)
            if reason:
                log.warning("synthesizer: TLDR headline rejected (%s); template used", reason)
                headline = None
        # Key points may cite only findings linked to the person. Contradicted claims are never repeated in the
        # TLDR, even to dismiss them; same-name records may be cited only when nothing was linked.
        citable = set(linked_ids)
        if not citable:
            citable = {f.candidate.finding_id for f in vr.findings if f.verification.identity_match == IdentityMatch.mismatch}
        points: List[TLDRPoint] = []
        for p in res.tldr_points[:4]:
            text = " ".join(p.text.split())
            ids = [i for i in p.finding_ids if i in by_id]
            if not ids:
                reason = "cites no known finding_id"
            elif not set(ids) <= citable:
                reason = "cites a finding not linked to the person (contradicted or another person)"
            else:
                reason = tldr_rejection_reason(text, tier, any_excluded)
            if reason:
                log.warning("synthesizer: TLDR point rejected (%s)", reason)
                continue
            points.append(TLDRPoint(text=truncate(text, TLDR_HEADLINE_LIMIT), finding_ids=ids))
        return out, headline, points

    def run(self, vr: VerifierResult) -> FinalReport:
        live = vr.mode == PipelineMode.live
        limitations: List[str] = []

        # Flags and the record tier are decided first, deterministically, before any model call.
        indicators = []
        for f in vr.findings:
            if f.verification.evidence_status == EvidenceStatus.verified:
                # Re-evaluate rules here rather than trusting the stored flag_eligible value.
                outcome = safety_flags.evaluate(f.candidate, f.verification, live_mode=live)
                if outcome.eligible:
                    indicators.append(safety_flags.build_indicator(f.candidate, f.verification, outcome))
        tier = compute_tier(vr, flagged=bool(indicators))
        summaries, model_headline, model_points = self._narrate(vr, tier, limitations)
        tmpl_headline, tmpl_points = template_tldr(tier, vr, summaries)
        tldr = ReportTLDR(
            record_tier=tier,
            tier_label=TIER_LABELS[tier],
            headline=model_headline or tmpl_headline,
            key_points=model_points or tmpl_points,
            caveats=tldr_caveats(vr),
            written_by="model" if model_headline else "template",
        )

        verified, unresolved, contradicted, outcomes = [], [], [], []
        for f in vr.findings:
            c, v = f.candidate, f.verification
            rf = to_report_finding(f, summaries[c.finding_id])
            if v.evidence_status == EvidenceStatus.verified:
                verified.append(rf)
            elif v.evidence_status == EvidenceStatus.contradicted:
                contradicted.append(rf)
            else:
                unresolved.append(rf)
            if v.identity_match != IdentityMatch.mismatch and (v.case_outcome or c.disposition or v.record_stage in (
                RecordStage.conviction, RecordStage.dismissed, RecordStage.acquitted, RecordStage.vacated, RecordStage.registry_entry,
            )):
                outcomes.append(
                    CaseOutcome(
                        finding_id=c.finding_id,
                        source_url=c.source_url,
                        record_stage=v.record_stage,
                        disposition=v.case_outcome or c.disposition,
                        case_identifier=c.case_identifier,
                        jurisdiction=c.jurisdiction,
                        outcome_source_type=c.source_type,
                        evidence_status=v.evidence_status,
                    )
                )

        search_failures = [e for e in vr.retrieval_errors if e.kind in _SEARCH_FAILURE_KINDS]
        access_failures = [e for e in vr.retrieval_errors if e.kind in _ACCESS_FAILURE_KINDS]

        # ---- limitations (deduplicated, deterministic order)
        limitations = list(vr.limitations) + limitations
        if search_failures:
            limitations.append(f"{len(search_failures)} search or agent failure(s) occurred; results are partial.")
        for e in access_failures:
            if e.kind == ErrorKind.record_requires_formal_request:
                limitations.append(f"Official records at {e.target} require a formal request and were not reviewed.")
            else:
                limitations.append(f"Source could not be accessed: {e.target} ({truncate(e.detail, 120)}).")
        if any(f.verification.record_stage == RecordStage.registry_entry for f in vr.findings):
            limitations.append(
                "Registry information reflects only what the named jurisdiction publishes; no registry search covers "
                "all offenders or all jurisdictions."
            )
        ran = set(vr.records_providers_run)
        if "courtlistener" in ran:
            limitations.append("Official court records were searched through CourtListener (federal and state appellate opinions, federal dockets).")
        limitations.append(
            "Sex-offender registries have no free public API, so they were not checked directly. "
            "They can be searched manually at https://www.nsopw.gov."
        )
        limitations.append(DISCLAIMER)
        limitations = list(dict.fromkeys(limitations))

        # ---- identity assessment
        counts = Counter(f.verification.identity_match.value for f in vr.findings)
        non_mismatch = [f.verification.identity_match for f in vr.findings if f.verification.identity_match != IdentityMatch.mismatch]
        overall_identity = max(non_mismatch, key=lambda m: IDENTITY_RANK[m]) if non_mismatch else IdentityMatch.inconclusive
        notes: List[str] = []
        if counts.get("mismatch"):
            notes.append(f"{counts['mismatch']} finding(s) appear to concern a different person with the same or a similar name.")
        weakish = counts.get("weak_match", 0) + counts.get("inconclusive", 0)
        if weakish:
            notes.append(f"{weakish} finding(s) could not be reliably linked to this person (name-only or inconclusive identifiers).")
        if not vr.findings:
            notes.append("No findings were available to assess identity.")
        identity = IdentityAssessment(
            overall_identity_match=overall_identity,
            distinct_individuals_suspected=bool(counts.get("mismatch")),
            findings_by_identity_match={m.value: counts.get(m.value, 0) for m in IdentityMatch},
            notes=notes,
        )

        # ---- overall status
        if indicators:
            overall = OverallStatus.records_require_attention
        elif search_failures:
            overall = OverallStatus.partial
        elif verified or unresolved:
            overall = OverallStatus.findings_require_review
        elif access_failures:
            overall = OverallStatus.inconclusive
        else:
            overall = OverallStatus.no_relevant_records_found_in_scope

        # ---- sources
        srcs = vr.sources_checked
        sources = SourceSummary(
            total_sources_checked=len(srcs),
            accessible_sources=sum(1 for s in srcs if s.accessible),
            inaccessible_sources=sum(1 for s in srcs if not s.accessible),
            sources_by_type=dict(Counter(s.source_type.value for s in srcs)),
            search_queries_run=list(dict.fromkeys(vr.search_queries_run)),
            search_failures=search_failures,
            sources=[SourceRef(url=s.url, title=s.title, source_type=s.source_type, accessible=s.accessible) for s in srcs],
        )

        q = vr.query
        generated = utc_now()
        report_id = "r_" + hashlib.sha256(f"{q.full_name}|{generated}".encode()).hexdigest()[:16]
        report = FinalReport(
            tldr=tldr,
            report_metadata=ReportMetadata(
                report_id=report_id,
                generated_at=generated,
                subject=SubjectSummary(full_name=q.full_name, middle_name=q.middle_name, location=q.location, age_min=q.age_min, age_max=q.age_max),
                pipeline_mode=vr.mode,
                model_provider="mock" if vr.mode == PipelineMode.mock else "claude_cli",
                search_provider="fixture" if vr.mode == PipelineMode.mock else self.search_provider_name,
                is_test_fixture=vr.mode == PipelineMode.mock,
                disclaimer=DISCLAIMER,
            ),
            identity_assessment=identity,
            verified_records=verified,
            unresolved_findings=unresolved,
            contradicted_findings=contradicted,
            case_outcomes=outcomes,
            source_summary=sources,
            safety_indicators=SafetyIndicators(
                verified_record_flag=bool(indicators),
                label=FLAG_LABEL if indicators else None,
                indicators=indicators,
                rules_version=safety_flags.RULES_VERSION,
                note=(
                    "Flags are raised only by deterministic rules for verified official records with strong identity "
                    "matches. No overall risk or dangerousness score is produced."
                ),
            ),
            limitations=limitations,
            overall_status=overall,
        )
        log.info("synthesizer: overall_status=%s flag=%s", overall.value, bool(indicators))
        return report
