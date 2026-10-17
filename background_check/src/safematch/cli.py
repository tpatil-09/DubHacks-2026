"""Command-line interface.

    python -m safematch.cli investigator --query-file test_cases/example.json
    python -m safematch.cli verifier --input output/investigator.json
    python -m safematch.cli synthesizer --input output/verifier.json
    python -m safematch.cli run --query-file test_cases/example.json
    python -m safematch.cli validate-report --input output/report.json
    python -m safematch.cli export-schema

Add ``--mock`` (optionally ``--scenario PATH``) to use deterministic fixtures
with no network or model access.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

from pydantic import ValidationError

from .config import PROJECT_ROOT, ConfigError, Settings, load_settings
from .models import InvestigatorResult, PersonQuery, VerifierResult
from .orchestrator import (
    INVESTIGATOR_FILE,
    REPORT_FILE,
    VERIFIER_FILE,
    PipelineError,
    Providers,
    build_live_providers,
    build_mock_providers_from_file,
    run_investigator,
    run_pipeline,
    run_synthesizer,
    run_verifier,
    write_report,
)
from .utils.logging_utils import configure_logging, scrub
from .utils.validation import SCHEMA_PATH, generate_report_schema, read_json, validate_report, write_json_atomic

DEFAULT_SCENARIO = PROJECT_ROOT / "tests" / "fixtures" / "scenarios" / "demo_mixed.json"


def _providers(args: argparse.Namespace, settings: Settings) -> Providers:
    if args.mock or settings.model_provider == "mock":
        scenario = Path(args.scenario) if args.scenario else DEFAULT_SCENARIO
        print(f"[mock mode] using fixture scenario {scenario} — no real searches or model calls", file=sys.stderr)
        return build_mock_providers_from_file(scenario)
    return build_live_providers(settings)


def _out_dir(args: argparse.Namespace, settings: Settings) -> Path:
    return Path(args.output_dir).resolve() if args.output_dir else settings.output_dir


def _load_query(path: str) -> PersonQuery:
    return PersonQuery.model_validate(read_json(Path(path)))


def cmd_investigator(args, settings) -> int:
    p = _providers(args, settings)
    res = run_investigator(_load_query(args.query_file), p, settings)
    path = write_json_atomic(Path(args.out) if args.out else _out_dir(args, settings) / INVESTIGATOR_FILE, res)
    print(json.dumps({"output": str(path), "candidate_findings": len(res.candidate_findings),
                      "sources_checked": len(res.sources_checked), "errors": len(res.retrieval_errors)}, indent=2))
    return 0


def cmd_verifier(args, settings) -> int:
    inv = InvestigatorResult.model_validate(read_json(Path(args.input)))
    p = _providers(args, settings)
    res = run_verifier(inv, p, settings)
    path = write_json_atomic(Path(args.out) if args.out else _out_dir(args, settings) / VERIFIER_FILE, res)
    statuses = {}
    for f in res.findings:
        statuses[f.verification.evidence_status.value] = statuses.get(f.verification.evidence_status.value, 0) + 1
    print(json.dumps({"output": str(path), "results": len(res.findings), "statuses": statuses}, indent=2))
    return 0


def cmd_synthesizer(args, settings) -> int:
    vr = VerifierResult.model_validate(read_json(Path(args.input)))
    p = _providers(args, settings)
    report = run_synthesizer(vr, p)
    path = write_report(report, Path(args.out) if args.out else _out_dir(args, settings) / REPORT_FILE)
    print(json.dumps({"output": str(path), "overall_status": report.overall_status.value,
                      "verified_record_flag": report.safety_indicators.verified_record_flag}, indent=2))
    return 0


def cmd_run(args, settings) -> int:
    p = _providers(args, settings)
    res = run_pipeline(_load_query(args.query_file), p, settings, _out_dir(args, settings), args.report_name)
    print(json.dumps({"report": res["report_path"], "investigator": res["investigator_path"],
                      "verifier": res["verifier_path"], **res["summary"]}, indent=2))
    return 0


def cmd_validate(args, settings) -> int:
    errors = validate_report(read_json(Path(args.input)))
    if errors:
        print(f"INVALID: {args.input}")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"VALID: {args.input} conforms to {SCHEMA_PATH.name}")
    return 0


def cmd_export_schema(args, settings) -> int:
    path = write_json_atomic(Path(args.out) if args.out else SCHEMA_PATH, generate_report_schema())
    print(f"wrote {path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--mock", action="store_true", help="use deterministic fixtures (no network, no model calls)")
    common.add_argument("--scenario", help=f"fixture scenario for --mock (default: {DEFAULT_SCENARIO.relative_to(PROJECT_ROOT)})")
    common.add_argument("--output-dir", help="directory for outputs (default: OUTPUT_DIR or ./output)")
    common.add_argument("-v", "--verbose", action="store_true")

    parser = argparse.ArgumentParser(prog="safematch", description="SafeMatch three-agent public-source background research")
    sub = parser.add_subparsers(dest="command", required=True)

    s = sub.add_parser("investigator", parents=[common], help="run Agent 1 only")
    s.add_argument("--query-file", required=True)
    s.add_argument("--out", help="output file (default: <output-dir>/investigator.json)")
    s.set_defaults(func=cmd_investigator)

    s = sub.add_parser("verifier", parents=[common], help="run Agent 2 on investigator.json")
    s.add_argument("--input", required=True)
    s.add_argument("--out", help="output file (default: <output-dir>/verifier.json)")
    s.set_defaults(func=cmd_verifier)

    s = sub.add_parser("synthesizer", parents=[common], help="run Agent 3 on verifier.json")
    s.add_argument("--input", required=True)
    s.add_argument("--out", help="output file (default: <output-dir>/report.json)")
    s.set_defaults(func=cmd_synthesizer)

    s = sub.add_parser("run", parents=[common], help="run the full pipeline")
    s.add_argument("--query-file", required=True)
    s.add_argument("--report-name", default=REPORT_FILE)
    s.set_defaults(func=cmd_run)

    s = sub.add_parser("validate-report", parents=[common], help="validate a report.json against the fixed schema")
    s.add_argument("--input", required=True)
    s.set_defaults(func=cmd_validate)

    s = sub.add_parser("export-schema", parents=[common], help="regenerate config/report_schema.json from the models")
    s.add_argument("--out")
    s.set_defaults(func=cmd_export_schema)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    configure_logging(args.verbose)
    try:
        settings = load_settings()
        return args.func(args, settings)
    except (ConfigError, PipelineError) as exc:
        print(f"error: {scrub(str(exc))}", file=sys.stderr)
        return 2
    except ValidationError as exc:
        print(f"error: invalid input: {scrub(str(exc))[:1500]}", file=sys.stderr)
        return 2
    except FileNotFoundError as exc:
        print(f"error: file not found: {exc.filename}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
