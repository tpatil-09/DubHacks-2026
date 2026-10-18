"""LIVE official-records API checks (opt-in: `pytest -m live`).

CourtListener works without a token at a low rate limit; set COURTLISTENER_API_TOKEN for normal use.
Uses a widely reported public appellate case (Adnan Syed, Maryland) only to confirm the API integration
returns parseable official records.
"""
import pytest

from safematch.config import load_settings
from safematch.models import PersonQuery, RetrievedVia
from safematch.providers.records import CourtListenerProvider


@pytest.mark.live
def test_courtlistener_live_returns_official_records():
    settings = load_settings()
    provider = CourtListenerProvider(token=settings.courtlistener_api_token)
    res = provider.search(PersonQuery(full_name="Adnan Syed", location="Baltimore, Maryland"))
    assert not [e for e in res.errors if e.kind.value == "access_denied"], res.errors
    assert res.records, f"no records; errors={res.errors}"
    for rec in res.records:
        assert rec.provider == RetrievedVia.courtlistener
        assert rec.url.startswith("https://www.courtlistener.com/")
    print("\n" + "\n".join(f"{r.record_type}: {r.title} | {r.court_or_agency} | {r.date} | {r.url}" for r in res.records))
