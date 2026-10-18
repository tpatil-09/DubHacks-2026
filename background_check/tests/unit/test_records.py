"""Official-records providers (CourtListener, Checkr Trust), tested offline with httpx.MockTransport."""
import json

import httpx
import pytest

from safematch.models import ErrorKind, OffenseCategory, PersonQuery, RecordStage, RetrievedVia
from safematch.providers.records import (
    CheckrTrustProvider,
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
    {"caseName": "United States v. Doe", "court": "District Court, E.D. Washington", "docketNumber": "2:19-cr-00042",
     "docket_absolute_url": "/docket/2/united-states-v-doe/", "party": ["Alex Doe", "United States of America"], "dateFiled": "2019-02-02"},
]}


def cl_provider(handler):
    client = httpx.Client(base_url="https://www.courtlistener.com", transport=httpx.MockTransport(handler))
    return CourtListenerProvider(token=TOKEN, client=client, sleep=lambda s: None)


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


# ------------------------------------------------------------- Checkr Trust

CHECK_REGISTRY = {"id": "chk_1", "check_type": "sex_offender_registry", "results": [
    {"record_id": "r1", "category": "Sex Offender", "collection_date": "2026-09-30", "record_match_confidence_level": "high",
     "person": {"first_name": "ALEX", "last_name": "DOE", "dob": "19890412", "addresses": [{"city": "Spokane", "state": "WA"}]},
     "source": {"category": "sex offender registry", "name": "Washington State Patrol", "state": "WA"}, "cases": []},
]}
CHECK_CRIMINAL = {"id": "chk_2", "check_type": "instant_criminal", "results": [
    {"record_id": "r2", "category": "Criminal/traffic", "record_match_confidence_level": "medium",
     "person": {"first_name": "ALEX", "last_name": "DOE"},
     "source": {"category": "court", "name": "Spokane County Superior Court", "county": "Spokane", "state": "WA"},
     "cases": [{"case_number": "19-1-00042-32", "court_name": "Spokane County Superior Court", "file_date": "2019-01-10",
                "identity_match_confidence_level": "high",
                "charges": [{"description": "ASSAULT 4 - DOMESTIC VIOLENCE", "category": "Violence",
                             "dispositions": [{"disposition": "GUILTY", "disposition_type": "Conviction"}]}]}]},
]}


def checkr_provider(handler):
    return CheckrTrustProvider("client-id-123", "client-secret-456789", client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_checkr_trust_auth_request_shape_and_mapping():
    bodies = []

    def handler(request: httpx.Request):
        if request.url.path.endswith("/accounts/token"):
            assert json.loads(request.content) == {"client_id": "client-id-123", "client_secret": "client-secret-456789", "grant_type": "client_credentials"}
            return httpx.Response(200, json={"access_token": "jwt-abc", "token_type": "Bearer", "expires_in": 86400})
        assert request.headers["Authorization"] == "Bearer jwt-abc"
        body = json.loads(request.content)
        bodies.append(body)
        return httpx.Response(201, json=CHECK_REGISTRY if body["check_type"] == "sex_offender_registry" else CHECK_CRIMINAL)

    q = PersonQuery(full_name="Alex Fixture Doe", location="Spokane, WA", date_of_birth="1989-04-12")
    res = checkr_provider(handler).search(q)
    assert [b["check_type"] for b in bodies] == ["sex_offender_registry", "instant_criminal"]
    assert bodies[0]["first_name"] == "Alex" and bodies[0]["last_name"] == "Doe" and bodies[0]["dob"] == "19890412"
    assert bodies[0]["addresses"] == [{"city": "Spokane", "state": "WA"}] and bodies[0]["input_type"] == "person"

    reg, crim = res.records
    assert reg.record_type == "sex_offender_registry" and reg.record_stage == RecordStage.registry_entry
    assert reg.registry_as_of == "2026-09-30" and any("Spokane" in d for d in reg.identity_details)
    assert crim.record_type == "criminal_record" and crim.case_number == "19-1-00042-32"
    assert crim.record_stage == RecordStage.conviction and crim.offense_category == OffenseCategory.domestic_violence
    assert any("identity match confidence: high" in d for d in crim.identity_details)


def test_checkr_trust_failures_become_errors():
    res = checkr_provider(lambda r: httpx.Response(401, json={"error": "invalid_client"})).search(Q)
    assert res.errors and res.errors[0].kind == ErrorKind.access_denied and not res.records

    def not_enabled(request):
        if request.url.path.endswith("/accounts/token"):
            return httpx.Response(200, json={"access_token": "jwt", "expires_in": 3600})
        return httpx.Response(401, json={"error": "product not enabled"})

    res = checkr_provider(not_enabled).search(Q)
    assert len(res.errors) == 2 and all(e.kind == ErrorKind.access_denied for e in res.errors)


def test_checkr_trust_requires_credentials():
    with pytest.raises(ValueError):
        CheckrTrustProvider("", "")


def test_courtlistener_collapses_duplicate_opinions():
    dup = {"results": [
        {"caseName": "State v. Doe", "court": "Court of Appeals of Washington", "dateFiled": "2019-05-01", "docketNumber": "1",
         "absolute_url": f"/opinion/{i}/state-v-doe/", "opinions": [{"snippet": "Alex Doe was convicted."}]} for i in (1, 2)
    ]}
    res = cl_provider(lambda r: httpx.Response(200, json=dup if r.url.params["type"] == "o" else {"results": []})).search(Q)
    assert len(res.records) == 1
