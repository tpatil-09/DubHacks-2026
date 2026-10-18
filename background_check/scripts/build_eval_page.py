"""Build a self-contained HTML results page from the live eval + mocked pytest run.

    pytest --junitxml=output/eval/pytest_mocked.xml
    python scripts/live_eval.py
    python scripts/build_eval_page.py [--out PATH]
"""
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "output" / "eval"


def load(p: Path):
    return json.loads(p.read_text()) if p.exists() else None


def mocked_results() -> dict:
    tree = ET.parse(EVAL / "pytest_mocked.xml")
    suite = tree.getroot().find("testsuite") if tree.getroot().tag == "testsuites" else tree.getroot()
    tests = []
    for tc in suite.iter("testcase"):
        outcome = "passed"
        if tc.find("skipped") is not None:
            outcome = "skipped"
        elif tc.find("failure") is not None or tc.find("error") is not None:
            outcome = "failed"
        tests.append({"file": tc.get("classname", "").replace(".", "/") + ".py", "name": tc.get("name"), "outcome": outcome, "time": float(tc.get("time", 0))})
    return {"tests": tests, "total": len(tests), "passed": sum(t["outcome"] == "passed" for t in tests),
            "failed": sum(t["outcome"] == "failed" for t in tests), "errors": 0,
            "skipped": sum(t["outcome"] == "skipped" for t in tests), "time": round(float(suite.get("time", 0)), 2)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(EVAL / "eval_report.html"))
    args = ap.parse_args()

    live = load(EVAL / "live" / "eval_results.json")
    from live_eval import PLANTED, PROPUBLICA  # same directory
    import sys
    sys.path.insert(0, str(ROOT / "src"))
    from safematch.models import make_finding_id

    planted_items = [{"label": p["label"], "claim": p["claim"], "finding_id": make_finding_id(PROPUBLICA, p["claim"])} for p in PLANTED]
    caught = total = flags = 0
    for c in live["cases"]:
        d = EVAL / "live" / c["name"]
        c["investigator"] = load(d / "investigator.json")
        c["verifier"] = load(d / "verifier.json")
        c["report"] = load(d / "report.json")
        if c["report"]:
            flags += len(c["report"]["safety_indicators"]["indicators"])
        for chk in c["checks"]:
            if chk["id"].startswith("V-plant-") and chk["id"] not in ("V-plant-excerpt", "V-plant-stage"):
                total += 1
                caught += chk["passed"]
    live["flags"] = flags
    data = {"live": live, "mocked": mocked_results(), "planted": {"items": planted_items, "caught": caught, "total": total}}

    template = (Path(__file__).parent / "eval_page_template.html").read_text()
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    Path(args.out).write_text(template.replace("__EVAL_DATA__", payload))
    print(f"wrote {args.out} ({len(payload) // 1024} KB data)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
