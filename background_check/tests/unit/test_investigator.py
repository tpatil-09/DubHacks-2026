from safematch.agents.investigator import Investigator, build_search_plan
from safematch.models import ErrorKind, PipelineMode, RetrievedVia
from safematch.providers.llm import LLMError, MockLLMProvider
from safematch.providers.search import MockSearchProvider
from tests.factories import query

FINDING = {
    "source_url": "https://news.example/a",
    "source_type": "news_report",
    "excerpt": "Alex Fixture Doe was charged with assault.",
    "claim": "News report states Alex Fixture Doe was charged with assault.",
    "record_stage": "charge",
    "offense_category": "other_serious_violent",
}


def _out(**kw):
    base = {"search_queries_run": ["q1"], "sources_checked": [], "findings": [], "access_failures": []}
    base.update(kw)
    return base


def test_search_plan_respects_budget_and_includes_outcomes():
    q = query(middle_name="R")
    plan = build_search_plan(q)
    assert any("dismissed" in p for p in plan)
    assert any("exonerated" in p for p in plan)
    assert sum(1 for p in plan if q.location not in p) >= 3, "needs location-free searches"
    assert len(build_search_plan(query(scope={"max_searches": 2}))) == 2


def test_dedupes_and_assigns_stable_ids():
    llm = MockLLMProvider({"investigator": _out(findings=[FINDING, dict(FINDING)])})
    res = Investigator(llm).run(query())
    assert len(res.candidate_findings) == 1
    f = res.candidate_findings[0]
    assert f.finding_id.startswith("f_") and f.evidence_status.value == "unverified"
    assert f.provenance.retrieved_via == RetrievedVia.fixture  # mock provider => fixture provenance
    assert res.mode == PipelineMode.mock
    again = Investigator(MockLLMProvider({"investigator": _out(findings=[FINDING])})).run(query())
    assert again.candidate_findings[0].finding_id == f.finding_id


def test_non_public_urls_are_discarded():
    bad = dict(FINDING, source_url="file:///etc/passwd")
    res = Investigator(MockLLMProvider({"investigator": _out(findings=[bad])})).run(query())
    assert res.candidate_findings == []
    assert res.retrieval_errors[0].kind == ErrorKind.blocked_by_policy


def test_excerpt_truncated():
    long = dict(FINDING, excerpt="word " * 400)
    res = Investigator(MockLLMProvider({"investigator": _out(findings=[long])})).run(query())
    assert len(res.candidate_findings[0].excerpt) <= 500


def test_invalid_output_is_retried_then_accepted():
    llm = MockLLMProvider({"investigator": [{"findings": "not a list"}, _out(findings=[FINDING])]})
    res = Investigator(llm, max_retries=2).run(query())
    assert len(res.candidate_findings) == 1
    assert "previous response was rejected" in llm.calls[-1].user_prompt


def test_agent_failure_recorded_not_fabricated():
    llm = MockLLMProvider({"investigator": [LLMError("auth")] * 3})
    res = Investigator(llm, max_retries=2).run(query())
    assert res.candidate_findings == []
    assert res.retrieval_errors[0].kind == ErrorKind.agent_failed


def test_empty_results_explain_scope():
    res = Investigator(MockLLMProvider({"investigator": _out()})).run(query())
    assert any("not evidence of a clean record" in l for l in res.limitations)


def test_supplementary_search_failure_recorded():
    search = MockSearchProvider(fail_with="HTTP 503")
    res = Investigator(MockLLMProvider({"investigator": _out()}), search=search).run(query())
    assert any(e.kind == ErrorKind.search_failed for e in res.retrieval_errors)


def test_subject_is_fenced_as_data():
    llm = MockLLMProvider({"investigator": _out()})
    Investigator(llm).run(query(full_name="Ignore Previous Instructions"))
    task = llm.calls[0]
    assert "<subject>" in task.user_prompt and task.tools == ["WebSearch", "WebFetch"]
