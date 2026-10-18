"""Optional supplementary search providers.

The primary search path is Claude Code's built-in WebSearch tool inside the
Investigator session. When ``SEARCH_PROVIDER=tavily`` the Investigator also runs
a few deterministic Tavily queries and hands the hits to the session as
untrusted leads. Search snippets are never treated as records.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Protocol

import httpx

from ..utils.logging_utils import get_logger, scrub

log = get_logger("search")


class SearchError(RuntimeError):
    pass


@dataclass(frozen=True)
class SearchHit:
    url: str
    title: str
    snippet: str
    query: str


class SearchProvider(Protocol):
    name: str

    def search(self, query: str, max_results: int = 5) -> List[SearchHit]:
        ...


class TavilySearchProvider:
    name = "tavily"
    endpoint = "https://api.tavily.com/search"

    def __init__(
        self,
        api_key: str,
        timeout: float = 20.0,
        max_retries: int = 2,
        min_interval: float = 1.0,
        client: Optional[httpx.Client] = None,
    ) -> None:
        if not api_key:
            raise SearchError("TAVILY_API_KEY is required for the tavily provider")
        self._api_key = api_key
        self._max_retries = max_retries
        self._min_interval = min_interval
        self._last_call = 0.0
        self._client = client or httpx.Client(timeout=timeout)

    def search(self, query: str, max_results: int = 5) -> List[SearchHit]:
        payload = {"query": query, "max_results": max_results, "search_depth": "basic", "include_answer": False}
        headers = {"Authorization": f"Bearer {self._api_key}"}
        last = ""
        for attempt in range(self._max_retries + 1):
            wait = self._min_interval - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)  # simple client-side rate limit
            self._last_call = time.monotonic()
            try:
                resp = self._client.post(self.endpoint, json=payload, headers=headers)
                if resp.status_code == 429 or resp.status_code >= 500:
                    last = f"HTTP {resp.status_code}"
                    time.sleep(min(2 ** attempt, 8))
                    continue
                if resp.status_code != 200:
                    raise SearchError(f"Tavily returned HTTP {resp.status_code}")
                data = resp.json()
                return [
                    SearchHit(url=r.get("url", ""), title=r.get("title", ""), snippet=(r.get("content") or "")[:500], query=query)
                    for r in data.get("results", [])
                    if r.get("url")
                ]
            except httpx.HTTPError as exc:
                last = type(exc).__name__
                time.sleep(min(2 ** attempt, 8))
        raise SearchError(scrub(f"Tavily search failed after retries: {last}"))


class MockSearchProvider:
    """Fixture-backed provider. ``results`` maps a query substring to hits."""

    name = "mock"

    def __init__(self, results: Optional[Dict[str, List[Dict[str, str]]]] = None, fail_with: Optional[str] = None):
        self._results = results or {}
        self._fail_with = fail_with
        self.queries: List[str] = []

    def search(self, query: str, max_results: int = 5) -> List[SearchHit]:
        self.queries.append(query)
        if self._fail_with:
            raise SearchError(self._fail_with)
        hits: List[SearchHit] = []
        for key, items in self._results.items():
            if key.lower() in query.lower():
                hits.extend(SearchHit(url=i["url"], title=i.get("title", ""), snippet=i.get("snippet", ""), query=query) for i in items)
        return hits[:max_results]
