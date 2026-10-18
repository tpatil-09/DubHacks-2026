"""Official-records provider (CourtListener), tested offline with httpx.MockTransport."""
import httpx

from safematch.models import ErrorKind, OffenseCategory, PersonQuery, RetrievedVia
from safematch.providers.records import (
    CourtListenerProvider,
    name_matches,
    subject_state,
)

TOKEN = "cl-test-token-0123456789abcdef"
Q = PersonQuery(full_name="Alex Fixture Doe", location="Spokane, WA")

OPINIONS = {"count": 3, "results": [
    {"caseName": "State v. Doe", "court": "Court of Appeals of Washington", "dateFiled": "2019-05-01",
     "docketNumber": "35123-4-III", "absolute_url": "/opinion/111/state-v-doe/",
     "opinions": [{"snippet": "Appellant <mark>Alex R. Fixture Doe</mark> was convicted of rape in the second degree."}]},
    {"caseName": "Doe v. Smith", "court": "Supreme Court of Ohio", "dateFiled": "2010-01-01", "docketNumber": "1",
     "absolute_url": "/opinion/222/doe-v-smith/", "opinions": [{"snippet": "Plaintiff Jordan Doe sued over a contract."}]},
    {"caseName": "People v. Doe", "court": "California Court of Appeal", "dateFiled": "2015-01-01", "docketNumber": "B1",
     "absolute_url": "/opinion/333/people-v-doe/", "opinions": [{"snippet": "Defendant Alex Doe was sentenced for assault."}]},
]}
DOCKETS = {"count": 2, "results": [
    {"caseName": "Alex Fixture Doe", "court": "United States Bankruptcy Court, E.D. Washington", "docketNumber": "23-10063",
     "docket_absolute_url": "/docket/1/alex-fixture-doe/", "party": ["Alex Fixture Doe"], "dateFiled": "2023-01-01"},
    {"caseName": "United States v. 42 Bitcoin", "court": "District Court, N.D. California", "docketNumber": "3:20-cv-07811",
     "docket_absolute_url": "/docket/3/us-v-bitcoin/", "party": ["Alex Doe", "United States of America"], "dateFiled": "2020-01-01"},
    {"caseName": "United States v. Doe", "court": "District Court, E.D. Washington", "docketNumber": "2:19-cr-00042",
     "docket_absolute_url": "/docket/2/united-states-v-doe/", "party": ["Alex Doe", "United States of America"], "dateFiled": "2019-02-02"},
]}


def cl_provider(handler):
    client = httpx.Client(base_url="https://www.courtlistener.com", transport=httpx.MockTransport(handler))
    return CourtListenerProvider(token=TOKEN, client=client, sleep=lambda s: None, min_interval=0)


def test_name_matching_and_state():
    assert name_matches("Appellant Alex R. Fixture Doe was convicted", Q)
    assert name_matches("DOE, ALEX", Q)
    assert not name_matches("Syed v. Doe; Jordan Doe testified", Q)
    assert subject_state(Q) == "WA"
    assert subject_state(PersonQuery(full_name="A B", location="Boston, Massachusetts")) == "MA"


def test_courtlistener_filters_and_ranks():
    seen = []

    def handler(request: httpx.Request):
        seen.append(request)
        return httpx.Response(200, json=OPINIONS if request.url.params["type"] == "o" else DOCKETS)

    res = cl_provider(handler).search(Q)
    assert all(r.headers["Authorization"] == f"Token {TOKEN}" for r in seen)
    assert [r.url.params["q"] for r in seen] == ['"Alex Doe"', '"Alex Doe"']
    titles = [r.title for r in res.records]
    # Different first name (Jordan) and the bankruptcy filing are dropped; criminal records kept.
    assert "Doe v. Smith" not in titles and "Alex Fixture Doe" not in titles
    assert "United States v. 42 Bitcoin" not in titles  # civil forfeiture (-cv-) is not a criminal record
    assert titles[0] == "State v. Doe"  # in-state (Washington) first
    assert "United States v. Doe" in titles and "People v. Doe" in titles
    first = res.records[0]
    assert first.url == "https://www.courtlistener.com/opinion/111/state-v-doe/"
    assert first.provider == RetrievedVia.courtlistener and "<mark>" not in (first.excerpt or "")
    assert first.offense_category == OffenseCategory.sexual_offense
    assert not res.errors


def test_courtlistener_auth_and_rate_limit_errors_never_leak_token():
    res = cl_provider(lambda r: httpx.Response(401, json={"detail": "Invalid token."})).search(Q)
    assert {e.kind for e in res.errors} == {ErrorKind.access_denied}
    calls = {"n": 0}

    def throttled(request):
        calls["n"] += 1
        return httpx.Response(429, json={"detail": "throttled"})

    res = cl_provider(throttled).search(Q)
    assert {e.kind for e in res.errors} == {ErrorKind.search_failed} and calls["n"] == 6  # 3 attempts x 2 searches
    assert all(TOKEN not in e.detail for e in res.errors)


def test_courtlistener_collapses_duplicate_opinions():
    dup = {"results": [
        {"caseName": "State v. Doe", "court": "Court of Appeals of Washington", "dateFiled": "2019-05-01", "docketNumber": "1",
         "absolute_url": f"/opinion/{i}/state-v-doe/", "opinions": [{"snippet": "Alex Doe was convicted."}]} for i in (1, 2)
    ]}
    res = cl_provider(lambda r: httpx.Response(200, json=dup if r.url.params["type"] == "o" else {"results": []})).search(Q)
    assert len(res.records) == 1


def test_courtlistener_paces_requests_and_honours_retry_after():
    waits, now = [], [1000.0]
    clock = lambda: now[0]  # noqa: E731

    def fake_sleep(seconds):
        waits.append(round(seconds, 1))
        now[0] += seconds

    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "20"}, json={"detail": "throttled"})
        return httpx.Response(200, json={"results": []})

    client = httpx.Client(base_url="https://www.courtlistener.com", transport=httpx.MockTransport(handler))
    CourtListenerProvider._last_request = 0.0
    res = CourtListenerProvider(token=TOKEN, client=client, sleep=fake_sleep, clock=clock).search(Q)
    assert not res.errors
    assert 20.0 in waits  # waited exactly as long as the server asked
    assert waits.count(12.5) >= 1  # later requests spaced to stay under 5/minute


def test_courtlistener_stops_when_quota_window_is_long():
    res = cl_provider(lambda r: httpx.Response(429, headers={"Retry-After": "3600"}, json={})).search(Q)
    assert res.errors and all("quota" in e.detail for e in res.errors)
