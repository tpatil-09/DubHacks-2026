"""SSRF-safe public web retrieval used for deterministic excerpt grounding.

Claude Code's WebFetch performs the agents' browsing. This fetcher is used by
Python itself to confirm that excerpts the agents quote actually appear on the
original page. It only reaches public http(s) hosts:

* http/https only, no credentials in URLs, standard ports only
* every hostname is resolved and all addresses must be globally routable
  (blocks localhost, RFC1918, link-local, cloud metadata, multicast, etc.)
* redirects are followed manually (max 5) and each hop is re-validated
* response size cap, request timeout, robots.txt respected
* retrieved HTML is reduced to text and treated as untrusted data
"""
from __future__ import annotations

import ipaddress
import re
import socket
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Callable, List, Optional
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from ..utils.logging_utils import get_logger

log = get_logger("retrieval")

USER_AGENT = "HavenlyResearchBot/0.1 (+public-records verification; respects robots.txt)"
MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5
ALLOWED_PORTS = {None, 80, 443}
_BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "metadata"}


class URLBlocked(ValueError):
    pass


@dataclass
class FetchResult:
    url: str
    ok: bool
    status: Optional[int] = None
    text: str = ""
    error: Optional[str] = None
    blocked: bool = False


Resolver = Callable[[str], List[str]]


def _default_resolver(host: str) -> List[str]:
    return list({ai[4][0] for ai in socket.getaddrinfo(host, None)})


def validate_public_url(url: str, resolver: Resolver = _default_resolver) -> None:
    """Raise :class:`URLBlocked` unless ``url`` points at a public http(s) host."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise URLBlocked(f"scheme '{parsed.scheme}' not allowed")
    if parsed.username or parsed.password:
        raise URLBlocked("credentials in URL not allowed")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or host in _BLOCKED_HOSTS or host.endswith(".localhost") or host.endswith(".internal"):
        raise URLBlocked(f"host '{host}' not allowed")
    try:
        port = parsed.port
    except ValueError:
        raise URLBlocked("invalid port") from None
    if port not in ALLOWED_PORTS:
        raise URLBlocked(f"port {port} not allowed")
    try:
        literal = ipaddress.ip_address(host)
        addrs = [str(literal)]
    except ValueError:
        try:
            addrs = resolver(host)
        except (socket.gaierror, OSError) as exc:
            raise URLBlocked(f"could not resolve host: {type(exc).__name__}") from None
    if not addrs:
        raise URLBlocked("host resolved to no addresses")
    for a in addrs:
        ip = ipaddress.ip_address(a.split("%")[0])
        if not ip.is_global or ip.is_multicast:
            raise URLBlocked(f"host resolves to non-public address")


class _TextExtractor(HTMLParser):
    _SKIP = {"script", "style", "noscript", "template", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: List[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):  # noqa: ANN001
        if tag in self._SKIP:
            self._skip_depth += 1

    def handle_endtag(self, tag):  # noqa: ANN001
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):  # noqa: ANN001
        if not self._skip_depth and data.strip():
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:  # malformed HTML: fall back to tag stripping
        return re.sub(r"<[^>]+>", " ", html)
    return " ".join(parser.parts)


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def excerpt_in_text(excerpt: str, page_text: str) -> bool:
    """True if the excerpt (or most of its 8-word shingles) appears in the page text."""
    ex, page = normalize(excerpt), normalize(page_text)
    if not ex:
        return False
    if ex in page:
        return True
    words = ex.split()
    if len(words) < 8:
        return False
    shingles = [" ".join(words[i : i + 8]) for i in range(0, len(words) - 7, 4)]
    hits = sum(1 for s in shingles if s in page)
    return hits / len(shingles) >= 0.6


class SafeFetcher:
    def __init__(
        self,
        timeout: float = 15.0,
        max_bytes: int = MAX_BYTES,
        resolver: Resolver = _default_resolver,
        client: Optional[httpx.Client] = None,
        respect_robots: bool = True,
    ) -> None:
        self.max_bytes = max_bytes
        self.resolver = resolver
        self.respect_robots = respect_robots
        self._client = client or httpx.Client(timeout=timeout, follow_redirects=False, headers={"User-Agent": USER_AGENT})

    def _robots_allows(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        p = urlparse(url)
        robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
        res = self._get(robots_url, check_robots=False)
        if not res.ok or res.status != 200:
            return True  # no robots.txt => allowed
        rp = RobotFileParser()
        rp.parse(res.text.splitlines())
        return rp.can_fetch(USER_AGENT, url)

    def fetch(self, url: str) -> FetchResult:
        return self._get(url, check_robots=True)

    def _get(self, url: str, check_robots: bool) -> FetchResult:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            try:
                validate_public_url(current, self.resolver)
            except URLBlocked as exc:
                return FetchResult(url=url, ok=False, error=f"blocked: {exc}", blocked=True)
            if check_robots and not self._robots_allows(current):
                return FetchResult(url=url, ok=False, error="disallowed by robots.txt", blocked=True)
            try:
                with self._client.stream("GET", current) as resp:
                    if resp.is_redirect:
                        loc = resp.headers.get("location")
                        if not loc:
                            return FetchResult(url=url, ok=False, status=resp.status_code, error="redirect without location")
                        current = urljoin(current, loc)
                        continue
                    ctype = resp.headers.get("content-type", "")
                    if resp.status_code != 200:
                        return FetchResult(url=url, ok=False, status=resp.status_code, error=f"HTTP {resp.status_code}")
                    if not any(t in ctype for t in ("text/html", "text/plain", "application/xhtml", "application/json")) and ctype:
                        return FetchResult(url=url, ok=False, status=200, error=f"unsupported content-type {ctype.split(';')[0]}")
                    body = bytearray()
                    for chunk in resp.iter_bytes():
                        body.extend(chunk)
                        if len(body) > self.max_bytes:
                            return FetchResult(url=url, ok=False, status=200, error="response exceeded size limit")
                    raw = body.decode(resp.encoding or "utf-8", errors="replace")
                    text = html_to_text(raw) if "html" in ctype or raw.lstrip().startswith("<") else raw
                    return FetchResult(url=url, ok=True, status=200, text=text)
            except httpx.HTTPError as exc:
                return FetchResult(url=url, ok=False, error=f"fetch error: {type(exc).__name__}")
        return FetchResult(url=url, ok=False, error="too many redirects")

    def check_excerpt(self, url: str, excerpt: str) -> Optional[bool]:
        """True/False if the page was retrieved, None if it could not be checked."""
        res = self.fetch(url)
        if not res.ok:
            log.info("excerpt check skipped for %s: %s", url, res.error)
            return None
        return excerpt_in_text(excerpt, res.text)


class FixtureFetcher:
    """Test double: serves page text from a fixture mapping; never touches the network."""

    def __init__(self, pages: Optional[dict] = None) -> None:
        self.pages = pages or {}

    def fetch(self, url: str) -> FetchResult:
        page = self.pages.get(url)
        if page is None:
            return FetchResult(url=url, ok=False, error="not in fixture")
        status = page.get("status", 200)
        if status != 200:
            return FetchResult(url=url, ok=False, status=status, error=f"HTTP {status}")
        return FetchResult(url=url, ok=True, status=200, text=page.get("text", ""))

    def check_excerpt(self, url: str, excerpt: str) -> Optional[bool]:
        res = self.fetch(url)
        return excerpt_in_text(excerpt, res.text) if res.ok else None
