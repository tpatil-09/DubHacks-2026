"""Connects the safety-report screen to the screening pipeline.

requestSafetyReport stores a private Firestore request and returns immediately.
runSafetyReport then runs Investigator, Verifier, and Synthesizer and saves the
frontend report.json on that same document. getSafetyReport returns it only to
the person who asked.
"""
from __future__ import annotations

import os
import shutil
import sys
from datetime import date
from pathlib import Path
from typing import Any, Optional

FUNCTIONS_DIR = Path(__file__).resolve().parent


def _import_pipeline() -> None:
    """Prefer the repo package. Fall back to the copy made at deploy time."""
    candidates = [
        FUNCTIONS_DIR.parent / "background_check" / "src",
        FUNCTIONS_DIR / "_pipeline",
    ]
    for path in candidates:
        if (path / "safematch" / "__init__.py").is_file():
            entry = str(path)
            if entry not in sys.path:
                sys.path.insert(0, entry)
            return
    raise ImportError("The screening package is not available. Run functions/bundle_pipeline.py.")


_import_pipeline()

from firebase_admin import firestore, initialize_app  # noqa: E402
from firebase_functions import firestore_fn, https_fn, options  # noqa: E402
from firebase_functions.firestore_fn import Event  # noqa: E402

from safematch.config import ConfigError, load_settings  # noqa: E402
from safematch.frontend_contract import to_frontend_report, validate_frontend_report  # noqa: E402
from safematch.models import PersonQuery, PipelineMode, RetrievedVia  # noqa: E402
from safematch.orchestrator import (  # noqa: E402
    PipelineError,
    build_live_providers,
    run_investigator,
    run_synthesizer,
    run_verifier,
)
from safematch.utils.validation import validate_report  # noqa: E402

initialize_app()

REGION = "us-central1"


def _text(value: Any, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:limit]


def _age(birthdate: Any, today: Optional[date] = None) -> Optional[int]:
    if not isinstance(birthdate, str) or len(birthdate) != 10:
        return None
    try:
        born = date.fromisoformat(birthdate)
    except ValueError:
        return None
    today = today or date.today()
    if born > today:
        return None
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 18 <= age <= 120 else None


def _query_for(data: dict, age: Optional[int]) -> PersonQuery:
    name = _text(data.get("subjectName"), 120)
    location = _text(data.get("context"), 120) or None
    payload: dict[str, Any] = {"full_name": name}
    if location:
        payload["location"] = location
    if age is not None:
        payload["age_min"] = age
        payload["age_max"] = age
    return PersonQuery.model_validate(payload)


def _subject_age(db, data: dict) -> Optional[int]:
    uid = data.get("subjectUid")
    if not isinstance(uid, str) or not uid or "/" in uid or len(uid) > 128:
        return None
    snapshot = db.collection("profiles").document(uid).get()
    if not snapshot.exists:
        return None
    return _age((snapshot.to_dict() or {}).get("birthdate"))


@https_fn.on_call(region=REGION, timeout_sec=30, memory=options.MemoryOption.MB_256)
def requestSafetyReport(req: https_fn.CallableRequest) -> dict:
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Sign in to request a report.",
        )
    data = req.data if isinstance(req.data, dict) else {}
    if data.get("confirmedScope") is not True:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Confirm the scope and limits before starting a report.",
        )
    name = _text(data.get("subjectName"), 120)
    if len(name.split(" ")) < 2:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Enter a first and last name. A single name is not enough to search public records.",
        )
    try:
        _query_for(data, None)
    except Exception as exc:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message=str(exc)[:300]) from exc

    subject_uid = data.get("subjectUid")
    document = {
        "requesterUid": req.auth.uid,
        "subjectUid": subject_uid if isinstance(subject_uid, str) and subject_uid else None,
        "subjectName": name,
        "context": _text(data.get("context"), 120) or None,
        "status": "queued",
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    ref = firestore.client().collection("reportRequests").document()
    ref.set(document)
    return {"requestId": ref.id}


@https_fn.on_call(region=REGION, timeout_sec=30, memory=options.MemoryOption.MB_256)
def getSafetyReport(req: https_fn.CallableRequest) -> dict:
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Sign in to view a report.",
        )
    data = req.data if isinstance(req.data, dict) else {}
    request_id = data.get("requestId")
    if not isinstance(request_id, str) or not request_id:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Missing report id.")
    snapshot = firestore.client().collection("reportRequests").document(request_id).get()
    stored = snapshot.to_dict() if snapshot.exists else None
    if stored is None or stored.get("requesterUid") != req.auth.uid:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND, message="Report not found.")
    report = stored.get("report")
    if not isinstance(report, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="This report is not ready yet.",
        )
    return {"report": report}


