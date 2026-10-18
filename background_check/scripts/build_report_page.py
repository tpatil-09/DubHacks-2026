"""Render a report.json as a self-contained, human-readable HTML page.

    python scripts/build_report_page.py --input output/report.full.json --out output/report.html
"""
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    report = json.loads(Path(args.input).read_text())
    name = report["report_metadata"]["subject"]["full_name"]
    template = (Path(__file__).parent / "report_page_template.html").read_text()
    page = template.replace("__PAGE_TITLE__", html.escape(f"{name} Screening Report")).replace(
        "__REPORT_DATA__", json.dumps(report, ensure_ascii=False).replace("</", "<\\/")
    )
    Path(args.out).write_text(page)
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
