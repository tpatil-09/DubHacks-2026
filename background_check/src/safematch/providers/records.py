"""Official-records providers: structured court and registry data from APIs.

Unlike web search, these return records straight from official sources, so a
verified, strongly matched record can satisfy the "official source" safety rule.

* CourtListener (Free Law Project) REST API v4: free with an account token.
  Covers federal and state *appellate* opinions (criminal appeals name the
  defendant) and federal dockets from PACER/RECAP. It has no state trial-court
  records and no sex-offender registries.

All responses are treated as untrusted data. Errors become RetrievalErrors so a
failed lookup makes a report partial instead of "clear".
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, Tuple

import httpx

from ..models import (
    ErrorKind,
    OffenseCategory,
    OfficialRecord,
    PersonQuery,
    RecordStage,
    RetrievalError,
    RetrievedVia,
)
from ..utils.logging_utils import get_logger, scrub

log = get_logger("records")

COURTLISTENER_BASE = "https://www.courtlistener.com"
MAX_RECORDS = 10
# Full opinion texts fetched per person (1 request each). With 2 search requests that's 5 requests/person,
# about 25 people/day on CourtListener's free tier (125 requests/day).
MAX_TEXT_FETCHES = 3
_OPINION_TEXT_FIELDS = ("plain_text", "html_with_citations", "html", "html_lawbox", "html_columbia", "html_anon_2020", "xml_harvard")

US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado",
    "CT": "Connecticut", "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York", "NC": "North Carolina",
    "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}


@dataclass
class RecordsResult:
    provider: str
    records: List[OfficialRecord] = field(default_factory=list)
    queries: List[str] = field(default_factory=list)
    errors: List[RetrievalError] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)


class RecordsProvider(Protocol):
    name: str

    def search(self, query: PersonQuery) -> RecordsResult:
        ...


# ------------------------------------------------------------------- helpers


def subject_state(query: PersonQuery) -> Optional[str]:
    """Two-letter state from the supplied location/jurisdictions, if one is recognizable."""
    for text in [query.location or "", *query.jurisdictions]:
        m = re.search(r",\s*([A-Z]{2})\b", text)
        if m and m.group(1) in US_STATES:
            return m.group(1)
        for code, name in US_STATES.items():
            if re.search(rf"\b{re.escape(name)}\b", text, re.I):
                return code
    return None


def _name_parts(query: PersonQuery) -> Tuple[str, str]:
    parts = query.full_name.split()
    return parts[0], parts[-1]


def name_matches(text: str, query: PersonQuery) -> bool:
    """True if the text names the person: "First [Middle/Initial] Last" or "Last, First".

    A shared surname alone (e.g. a caption like "Syed v. Lee") is not enough; the
    first name must appear next to it.
    """
    first, last = (re.escape(x) for x in _name_parts(query))
    patterns = [
        rf"\b{first}\b(?:\s+[A-Za-z][\w'.-]*){{0,2}}\s+{last}\b",
        rf"\b{last}\s*,\s*{first}\b",
    ]
    return any(re.search(p, text or "", re.I) for p in patterns)


_TAGS = re.compile(r"<[^>]+>")
_CRIMINAL_CAPTION = re.compile(r"\b(state|people|commonwealth|united states|u\.\s?s\.|usa|government)\b", re.I)
_CRIMINAL_TERMS = re.compile(
    r"\b(convict\w*|sentenc\w*|defendant|criminal|indict\w*|plea|habeas|felony|misdemeanor|offen[cs]e|prosecut\w*)\b", re.I
)
_CRIMINAL_DOCKET = re.compile(r"(?:^|[-:\s])cr(?:[-:\s]|$)|-cr-|\bcr\b", re.I)


def _clean(text: Any, limit: int = 500) -> str:
    text = _TAGS.sub("", str(text or ""))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def offense_category_from_text(text: str) -> OffenseCategory:
    t = text.lower()
    if re.search(r"domestic|intimate partner|dating violence|protective order|restraining order", t):
        return OffenseCategory.domestic_violence
    if re.search(r"sex|rape|sodomy|indecent|lewd|molest|child porn|exploitation of a minor", t):
        return OffenseCategory.sexual_offense
    if re.search(r"murder|homicide|manslaughter|assault|battery|kidnap|strangul|robbery|stalking", t):
        return OffenseCategory.other_serious_violent
    return OffenseCategory.unknown


_OUTCOME_SENTENCE = re.compile(
    r"\b(we affirm|affirm(ed|s)?|we reverse|revers(ed|e)|vacat(e|ed|ing)|remand(ed)?|new trial|convict(ed|ion)|"
    r"sentenc(ed|e)|guilty|acquit\w*|dismiss(ed|al)|judgment)\b",
    re.I,
)
_JUDGMENT_LINE = re.compile(
    r"\b(?:JUDGMENTS?|ORDER|CONVICTIONS?)?[A-Z ,;.']{0,80}\b(?:AFFIRMED|REVERSED|VACATED|REMANDED|DISMISSED)\b[A-Z ,;.'()0-9-]{0,160}"
)
_IDENTITY_SENTENCE = re.compile(r"\b(\d{2}[- ]year[- ]old|age(d)? \d{2}|born|resident of|county|years old)\b", re.I)


def opinion_text(data: Dict[str, Any]) -> str:
    """Longest available text field of a CourtListener opinion, as plain text."""
    candidates = [str(data.get(f) or "") for f in _OPINION_TEXT_FIELDS]
    raw = max(candidates, key=len) if candidates else ""
    return " ".join(_TAGS.sub(" ", raw).split())


def key_passages(text: str, query: PersonQuery, limit_chars: int = 3000) -> List[str]:
    """The passages a reviewer needs: opening, closing judgment, outcome sentences, identity details."""
    if not text:
        return []
    first, last = _name_parts(query)
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z(\"“])", text)
    mentions = lambda s: re.search(rf"\b({re.escape(last)}|appellant|petitioner|defendant)\b", s, re.I)  # noqa: E731
    picks: List[str] = []
    picks.append(_clean(text[:600], 600))  # caption / syllabus / opening holding
    outcome = [s for s in sentences if _OUTCOME_SENTENCE.search(s) and mentions(s) and 25 < len(s) < 600]
    picks += outcome[:2] + outcome[-2:]  # how the case began and how it ended
    identity = [s for s in sentences if re.search(rf"\b{re.escape(last)}\b", s, re.I) and _IDENTITY_SENTENCE.search(s) and len(s) < 500]
    picks += identity[:2]
    # Mandate line, which in long opinions sits before the concurrences, dissents and footnotes.
    judgment = [m.group(0).strip(" .;,") for m in _JUDGMENT_LINE.finditer(text) if len(m.group(0).strip(" .;,")) > 12]
    picks += judgment[:1]
    tail = text[-600:]
    if len(text) > 600:  # start the closing passage at a sentence boundary
        cut = re.search(r"[.!?]\s+(?=[A-Z])", tail)
        tail = tail[cut.end():] if cut else tail
    picks.append(tail)  # closing judgment line ("JUDGMENT AFFIRMED", "REVERSED AND REMANDED")
    out, total = [], 0
    for s in picks:
        s = _clean(s, 600)
        if s and s not in out and total + len(s) <= limit_chars:
            out.append(s)
            total += len(s)
    return out


# --------------------------------------------------------------- CourtListener


class CourtListenerProvider:
    """CourtListener REST API v4 search (case law + federal dockets)."""

    name = "courtlistener"

    # CourtListener's default limits for authenticated accounts: 5 requests/minute, 50/hour, 125/day.
    # https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview
    MIN_INTERVAL_SECONDS = 12.5
    MAX_RETRY_WAIT_SECONDS = 65.0
    _last_request = 0.0  # shared across instances so separate runs in one process stay under the limit

    def __init__(self, token: Optional[str] = None, client: Optional[httpx.Client] = None, max_retries: int = 2,
                 timeout: float = 20.0, sleep=time.sleep, clock=time.monotonic, min_interval: Optional[float] = None,
                 max_text_fetches: int = MAX_TEXT_FETCHES) -> None:
        headers = {"Accept": "application/json", "User-Agent": "Havenly-background-check/0.1"}
        if token:
            headers["Authorization"] = f"Token {token}"
        self._client = client or httpx.Client(base_url=COURTLISTENER_BASE, timeout=timeout, headers=headers)
        if client is not None:
            self._client.headers.update(headers)
        self._max_retries = max_retries
        self._sleep = sleep
        self._clock = clock
        self._min_interval = self.MIN_INTERVAL_SECONDS if min_interval is None else min_interval
        self.authenticated = bool(token)
        self.max_text_fetches = max_text_fetches

    def _pace(self) -> None:
        wait = self._min_interval - (self._clock() - CourtListenerProvider._last_request)
        if wait > 0:
            self._sleep(wait)
        CourtListenerProvider._last_request = self._clock()

    def _get(self, params: Dict[str, str], path: str = "/api/rest/v4/search/") -> Dict[str, Any]:
        last = ""
        for attempt in range(self._max_retries + 1):
            self._pace()
            try:
                resp = self._client.get(path, params=params)
            except httpx.HTTPError as exc:
                last = type(exc).__name__
                self._sleep(min(2 ** attempt * 2, 10))
                continue
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (401, 403):
                raise PermissionError(f"CourtListener rejected the request (HTTP {resp.status_code}); check COURTLISTENER_API_TOKEN")
            last = f"HTTP {resp.status_code}"
            if resp.status_code == 429:
                # Honour the server's Retry-After (the per-minute window) instead of hammering the quota.
                try:
                    wait = float(resp.headers.get("retry-after", "15"))
                except ValueError:
                    wait = 15.0
                if wait > self.MAX_RETRY_WAIT_SECONDS:
                    last = "HTTP 429 (hourly/daily quota reached)"
                    break
                self._sleep(wait)
                continue
            if resp.status_code not in (500, 502, 503, 504):
                break
            self._sleep(min(2 ** attempt * 2, 10))
        raise RuntimeError(f"CourtListener search failed: {last}")

    def search(self, query: PersonQuery) -> RecordsResult:
        result = RecordsResult(provider=self.name)
        first, last = _name_parts(query)
        state = subject_state(query)
        state_name = US_STATES.get(state or "", "")
        phrase = f'"{first} {last}"'
        searches = [
            ("appellate_opinion", {"type": "o", "q": phrase, "order_by": "score desc"}),
            ("federal_docket", {"type": "r", "q": phrase, "order_by": "score desc"}),
        ]
        records: List[Tuple[int, OfficialRecord]] = []
        for record_type, params in searches:
            label = f"CourtListener {'case law' if params['type'] == 'o' else 'federal dockets'}: {phrase}"
            result.queries.append(label)
            try:
                data = self._get(params)
            except PermissionError as exc:
                result.errors.append(RetrievalError(kind=ErrorKind.access_denied, target=label, detail=scrub(str(exc)), stage="investigator"))
                continue
            except (RuntimeError, ValueError) as exc:
                result.errors.append(RetrievalError(kind=ErrorKind.search_failed, target=label, detail=scrub(str(exc))[:300], stage="investigator"))
                continue
            for hit in data.get("results", [])[:40]:
                rec = self._to_record(hit, record_type, query)
                if rec is None:
                    continue
                in_state = bool(state_name) and state_name.lower() in (rec.court_or_agency or "").lower()
                records.append((0 if in_state else 1, rec))
        seen = set()
        for _, rec in sorted(records, key=lambda pair: pair[0]):
            # CourtListener sometimes stores the same opinion twice (different ids): collapse by caption/court/date.
            key = (rec.title.lower(), (rec.court_or_agency or "").lower(), rec.date, rec.record_type)
            if rec.url in seen or key in seen:
                continue
            seen.update({rec.url, key})
            result.records.append(rec)
            if len(result.records) >= MAX_RECORDS:
                break
        self._attach_full_text(result, query)
        result.limitations.append(
            "CourtListener covers federal and state appellate opinions and federal dockets; it does not include state "
            "trial-court records or sex-offender registries."
        )
        if not self.authenticated:
            result.limitations.append("CourtListener was queried without an API token.")
        log.info("courtlistener: %d record(s), %d error(s)", len(result.records), len(result.errors))
        return result

    def _to_record(self, hit: Dict[str, Any], record_type: str, query: PersonQuery) -> Optional[OfficialRecord]:
        caption = str(hit.get("caseName") or hit.get("case_name_full") or "")
        opinions = [o for o in (hit.get("opinions") or []) if isinstance(o, dict)]
        snippets = " ".join(_clean(o.get("snippet"), 2000) for o in opinions)
        opinion_id = opinions[0].get("id") if opinions else None
        parties = " ; ".join(str(p) for p in (hit.get("party") or []))
        text = f"{caption} {hit.get('caseNameFull') or ''} {parties} {snippets}"
        if not name_matches(text, query):
            return None
        docket = str(hit.get("docketNumber") or "")
        if record_type == "federal_docket":
            # Criminal docket numbers carry "cr" (e.g. 1:14-cr-00068). "United States v." alone also covers civil
            # forfeitures and other people's appeals, so it isn't enough.
            if not _CRIMINAL_DOCKET.search(docket):
                return None
        elif not (_CRIMINAL_CAPTION.search(caption) or _CRIMINAL_TERMS.search(snippets)):
            return None
        path = hit.get("absolute_url") or hit.get("docket_absolute_url") or ""
        if not path:
            return None
        url = path if path.startswith("http") else COURTLISTENER_BASE + path
        excerpt = _clean(snippets or parties or caption, 500)
        return OfficialRecord(
            provider=RetrievedVia.courtlistener,
            record_type=record_type,
            url=url,
            title=_clean(caption, 200) or "Untitled case",
            court_or_agency=hit.get("court") or None,
            case_number=docket or None,
            date=hit.get("dateFiled") or None,
            excerpt=excerpt or None,
            offense_category=offense_category_from_text(snippets + " " + str(hit.get("cause") or "")),
            identity_details=[f"Name appears in the {'opinion' if record_type == 'appellate_opinion' else 'docket'} as matched by name only"],
            source_id=str(opinion_id) if opinion_id else None,
            full_text_status="not_fetched" if record_type == "appellate_opinion" else None,
        )

    def _attach_full_text(self, result: RecordsResult, query: PersonQuery) -> None:
        """Fetch official opinion text via the API (the website blocks automated page loads) and keep the key passages."""
        fetched = 0
        for i, rec in enumerate(result.records):
            if rec.record_type != "appellate_opinion" or not rec.source_id:
                continue
            if fetched >= self.max_text_fetches:
                break
            fetched += 1
            label = f"CourtListener opinion text: {rec.title}"
            result.queries.append(label)
            try:
                data = self._get({"fields": ",".join(("id",) + _OPINION_TEXT_FIELDS)}, path=f"/api/rest/v4/opinions/{rec.source_id}/")
            except (RuntimeError, PermissionError, ValueError) as exc:
                result.errors.append(RetrievalError(kind=ErrorKind.fetch_failed, target=label, detail=scrub(str(exc))[:300], stage="investigator"))
                result.records[i] = rec.model_copy(update={"full_text_status": "failed"})
                continue
            text = opinion_text(data)
            passages = key_passages(text, query)
            status = "retrieved" if len(text) > 1500 else "summary_only"
            update: Dict[str, Any] = {"text_passages": passages, "full_text_status": status}
            if passages:
                outcome = next((s for s in passages[1:] if _OUTCOME_SENTENCE.search(s)), passages[0])
                update["excerpt"] = _clean(outcome, 500)
                update["offense_category"] = (rec.offense_category if rec.offense_category != OffenseCategory.unknown
                                              else offense_category_from_text(" ".join(passages)))
            result.records[i] = rec.model_copy(update=update)
        skipped = sum(1 for r in result.records if r.full_text_status == "not_fetched")
        if skipped:
            result.limitations.append(f"Full text was not fetched for {skipped} additional opinion(s) (per-person limit of {self.max_text_fetches}).")


# ------------------------------------------------------------------- mock


class MockRecordsProvider:
    """Fixture-backed records provider for tests and --mock runs."""

    def __init__(self, records: Optional[List[Dict[str, Any]]] = None, error: Optional[str] = None, name: str = "courtlistener"):
        self.name = name
        self._records = records or []
        self._error = error

    def search(self, query: PersonQuery) -> RecordsResult:
        result = RecordsResult(provider=self.name, queries=[f"{self.name} (fixture): {query.full_name}"])
        if self._error:
            result.errors.append(RetrievalError(kind=ErrorKind.search_failed, target=f"{self.name} search", detail=self._error, stage="investigator"))
            return result
        result.records = [OfficialRecord.model_validate({**r, "provider": "fixture"}) for r in self._records]
        return result
