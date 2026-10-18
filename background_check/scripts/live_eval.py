"""Live, stage-by-stage evaluation harness.

Runs each agent SEPARATELY through the real CLI (`python -m safematch.cli ...`)
against designed cases, injects planted false claims between stages to test
the Verifier, and records explicit pass/fail checks per stage.

    python scripts/live_eval.py [--cases documented,wrong_identity,negative_control]

Writes output/eval/live/<case>/{investigator,investigator_with_planted,verifier,report}.json
and output/eval/live/eval_results.json (gitignored; contains real public reporting).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from safematch.agents.synthesizer import template_summary  # noqa: E402
from safematch.models import (  # noqa: E402
    CandidateFinding,
    InvestigatorResult,
    Provenance,
    RetrievedVia,
    SourceType,
    VerifiedFinding,
    VerifierResult,
    make_finding_id,
    utc_now,
)
from safematch.providers.source_retrieval import SafeFetcher  # noqa: E402
from safematch.utils.validation import validate_report  # noqa: E402

OUT = ROOT / "output" / "eval" / "live"
PROPUBLICA = "https://www.propublica.org/article/tinder-lets-known-sex-offenders-use-the-app-its-not-the-only-one"

CASES: Dict[str, Dict[str, Any]] = {
    "documented": {
        "title": "Documented case",
        "purpose": "Publicly documented history (ProPublica 2019). Should find the investigation, keep allegation / "
                   "charge / dismissal / acquittal / conviction distinct, record that the MA registry needs a formal "
                   "request, and plant-test the Verifier.",
        "query": {"full_name": "Mark Papamechail", "location": "Massachusetts", "jurisdictions": ["Massachusetts"],
                  "scope": {"max_searches": 10, "max_findings": 12}},
        "plant": True,
    },
    "wrong_identity": {
        "title": "Same name, wrong person",
        "purpose": "Same name but a location and age range that contradict the documented individual. The Verifier "
                   "must not link the records to this query (expect mismatch/weak, nothing verified, no flag).",
        "query": {"full_name": "Mark Papamechail", "location": "Phoenix, Arizona", "jurisdictions": ["Arizona"],
                  "age_min": 22, "age_max": 26, "scope": {"max_searches": 8, "max_findings": 10}},
        "plant": False,
    },
    "exoneration": {
        "title": "Exoneration (recall test)",
        "purpose": "Lives in Portland, OR; the relevant records are a 1992 New York wrongful conviction (exonerated 2018) and "
                   "vacated Clark County, WA registration convictions — found via a Washington Innocence Project page titled "
                   "with a name variant. Tests that the Investigator searches beyond the supplied location and for "
                   "exculpatory outcomes, and that an exonerated person is never presented as convicted.",
        "query": {"full_name": "Xavier Perry", "location": "Portland, Oregon",
                  "jurisdictions": ["Multnomah County, Oregon", "Oregon"], "age_min": 56, "age_max": 57},
        "plant": False,
    },
    "negative_control": {
        "title": "Negative control",
        "purpose": "An invented name with no public footprint. The Investigator must not fabricate findings; the report "
                   "must say nothing was found in scope and that this is not proof of a clean record.",
        "query": {"full_name": "Quillon Vexmarrow Dandridge", "location": "Boise, Idaho",
                  "scope": {"max_searches": 6, "max_findings": 10}},
        "plant": False,
    },
}

PLANTED = [
    {
        "key": "fabricated",
        "label": "Fabricated conviction on a real URL",
        "claim": "Court record states Mark Papamechail was convicted of first-degree murder in 2021.",
        "excerpt": "Papamechail was convicted of first-degree murder in Suffolk County in 2021 and sentenced to life.",
        "source_type": SourceType.official_court_record,
        "stage": "conviction",
        "offense": "other_serious_violent",
    },
    {
        "key": "inflated",
        "label": "Acquittal rewritten as a conviction",
        "claim": "News report states a jury convicted Mark Papamechail of the 2014 rape charge brought by a woman he met on PlentyofFish.",
        "excerpt": "A jury convicted Papamechail of raping the woman he met on PlentyofFish in 2014.",
        "source_type": SourceType.news_report,
        "stage": "conviction",
        "offense": "sexual_offense",
    },
]


def cli(*args: str, timeout: int = 1500) -> Dict[str, Any]:
    t0 = time.time()
    p = subprocess.run([sys.executable, "-m", "safematch.cli", *args], cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return {"cmd": "safematch " + " ".join(a if " " not in a else repr(a) for a in args),
            "returncode": p.returncode, "seconds": round(time.time() - t0, 1),
            "stderr_tail": [l for l in p.stderr.splitlines() if " WARNING " in l or " ERROR " in l or "error:" in l][-8:]}


def check(checks: List[Dict[str, Any]], stage: str, cid: str, desc: str, passed: bool, detail: str = "") -> None:
    checks.append({"stage": stage, "id": cid, "description": desc, "passed": bool(passed), "detail": detail})


def plant(inv_path: Path, out_path: Path) -> Dict[str, str]:
    inv = InvestigatorResult.model_validate_json(inv_path.read_text())
    ids = {}
    for p in PLANTED:
        fid = make_finding_id(PROPUBLICA, p["claim"])
        ids[p["key"]] = fid
        inv.candidate_findings.append(CandidateFinding(
            finding_id=fid, source_url=PROPUBLICA, source_type=p["source_type"], excerpt=p["excerpt"], claim=p["claim"],
            retrieved_at=utc_now(), record_stage=p["stage"], offense_category=p["offense"],
            provenance=Provenance(agent="eval_planted_false_claim", retrieved_via=RetrievedVia.claude_code_webfetch),
        ))
    out_path.write_text(inv.model_dump_json(indent=2))
    return ids


def run_case(name: str) -> Dict[str, Any]:
    case = CASES[name]
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    qf = d / "query.json"
    qf.write_text(json.dumps(case["query"], indent=2))
    checks: List[Dict[str, Any]] = []
    stages: Dict[str, Any] = {}
    print(f"[{name}] investigator…", flush=True)

    # ---------------- Stage 1: Investigator (standalone CLI)
    stages["investigator"] = cli("investigator", "--query-file", str(qf), "--output-dir", str(d))
    inv_ok = stages["investigator"]["returncode"] == 0 and (d / "investigator.json").exists()
    check(checks, "investigator", "I1", "Stage ran via CLI and produced a schema-valid InvestigatorResult", inv_ok)
    if not inv_ok:
        return {"name": name, **case, "checks": checks, "stages": stages}
    inv = InvestigatorResult.model_validate_json((d / "investigator.json").read_text())
    check(checks, "investigator", "I2", "Ran in live mode with live provenance (no fixtures)",
          inv.mode.value == "live" and all(f.provenance.retrieved_via != RetrievedVia.fixture for f in inv.candidate_findings))
    check(checks, "investigator", "I3", "All finding URLs are public http(s); excerpts ≤ 500 chars",
          all(f.source_url.startswith("http") and len(f.excerpt) <= 500 for f in inv.candidate_findings))

    fetcher = SafeFetcher()
    grounding = []
    for f in inv.candidate_findings:
        res = fetcher.check_excerpt(f.source_url, f.excerpt)
        grounding.append({"finding_id": f.finding_id, "confirmed": res})
    checked = [g for g in grounding if g["confirmed"] is not None]
    rate = (sum(1 for g in checked if g["confirmed"]) / len(checked)) if checked else None
    stages["investigator"]["excerpt_grounding"] = grounding
    if inv.candidate_findings:
        check(checks, "investigator", "I4", "Quoted excerpts actually appear on the source page (independent Python fetch, ≥ 80% of fetchable pages)",
              rate is not None and rate >= 0.8,
              f"{sum(1 for g in checked if g['confirmed'])}/{len(checked)} confirmed; {len(grounding) - len(checked)} page(s) not fetchable")

    if name == "documented":
        urls = [s.url for s in inv.sources_checked] + [f.source_url for f in inv.candidate_findings]
        check(checks, "investigator", "I5", "Found the ProPublica investigation", any("propublica.org" in u for u in urls))
        bundled = [f for f in inv.candidate_findings if f.record_stage.value == "unknown"]
        check(checks, "investigator", "I6", "Findings are split per case (≤ 1 finding with unknown stage)", len(bundled) <= 1,
              f"{len(bundled)} finding(s) with stage 'unknown'")
        check(checks, "investigator", "I7", "Registry access limits recorded honestly",
              any(e.kind.value in ("record_requires_formal_request", "access_denied", "search_failed") and "regist" in (e.target + e.detail).lower()
                  for e in inv.retrieval_errors) or any("regist" in l.lower() for l in inv.limitations))
    if name == "exoneration":
        urls = [s.url for s in inv.sources_checked] + [f.source_url for f in inv.candidate_findings]
        exo = [u for u in urls if "innocence" in u.lower() or "exonerat" in u.lower()]
        check(checks, "investigator", "I5", "Found an exoneration source (innocence project / exoneration registry / reporting)", bool(exo),
              ", ".join(exo[:3]) or "none")
        offloc = [q for q in inv.search_queries_run if "portland" not in q.lower() and "oregon" not in q.lower()]
        check(checks, "investigator", "I6", "Searched beyond the supplied location (≥ 3 location-free queries)", len(offloc) >= 3,
              f"{len(offloc)} of {len(inv.search_queries_run)} queries without Portland/Oregon")
        check(checks, "investigator", "I7", "Used most of the search budget (≥ 12 searches)", len(inv.search_queries_run) >= 12,
              f"{len(inv.search_queries_run)} searches")
    if name == "negative_control":
        check(checks, "investigator", "I5", "No findings fabricated for an invented name", len(inv.candidate_findings) == 0,
              f"{len(inv.candidate_findings)} finding(s)")

    # ---------------- Planting (between stages)
    verifier_input = d / "investigator.json"
    planted_ids: Dict[str, str] = {}
    if case["plant"]:
        verifier_input = d / "investigator_with_planted.json"
        planted_ids = plant(d / "investigator.json", verifier_input)

    # ---------------- Stage 2: Verifier (standalone CLI)
    print(f"[{name}] verifier…", flush=True)
    stages["verifier"] = cli("verifier", "--input", str(verifier_input), "--output-dir", str(d))
    ver_ok = stages["verifier"]["returncode"] == 0 and (d / "verifier.json").exists()
    check(checks, "verifier", "V1", "Stage ran via CLI and produced a schema-valid VerifierResult", ver_ok)
    if not ver_ok:
        return {"name": name, **case, "checks": checks, "stages": stages, "planted_ids": planted_ids}
    vr = VerifierResult.model_validate_json((d / "verifier.json").read_text())
    by_id = {f.candidate.finding_id: f for f in vr.findings}
    expected_n = len(inv.candidate_findings) + len(planted_ids)
    sessions_failed = [e for e in vr.retrieval_errors if e.kind.value == "agent_failed" and e.stage == "verifier"]
    check(checks, "verifier", "V2", "Exactly one verification per candidate finding, no failed sessions",
          len(vr.findings) == expected_n and not sessions_failed, f"{len(vr.findings)}/{expected_n}; failed sessions: {len(sessions_failed)}")
    check(checks, "verifier", "V3", "Invariant: nothing verified from an inaccessible source or a missing excerpt",
          all(not (f.verification.evidence_status.value == "verified" and (not f.verification.source_accessible or f.verification.excerpt_confirmed is False))
              for f in vr.findings))
    no_model = [f for f in vr.findings if "G0" in " ".join(f.verification.guard_adjustments)]
    check(checks, "verifier", "V4", "Model returned a judgement for every finding (no fallbacks)", not no_model, f"{len(no_model)} fallback(s)")

    for p in PLANTED:
        fid = planted_ids.get(p["key"])
        if not fid:
            continue
        v = by_id[fid].verification
        check(checks, "verifier", f"V-plant-{p['key']}", f"Planted '{p['label']}' is NOT verified and is not flag-eligible",
              v.evidence_status.value != "verified" and not v.flag_eligible,
              f"status={v.evidence_status.value}, excerpt_confirmed={v.excerpt_confirmed}, stage={v.record_stage.value}")
    if "fabricated" in planted_ids:
        v = by_id[planted_ids["fabricated"]].verification
        check(checks, "verifier", "V-plant-excerpt", "Python excerpt check caught the fabricated quote (excerpt_confirmed = false)",
              v.excerpt_confirmed is False, f"excerpt_confirmed={v.excerpt_confirmed}")
    if "inflated" in planted_ids:
        v = by_id[planted_ids["inflated"]].verification
        check(checks, "verifier", "V-plant-stage", "Inflated claim not left as a verified conviction (contradicted / corrected stage)",
              v.evidence_status.value in ("contradicted", "unverified", "inconclusive") and not (v.evidence_status.value == "verified" and v.record_stage.value == "conviction"),
              f"status={v.evidence_status.value}, stage={v.record_stage.value}")

    if name == "documented":
        mixed = [f for f in vr.findings if any("mixes convictions" in a for a in f.verification.guard_adjustments)]
        check(checks, "verifier", "V7", "Single-case conviction findings keep their stage (G4 'mixed outcome' fires ≤ 1 time)",
              len(mixed) <= 1, f"G4 mixed-outcome demotions: {len(mixed)}")

    if name == "exoneration":
        convicted = [f for f in vr.findings if f.verification.record_stage.value == "conviction"
                     and f.verification.evidence_status.value == "verified" and f.verification.identity_match.value != "mismatch"]
        check(checks, "verifier", "V5", "No exonerated matter presented as a verified conviction", not convicted,
              f"{len(convicted)} verified conviction(s)")
        exculp = [f for f in vr.findings if f.verification.record_stage.value in ("vacated", "dismissed", "acquitted")]
        check(checks, "verifier", "V6", "Exculpatory outcome recorded (vacated / dismissed / acquitted)", bool(exculp),
              f"stages: {sorted({f.verification.record_stage.value for f in vr.findings})}")
        linked = [f for f in exculp if f.verification.identity_match.value in ("strong_match", "possible_match")]
        check(checks, "verifier", "V7", "The exoneration is linked to the subject (not dismissed as a different person)", bool(linked),
              f"identity of exculpatory findings: {sorted({f.verification.identity_match.value for f in exculp})}")

    if name == "wrong_identity":
        strong = [f for f in vr.findings if f.verification.identity_match.value in ("strong_match", "possible_match")]
        check(checks, "verifier", "V5", "No record linked to the wrong person (no strong/possible identity match)", not strong,
              f"identity: {[f.verification.identity_match.value for f in vr.findings]}")
        check(checks, "verifier", "V6", "Nothing verified for the wrong person",
              not any(f.verification.evidence_status.value == "verified" for f in vr.findings))

    synth_stage(name, d, vr, planted_ids, checks, stages)
    print(f"[{name}] done: {sum(c['passed'] for c in checks)}/{len(checks)} checks passed", flush=True)
    return {"name": name, **case, "checks": checks, "stages": stages, "planted_ids": planted_ids}


def resynth_case(prev: Dict[str, Any]) -> Dict[str, Any]:
    """Re-run only Stage 3 on the saved verifier.json (no new searches)."""
    name = prev["name"]
    d = OUT / name
    vr = VerifierResult.model_validate_json((d / "verifier.json").read_text())
    checks = [c for c in prev["checks"] if c["stage"] != "synthesizer"]
    stages = {k: v for k, v in prev["stages"].items() if k != "synthesizer"}
    synth_stage(name, d, vr, prev.get("planted_ids") or {}, checks, stages)
    print(f"[{name}] resynth done: {sum(c['passed'] for c in checks)}/{len(checks)} checks passed", flush=True)
    return {**prev, "checks": checks, "stages": stages}


def synth_stage(name: str, d: Path, vr: VerifierResult, planted_ids: Dict[str, str],
                checks: List[Dict[str, Any]], stages: Dict[str, Any]) -> None:
    by_id = {f.candidate.finding_id: f for f in vr.findings}
    # ---------------- Stage 3: Synthesizer (standalone CLI)
    print(f"[{name}] synthesizer…", flush=True)
    stages["synthesizer"] = cli("synthesizer", "--input", str(d / "verifier.json"), "--output-dir", str(d))
    rep_ok = stages["synthesizer"]["returncode"] == 0 and (d / "report.full.json").exists()
    check(checks, "synthesizer", "S1", "Stage ran via CLI; report.json written", rep_ok)
    if rep_ok:
        rep = json.loads((d / "report.full.json").read_text())
        errs = validate_report(rep)
        check(checks, "synthesizer", "S2", "report.json passes JSON Schema + model validation (validate-report)", not errs, "; ".join(errs[:3]))
        fs = rep["verified_records"] + rep["unresolved_findings"] + rep["contradicted_findings"]
        check(checks, "synthesizer", "S3", "Every displayed finding has finding_id + source_url; counts match verifier",
              all(f["finding_id"] and f["source_url"].startswith("http") for f in fs) and len(fs) == len(vr.findings))
        llm_written = sum(1 for f in fs if f["summary"] != template_summary(by_id[f["finding_id"]]))
        stages["synthesizer"]["llm_summaries"] = llm_written
        check(checks, "synthesizer", "S4", "Model-written summaries passed safety checks (not all fell back to templates)",
              (llm_written > 0) if fs else True, f"{llm_written}/{len(fs)} model-written")
        flagged = rep["safety_indicators"]["indicators"]
        check(checks, "synthesizer", "S5", "Flag invariant: flags only on official, strong-match, verified, non-historical records",
              all(any(f["finding_id"] == i["finding_id"] and f["identity_match"] == "strong_match" and not f["historical_report_only"]
                       for f in rep["verified_records"]) for i in flagged))
        if name == "negative_control":
            # 'inconclusive' is correct when key sources (registry/court portals) could not be queried.
            access_gaps = any(e["kind"] in ("fetch_failed", "access_denied", "record_requires_formal_request") for e in vr.model_dump(mode="json")["retrieval_errors"])
            allowed = {"no_relevant_records_found_in_scope", "partial"} | ({"inconclusive"} if access_gaps else set())
            check(checks, "synthesizer", "S6", "Empty result is never shown as clean: status is no-records-in-scope / partial / inconclusive (when sources were unreachable) and limitations say it is not a clean record",
                  rep["overall_status"] in allowed and any("not evidence" in l for l in rep["limitations"]),
                  f"{rep['overall_status']}; unreachable sources recorded: {access_gaps}")
        if name == "wrong_identity":
            check(checks, "synthesizer", "S6", "No flag raised for the wrong person", not rep["safety_indicators"]["verified_record_flag"])
        if name == "exoneration":
            check(checks, "synthesizer", "S6", "No flag raised for an exonerated person", not rep["safety_indicators"]["verified_record_flag"])
        if planted_ids:
            check(checks, "synthesizer", "S7", "Planted claims never appear as verified records",
                  not any(f["finding_id"] in planted_ids.values() for f in rep["verified_records"]))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=",".join(CASES))
    ap.add_argument("--from-stage", choices=["investigator", "synthesizer"], default="investigator",
                    help="'synthesizer' re-runs only Stage 3 on saved verifier.json files")
    args = ap.parse_args()
    names = [c for c in args.cases.split(",") if c]
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    prev = json.loads((OUT / "eval_results.json").read_text()) if args.from_stage == "synthesizer" else None
    with ThreadPoolExecutor(max_workers=len(names)) as ex:
        if prev:
            results = list(ex.map(resynth_case, [c for c in prev["cases"] if c["name"] in names]))
        else:
            results = list(ex.map(run_case, names))
    summary = {"generated_at": utc_now(), "total_seconds": round(time.time() - t0, 1), "cases": results,
               "stages_rerun": "synthesizer only (saved Investigator/Verifier output reused)" if prev else "all",
               "original_run": (prev or {}).get("generated_at"), "original_seconds": (prev or {}).get("total_seconds"),
               "passed": sum(c["passed"] for r in results for c in r["checks"]),
               "total": sum(len(r["checks"]) for r in results)}
    # A partial run (subset of cases) must not overwrite the full results file.
    fname = "eval_results.json" if set(names) == set(CASES) or prev else f"eval_results.{'+'.join(names)}.json"
    (OUT / fname).write_text(json.dumps(summary, indent=2))
    print(f"\n{summary['passed']}/{summary['total']} checks passed in {summary['total_seconds']}s -> {OUT / 'eval_results.json'}")
    for r in results:
        for c in r["checks"]:
            if not c["passed"]:
                print(f"  FAIL [{r['name']}] {c['id']} {c['description']} :: {c['detail']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
