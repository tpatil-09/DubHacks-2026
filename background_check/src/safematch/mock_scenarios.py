"""Build deterministic mock providers from a synthetic scenario file.

Scenario files live under ``tests/fixtures/scenarios/`` and are only ever used
when mock mode is requested explicitly. Evidence produced this way is stamped
``retrieved_via=fixture`` and ``is_test_fixture=true`` so it can never raise a
flag on a live profile (rule R7).

Scenario format::

    {
      "description": "...",
      "query": {PersonQuery},
      "investigator": {InvestigatorLLMOutput} | {"__error__": "message"},
      "verifier": {"by_source_url": {url: {LLMVerification minus ids}},
                   "search_queries_run": [...], "access_failures": [...]} | {"__error__": "..."},
      "synthesizer": {"summaries_by_source_url": {url: "text"}}       (optional),
      "search": {"fail_with": "..."} | {"results": {...}}             (optional),
      "pages": {url: {"status": 200, "text": "..."}}                  (optional),
      "records": [{OfficialRecord minus provider}], "records_error": "..."   (optional),
      "expected": {...}                                               (tests only)
    }
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from .providers.llm import AgentTask, LLMError, MockLLMProvider
from .providers.records import MockRecordsProvider
from .providers.search import MockSearchProvider
from .providers.source_retrieval import FixtureFetcher
from .utils.validation import read_json


def load_scenario(path: Path) -> Dict[str, Any]:
    data = read_json(path)
    if not isinstance(data, dict) or "investigator" not in data:
        raise ValueError(f"{path} is not a valid scenario file")
    return data


def _verifier_responder(spec: Dict[str, Any]):
    by_url = spec.get("by_source_url", {})

    def respond(task: AgentTask) -> Dict[str, Any]:
        results = []
        for f in task.context.get("findings", []):
            r = by_url.get(f["source_url"])
            if r is not None:
                results.append({**r, "finding_id": f["finding_id"], "source_url": f["source_url"]})
        return {
            "results": results,
            "search_queries_run": spec.get("search_queries_run", []),
            "access_failures": spec.get("access_failures", []),
        }

    return respond


def _synth_responder(spec: Dict[str, Any], scenario: Dict[str, Any]):
    by_url = spec.get("summaries_by_source_url", {})
    url_by_claim = {f["claim"]: f["source_url"] for f in scenario.get("investigator", {}).get("findings", [])}

    def respond(task: AgentTask) -> Dict[str, Any]:
        out = []
        for f in task.context.get("findings", []):
            url = url_by_claim.get(f["claim"])
            if url in by_url:
                out.append({"finding_id": f["finding_id"], "summary": by_url[url]})
        resp: Dict[str, Any] = {"summaries": out}
        if spec.get("tldr_headline"):
            resp["tldr_headline"] = spec["tldr_headline"]
        return resp

    return respond


def _stage(spec: Any, responder: Any) -> Any:
    if isinstance(spec, dict) and "__error__" in spec:
        return LLMError(str(spec["__error__"]))
    return responder


def build_mock_providers(scenario: Dict[str, Any]):
    inv = scenario["investigator"]
    ver = scenario.get("verifier", {"by_source_url": {}})
    syn = scenario.get("synthesizer", {})
    llm = MockLLMProvider(
        {
            # A list repeats the error for each retry attempt.
            "investigator": [_stage(inv, inv)] * 3 if "__error__" in inv else inv,
            "verifier": [_stage(ver, None)] * 3 if "__error__" in ver else _verifier_responder(ver),
            "synthesizer": _synth_responder(syn, scenario),
        }
    )
    search_spec: Optional[Dict[str, Any]] = scenario.get("search")
    search = MockSearchProvider(search_spec.get("results"), search_spec.get("fail_with")) if search_spec else None
    fetcher = FixtureFetcher(scenario.get("pages", {}))
    records = []
    if "records" in scenario or "records_error" in scenario:
        records.append(MockRecordsProvider(scenario.get("records"), scenario.get("records_error"), scenario.get("records_provider", "courtlistener")))
    return llm, search, fetcher, records