@firestore.transactional
def _claim(transaction, ref) -> bool:
    snapshot = ref.get(transaction=transaction)
    if not snapshot.exists or snapshot.get("status") != "queued":
        return False
    transaction.update(ref, {"status": "searching"})
    return True


def _providers():
    overrides = {}
    if not os.environ.get("AGENT_TIMEOUT_SECONDS", "").strip():
        overrides["AGENT_TIMEOUT_SECONDS"] = "480"
    settings = load_settings(overrides=overrides)
    cli = settings.claude_cli_path or "claude"
    if settings.claude_code_oauth_token and shutil.which(cli):
        settings.require_live_credentials()
        return build_live_providers(settings), settings
    missing = "CLAUDE_CODE_OAUTH_TOKEN" if not settings.claude_code_oauth_token else f"the {cli} command"
    raise ConfigError(
        f"Live search is not available on this server ({missing} is missing). No report was generated."
    )


def _run_pipeline_and_write(ref, query: PersonQuery) -> None:
    """Shared by both report flows: run the pipeline and write status/result onto `ref`."""
    try:
        providers, settings = _providers()
        found = run_investigator(query, providers, settings)
        if providers.mode == PipelineMode.live and any(
            finding.provenance.retrieved_via == RetrievedVia.fixture for finding in found.candidate_findings
        ):
            raise PipelineError("Fixture evidence was detected in a live search, so the report was discarded.")
        ref.update({"status": "verifying"})
        verified = run_verifier(found, providers, settings)
        ref.update({"status": "analyzing"})
        final = run_synthesizer(verified, providers)
        frontend = to_frontend_report(final)
        problems = validate_report(final.model_dump(mode="json")) + validate_frontend_report(frontend)
        if problems:
            raise PipelineError("The report failed validation: " + "; ".join(problems[:3]))
        status = "complete" if frontend.get("scope", {}).get("search_completed") else "incomplete"
        ref.update({"status": status, "report": frontend, "finishedAt": firestore.SERVER_TIMESTAMP})
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        ref.update({"status": "failed", "error": message[:500], "finishedAt": firestore.SERVER_TIMESTAMP})


def _run(request_id: str, data: dict) -> None:
    db = firestore.client()
    ref = db.collection("reportRequests").document(request_id)
    if not _claim(db.transaction(), ref):
        return
    query = _query_for(data, _subject_age(db, data))
    _run_pipeline_and_write(ref, query)


@firestore_fn.on_document_created(
    document="reportRequests/{requestId}",
    region=REGION,
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
    max_instances=2,
)
def runSafetyReport(event: Event) -> None:
    if event.data is None:
        return
    request_id = event.params["requestId"]
    data = event.data.to_dict() or {}
    if data.get("status") != "queued":
        return
    _run(request_id, data)


@firestore.transactional
def _claim_screening(transaction, ref) -> bool:
    snapshot = ref.get(transaction=transaction)
    if snapshot.exists and snapshot.get("status") in ("searching", "verifying", "analyzing", "complete", "incomplete"):
        return False
    transaction.set(ref, {"status": "searching", "startedAt": firestore.SERVER_TIMESTAMP}, merge=True)
    return True


@firestore_fn.on_document_written(
    document="users/{uid}",
    region=REGION,
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
    max_instances=2,
)
def runOnboardingScreening(event: Event) -> None:
    """Runs the screening pipeline once, automatically, the first time a member
    records consent at the end of onboarding (users/{uid}.screeningConsentAt)."""
    if event.data is None or event.data.after is None:
        return
    before = (event.data.before.to_dict() if event.data.before else None) or {}
    after = event.data.after.to_dict() or {}
    if before.get("screeningConsentAt") or not after.get("screeningConsentAt"):
        return  # only fire the first time consent is newly recorded
    uid = event.params["uid"]
    db = firestore.client()
    ref = db.collection("screenings").document(uid)
    if not _claim_screening(db.transaction(), ref):
        return
    profile = db.collection("profiles").document(uid).get().to_dict() or {}
    name = _text(f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip(), 120)
    if len(name.split(" ")) < 2:
        ref.update({"status": "failed", "error": "Profile has no full name yet.", "finishedAt": firestore.SERVER_TIMESTAMP})
        return
    payload: dict[str, Any] = {"full_name": name}
    location = _text(profile.get("city"), 120)
    if location:
        payload["location"] = location
    age = _age(profile.get("birthdate"))
    if age is not None:
        payload["age_min"] = age
        payload["age_max"] = age
    _run_pipeline_and_write(ref, PersonQuery.model_validate(payload))
