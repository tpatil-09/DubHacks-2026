"""Pipeline orchestration: Investigator → Verifier → Synthesizer → validated report.json."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .agents.investigator import Investigator
from .agents.synthesizer import Synthesizer
from .agents.verifier import Verifier
from .config import Settings
from .frontend_contract import to_frontend_report, validate_frontend_report
from .models import FinalReport, InvestigatorResult, PersonQuery, PipelineMode, RetrievedVia, VerifierResult
from .providers.llm import ClaudeCLIProvider, LLMProvider
from .providers.records import CheckrTrustProvider, CourtListenerProvider, RecordsProvider
from .providers.search import SearchProvider, TavilySearchProvider
from .providers.source_retrieval import SafeFetcher
from .utils.logging_utils import get_logger, register_secrets
from .utils.validation import validate_report, write_json_atomic

log = get_logger("orchestrator")

INVESTIGATOR_FILE = "investigator.json"
VERIFIER_FILE = "verifier.json"
REPORT_FILE = "report.json"


class PipelineError(RuntimeError):
    pass


@dataclass
class Providers:
    llm: LLMProvider
    search: Optional[SearchProvider] = None
    fetcher: Any = None  # ExcerptChecker
    records: List[RecordsProvider] = field(default_factory=list)

    @property
    def mode(self) -> PipelineMode:
        return PipelineMode.mock if self.llm.is_mock else PipelineMode.live


def build_live_providers(settings: Settings) -> Providers:
    settings.require_live_credentials()
    register_secrets(settings.secret_values())
    llm = ClaudeCLIProvider(
        oauth_token=settings.claude_code_oauth_token or "",
        cli_path=settings.claude_cli_path,
        model=settings.model_name,
        timeout_seconds=settings.agent_timeout_seconds,
    )
    search = TavilySearchProvider(settings.tavily_api_key or "") if settings.search_provider == "tavily" else None
    fetcher = SafeFetcher() if settings.verify_excerpts_with_fetch else None
    records: List[RecordsProvider] = []
    if "courtlistener" in settings.records_providers:
        records.append(CourtListenerProvider(token=settings.courtlistener_api_token))
    if "checkr_trust" in settings.records_providers:
        records.append(CheckrTrustProvider(settings.checkr_trust_client_id or "", settings.checkr_trust_client_secret or "",
                                           base_url=settings.checkr_trust_base_url))
    return Providers(llm=llm, search=search, fetcher=fetcher, records=records)


def build_mock_providers_from_file(scenario_path: Path) -> Providers:
    from .mock_scenarios import build_mock_providers, load_scenario

    llm, search, fetcher, records = build_mock_providers(load_scenario(scenario_path))
    return Providers(llm=llm, search=search, fetcher=fetcher, records=records)


def _search_name(p: Providers) -> str:
    if p.mode == PipelineMode.mock:
        return "fixture"
    return "claude_code_websearch" + ("+tavily" if p.search else "")


def run_investigator(query: PersonQuery, p: Providers, settings: Settings) -> InvestigatorResult:
    return Investigator(p.llm, p.search, settings.llm_max_retries, settings.agent_timeout_seconds, records=p.records).run(query)


def run_verifier(inv: InvestigatorResult, p: Providers, settings: Settings) -> VerifierResult:
    _check_mode(inv.mode, p, "investigator")
    return Verifier(p.llm, p.fetcher, settings.llm_max_retries, settings.agent_timeout_seconds).run(inv)


def run_synthesizer(vr: VerifierResult, p: Providers) -> FinalReport:
    _check_mode(vr.mode, p, "verifier")
    return Synthesizer(p.llm, search_provider_name=_search_name(p)).run(vr)


def _check_mode(input_mode: PipelineMode, p: Providers, stage: str) -> None:
    """Never mix fixture evidence into a live run (and vice versa)."""
    if input_mode != p.mode:
        raise PipelineError(
            f"{stage} output was produced in {input_mode.value} mode but this run is {p.mode.value}; "
            "rerun the earlier stage in the same mode."
        )


def full_report_path(path: Path) -> Path:
    """report.json -> report.full.json (the detailed FinalReport kept next to the frontend report)."""
    path = Path(path)
    return path.with_name(f"{path.stem}.full{path.suffix or '.json'}")


def write_report(report: FinalReport, path: Path) -> Path:
    """Write the frontend report.json (claude.md section 7 contract) and the detailed report.full.json.

    Both are validated before either file is written.
    """
    full = report.model_dump(mode="json")
    frontend = to_frontend_report(report)
    errors = validate_report(full) + validate_frontend_report(frontend)
    if errors:
        raise PipelineError("final report failed schema validation: " + "; ".join(errors[:5]))
    write_json_atomic(full_report_path(path), full)
    return write_json_atomic(path, frontend)


def run_pipeline(
    query: PersonQuery,
    providers: Providers,
    settings: Settings,
    output_dir: Optional[Path] = None,
    report_name: str = REPORT_FILE,
) -> Dict[str, Any]:
    """Run all three agents, persist each stage, and return paths plus a summary."""
    out = Path(output_dir or settings.output_dir)
    query = PersonQuery.model_validate(query.model_dump())  # re-validate

    log.info("pipeline start (%s mode)", providers.mode.value)
    inv = run_investigator(query, providers, settings)
    if providers.mode == PipelineMode.live and any(
        f.provenance.retrieved_via == RetrievedVia.fixture for f in inv.candidate_findings
    ):
        raise PipelineError("fixture evidence detected in a live run; aborting")
    inv_path = write_json_atomic(out / INVESTIGATOR_FILE, inv)

    vr = run_verifier(inv, providers, settings)
    ver_path = write_json_atomic(out / VERIFIER_FILE, vr)

    report = run_synthesizer(vr, providers)
    report_path = write_report(report, out / report_name)

    summary = {
        "mode": providers.mode.value,
        "overall_status": report.overall_status.value,
        "verified_record_flag": report.safety_indicators.verified_record_flag,
        "verified_records": len(report.verified_records),
        "unresolved_findings": len(report.unresolved_findings),
        "contradicted_findings": len(report.contradicted_findings),
        "sources_checked": report.source_summary.total_sources_checked,
        "errors": len(vr.retrieval_errors),
    }
    log.info("pipeline done: %s", summary)
    return {
        "report_path": str(report_path),
        "full_report_path": str(full_report_path(report_path)),
        "investigator_path": str(inv_path),
        "verifier_path": str(ver_path),
        "summary": summary,
        "report": report,
    }
