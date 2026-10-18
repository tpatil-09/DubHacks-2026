import pytest

from safematch.models import EvidenceRef, RetrievedVia, SourceType
from safematch.rules.safety_flags import build_indicator, evaluate
from tests.factories import candidate, verification


def failures_for(**kw):
    c_kw = {k[2:]: v for k, v in kw.items() if k.startswith("c_")}
    v_kw = {k: v for k, v in kw.items() if not k.startswith("c_")}
    c = candidate(**c_kw)
    return evaluate(c, verification(c, **v_kw))


def test_verified_official_conviction_is_flagged():
    out = failures_for()
    assert out.eligible and out.rule_id == "VR1_SERIOUS_VIOLENT_CONVICTION"
    c = candidate()
    ind = build_indicator(c, verification(c), out)
    assert ind.label == "Verified record requiring attention"
    assert ind.source_url == c.source_url


@pytest.mark.parametrize(
    "kw, rule",
    [
        ({"c_source_type": SourceType.news_report, "supporting_evidence": [{"url": "https://news.example/a", "source_type": "news_report"}]}, "R1"),
        ({"source_reliability": "medium"}, "R1"),
        ({"identity_match": "possible_match"}, "R2"),
        ({"identity_match": "weak_match"}, "R2"),
        ({"identity_match": "mismatch"}, "R2"),
        ({"evidence_status": "unverified"}, "R3"),
        ({"evidence_status": "inconclusive"}, "R3"),
        ({"record_stage": "allegation"}, "R4"),
        ({"record_stage": "arrest"}, "R4"),
        ({"record_stage": "charge"}, "R4"),
        ({"record_stage": "dismissed"}, "R4"),
        ({"record_stage": "acquitted"}, "R4"),
        ({"record_stage": "vacated"}, "R4"),
        ({"offense_category": "other"}, "R4"),
        ({"outcome_checked": False}, "R5"),
        ({"contradictory_evidence": [{"url": "https://courts.example/x", "source_type": "official_court_record"}]}, "R6"),
    ],
)
def test_each_rule_blocks_flag(kw, rule):
    out = failures_for(**kw)
    assert not out.eligible
    assert any(f.startswith(rule) for f in out.failures), out.failures


def test_social_post_never_flags():
    out = failures_for(c_source_type=SourceType.social_post, supporting_evidence=[], source_reliability="low", record_stage="allegation")
    assert not out.eligible


def test_registry_entry_requires_official_registry_and_current_date():
    c = candidate(source_type=SourceType.official_registry, record_stage="registry_entry")
    v = verification(c, record_stage="registry_entry", supporting_evidence=[{"url": c.source_url, "source_type": "official_registry"}])
    assert not evaluate(c, v).eligible  # no current-as-of date
    v2 = v.model_copy(update={"registry_current_as_of": "2026-10-01"})
    out = evaluate(c, v2)
    assert out.eligible and out.rule_id == "VR2_CURRENT_OFFICIAL_REGISTRY_ENTRY"


def test_registry_entry_from_news_does_not_flag():
    c = candidate(source_type=SourceType.news_report, record_stage="registry_entry")
    v = verification(
        c, record_stage="registry_entry", registry_current_as_of="2019-01-01",
        supporting_evidence=[EvidenceRef(url="https://news.example/a", source_type=SourceType.news_report)],
    )
    assert not evaluate(c, v).eligible


def test_fixture_evidence_cannot_flag_live_profile():
    c = candidate(retrieved_via=RetrievedVia.fixture)
    v = verification(c)
    assert evaluate(c, v, live_mode=False).eligible
    out = evaluate(c, v, live_mode=True)
    assert not out.eligible and any(f.startswith("R7") for f in out.failures)
