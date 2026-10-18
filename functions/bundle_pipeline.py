"""Copy the screening package into this folder so Cloud Functions can import it.

The emulator can import background_check/src directly. A deployed function only
receives the functions/ directory, so deploy runs this first.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SRC = REPO / "background_check" / "src" / "safematch"
SCHEMA = REPO / "background_check" / "config" / "report_schema.json"
DEST_PKG = ROOT / "_pipeline" / "safematch"
DEST_SCHEMA = ROOT / "config" / "report_schema.json"


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"Screening package not found at {SRC}")
    if DEST_PKG.exists():
        shutil.rmtree(DEST_PKG)
    shutil.copytree(SRC, DEST_PKG, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    DEST_SCHEMA.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SCHEMA, DEST_SCHEMA)
    print(f"Bundled screening pipeline into {DEST_PKG.parent}")


if __name__ == "__main__":
    main()
