"""Report schema export/validation and atomic JSON persistence."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List

import jsonschema
from pydantic import BaseModel, ValidationError

from ..config import PROJECT_ROOT
from ..models import SCHEMA_VERSION, FinalReport

SCHEMA_PATH = PROJECT_ROOT / "config" / "report_schema.json"


def generate_report_schema() -> Dict[str, Any]:
    schema = FinalReport.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = f"https://safematch.local/schemas/report-{SCHEMA_VERSION}.json"
    schema["title"] = "Havenly Background Check Report"
    return schema


def load_report_schema(path: Path = SCHEMA_PATH) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_report(data: Dict[str, Any], schema_path: Path = SCHEMA_PATH) -> List[str]:
    """Validate against the committed JSON Schema AND the Pydantic model. Returns error strings."""
    errors: List[str] = []
    validator = jsonschema.Draft202012Validator(load_report_schema(schema_path))
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "<root>"
        errors.append(f"schema: {loc}: {err.message[:300]}")
    try:
        FinalReport.model_validate(data)
    except ValidationError as exc:
        errors += [f"model: {'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()[:20]]
    return errors


def write_json_atomic(path: Path, payload: Any) -> Path:
    """Write JSON to ``path`` atomically (temp file in the same dir + os.replace)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return path


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))
