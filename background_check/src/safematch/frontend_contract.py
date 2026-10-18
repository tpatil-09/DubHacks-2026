"""Adapter from the detailed FinalReport to the team's report.json contract.

The frontend (web/src/types/safetyReport.ts) validates report.json against the
shape agreed in claude.md section 7. This module converts a FinalReport into
that shape deterministically. The detailed report is kept alongside it as
report.full.json for audit and debugging.

Mapping rules that matter for safety:
  * case_status is ``conviction`` only when the verified record stage is a
    conviction; vacated convictions are never shown as convictions.
  * Records about a different person (identity mismatch) and contradicted
    claims are left out of ``findings`` and counted in ``limitations``.
  * ``tldr`` is added as the first key. The frontend's zod object ignores
    unknown keys, so it does not affect validation.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List
from urllib.parse import urlparse

from .models import (
    OFFICIAL_SOURCE_TYPES,
    EvidenceStatus,
    FinalReport,
    IdentityMatch,
    OverallStatus,
    RecordStage,
    ReportFinding,
)

REQUIRED_NOTICE = (
    "SafeMatch provides a limited summary of accessible public sources. Information may be incomplete or inaccurate, "
    "and identity may be uncertain. This is not a formal criminal-history check and cannot guarantee personal safety."
)

IDENTITY_MAP = {
    IdentityMatch.strong_match: "strong_match",
    IdentityMatch.possible_match: "possible_match",
    IdentityMatch.weak_match: "weak_match",
    IdentityMatch.inconclusive: "unresolved",
}
_DISMISSED = re.compile(r"dismiss|dropped|nolle", re.I)
_ACQUITTED = re.compile(r"acquit|not guilty", re.I)
_GUILTY_PLEA = re.compile(r"plead(ed)? guilty|pled guilty|guilty plea", re.I)


def case_status(f: ReportFinding) -> str:
    stage, outcome = f.record_stage, (f.disposition or "")
    if stage == RecordStage.conviction:
        return "guilty_plea" if _GUILTY_PLEA.search(outcome) else "conviction"
    if stage == RecordStage.acquitted:
        return "acquitted"
    if stage == RecordStage.dismissed:
        return "dismissed"
    if stage == RecordStage.vacated:
        # A vacated conviction is never shown as a conviction; "dismissed" only when the charges were dismissed too.
        return "dismissed" if _DISMISSED.search(outcome) else "unknown"
    if stage in (RecordStage.charge, RecordStage.arrest):
        if _ACQUITTED.search(outcome):
            return "acquitted"
        if _DISMISSED.search(outcome):
            return "dismissed"
        return "charge_pending" if stage == RecordStage.charge else "unknown"
    if stage == RecordStage.allegation:
        return "allegation_only"
    if stage == RecordStage.registry_entry:
        return "not_applicable"
    return "unknown"


def record_type(f: ReportFinding) -> str:
    if f.record_stage == RecordStage.registry_entry:
        return "sex_offender_registry"
    if f.record_stage == RecordStage.unknown and f.offense_category.value in ("unknown", "other"):
        return "identity_context"
    return "criminal_case"


def source_type(f: ReportFinding) -> str:
    return "official_record" if f.source_type in OFFICIAL_SOURCE_TYPES else f.source_type.value


def _title(f: ReportFinding) -> str:
    return f.source_title or (urlparse(f.source_url).hostname or f.source_url).replace("www.", "")


def _finding(f: ReportFinding) -> Dict[str, Any]:
    conflicts = [
        " ".join(x for x in (e.note, e.excerpt) if x) or f"Conflicting source: {e.url}" for e in f.contradictory_evidence
    ]
    limitations = list(f.missing_information)
    if f.historical_report_only:
        limitations.insert(0, "Reported by news only; current official status was not confirmed.")
    if f.evidence_status != EvidenceStatus.verified:
        limitations.insert(0, f"Verification status: {f.evidence_status.value}.")
    return {
        "finding_id": f.finding_id,
        "description": f.summary,
        "record_type": record_type(f),
        "case_status": case_status(f),
        "identity_assessment": IDENTITY_MAP[f.identity_match],
        "identity_rationale": f.why_unresolved or f.rationale,
        "event_date": f.event_date,
        "jurisdiction": f.jurisdiction,
        "source_url": f.source_url,
        "source_title": _title(f),
        "source_type": source_type(f),
        "retrieved_at": f.retrieved_at,
        "supporting_excerpt": f.excerpt,
        "conflicts": conflicts,
        "limitations": list(dict.fromkeys(limitations)),
    }


def to_frontend_report(report: FinalReport) -> Dict[str, Any]:
    md, ss = report.report_metadata, report.source_summary
    subj = md.subject
    context_parts: List[str] = [p for p in (subj.location,) if p]
    if subj.age_min:
        context_parts.append(f"age {subj.age_min}" if subj.age_min == subj.age_max else f"age {subj.age_min}-{subj.age_max}")

    shown = [
        f for f in report.verified_records + report.unresolved_findings
        if f.identity_match != IdentityMatch.mismatch
    ]
    excluded_other = sum(1 for f in report.verified_records + report.unresolved_findings + report.contradicted_findings
                         if f.identity_match == IdentityMatch.mismatch)
    excluded_contradicted = sum(1 for f in report.contradicted_findings if f.identity_match != IdentityMatch.mismatch)

    limitations = [REQUIRED_NOTICE]
    if excluded_other:
        limitations.append(f"{excluded_other} record(s) about other people with the same or a similar name were excluded.")
    if excluded_contradicted:
        limitations.append(f"{excluded_contradicted} claim(s) contradicted by other sources were excluded.")
    limitations += [l for l in report.limitations if l not in limitations]

    errors = [f"{e.kind.value}: {e.target} ({e.detail})" for e in ss.search_failures]
    search_completed = report.overall_status != OverallStatus.partial

    t = report.tldr
    return {
        "tldr": t.model_dump(mode="json"),
        "schema_version": md.schema_version,
        "report_id": md.report_id,
        "generated_at": md.generated_at,
        "is_synthetic": md.is_test_fixture,
        "subject": {"name_provided": subj.full_name, "context_provided": ", ".join(context_parts) or None},
        "scope": {
            "sources_searched": [s.url for s in ss.sources if s.accessible],
            "sources_not_accessible": list(dict.fromkeys(
                [s.url for s in ss.sources if not s.accessible]
                + [l.split("Source could not be accessed: ", 1)[1].rsplit(" (", 1)[0]
                   for l in report.limitations if l.startswith("Source could not be accessed: ")]
            )),
            "search_completed": search_completed,
        },
        "summary": f"{t.tier_label}. {t.headline}",
        "findings": [_finding(f) for f in shown],
        "limitations": limitations,
        "errors": errors,
        "human_review_required": True,
    }


# JSON Schema mirroring web/src/types/safetyReport.ts (zod). Extra top-level keys (tldr) are allowed,
# exactly as zod's default object parsing allows them.
_IDENTITY = ["strong_match", "possible_match", "weak_match", "unresolved"]
_CASE = ["conviction", "guilty_plea", "charge_pending", "acquitted", "dismissed", "allegation_only",
         "civil_finding", "unknown", "not_applicable"]
_NULLABLE_STR = {"type": ["string", "null"]}
FRONTEND_REPORT_SCHEMA: Dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "SafeMatch report.json (frontend contract, claude.md section 7)",
    "type": "object",
    "required": ["schema_version", "report_id", "generated_at", "subject", "scope", "summary", "findings",
                 "limitations", "errors", "human_review_required"],
    "properties": {
        "schema_version": {"type": "string"},
        "report_id": {"type": "string"},
        "generated_at": {"type": "string", "format": "date-time"},
        "is_synthetic": {"type": "boolean"},
        "subject": {"type": "object", "required": ["name_provided"],
                    "properties": {"name_provided": {"type": "string"}, "context_provided": _NULLABLE_STR}},
        "scope": {"type": "object", "required": ["sources_searched", "sources_not_accessible", "search_completed"],
                  "properties": {"sources_searched": {"type": "array", "items": {"type": "string"}},
                                 "sources_not_accessible": {"type": "array", "items": {"type": "string"}},
                                 "search_completed": {"type": "boolean"}}},
        "summary": {"type": "string"},
        "findings": {"type": "array", "items": {
            "type": "object",
            "required": ["finding_id", "description", "record_type", "case_status", "identity_assessment",
                         "identity_rationale", "event_date", "jurisdiction", "source_url", "source_title",
                         "source_type", "retrieved_at", "conflicts", "limitations"],
            "properties": {
                "finding_id": {"type": "string"}, "description": {"type": "string"}, "record_type": {"type": "string"},
                "case_status": {"enum": _CASE}, "identity_assessment": {"enum": _IDENTITY},
                "identity_rationale": {"type": "string"}, "event_date": _NULLABLE_STR, "jurisdiction": _NULLABLE_STR,
                "source_url": {"type": "string", "pattern": "^https?://"}, "source_title": {"type": "string"},
                "source_type": {"type": "string"}, "retrieved_at": {"type": "string", "format": "date-time"},
                "supporting_excerpt": _NULLABLE_STR,
                "conflicts": {"type": "array", "items": {"type": "string"}},
                "limitations": {"type": "array", "items": {"type": "string"}},
            }}},
        "limitations": {"type": "array", "items": {"type": "string"}},
        "errors": {"type": "array", "items": {"type": "string"}},
        "human_review_required": {"type": "boolean"},
    },
}


def validate_frontend_report(data: Dict[str, Any]) -> List[str]:
    import jsonschema
    from datetime import datetime

    errors = [f"frontend: {'/'.join(map(str, e.path)) or '<root>'}: {e.message[:200]}"
              for e in jsonschema.Draft202012Validator(FRONTEND_REPORT_SCHEMA).iter_errors(data)]
    for path, value in [("generated_at", data.get("generated_at"))] + [
        (f"findings/{i}/retrieved_at", f.get("retrieved_at")) for i, f in enumerate(data.get("findings", []))
    ]:
        try:
            datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            errors.append(f"frontend: {path}: not an ISO-8601 timestamp")
    return errors
