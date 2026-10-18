import httpx
import pytest

from safematch.providers.source_retrieval import (
    SafeFetcher,
    URLBlocked,
    excerpt_in_text,
    html_to_text,
    validate_public_url,
)

PUBLIC = lambda host: ["93.184.216.34"]  # noqa: E731  (documentation-range-like public IP)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/x",
        "http://localhost/admin",
        "http://127.0.0.1/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://metadata.google.internal/",
        "http://user:pass@example.com/",
        "http://example.com:8080/",
    ],
)
def test_blocks_non_public_targets(url):
    with pytest.raises(URLBlocked):
        validate_public_url(url, resolver=PUBLIC)


def test_blocks_hostnames_resolving_to_private_ips():
    with pytest.raises(URLBlocked):
        validate_public_url("https://evil.example/", resolver=lambda h: ["10.1.2.3"])


def test_allows_public_https():
    validate_public_url("https://www.example.com/page", resolver=PUBLIC)


def _fetcher(handler):
    client = httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)
    return SafeFetcher(client=client, resolver=lambda h: ["10.0.0.1"] if h == "internal.example" else ["93.184.216.34"], respect_robots=False)


def test_redirect_to_private_host_is_blocked():
    def handler(req):
        return httpx.Response(302, headers={"location": "http://internal.example/secret"})

    res = _fetcher(handler).fetch("https://public.example/start")
    assert not res.ok and res.blocked


def test_size_limit_enforced():
    def handler(req):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"a" * 3_000_000)

    res = _fetcher(handler).fetch("https://public.example/big")
    assert not res.ok and "size" in res.error


def test_html_text_and_excerpt_matching():
    html = "<html><script>ignore()</script><p>Alex R. Doe was found\n guilty of assault.</p></html>"
    text = html_to_text(html)
    assert "ignore" not in text
    assert excerpt_in_text("Alex R. Doe was found guilty of assault.", text)
    assert not excerpt_in_text("Alex R. Doe was acquitted.", text)


def test_check_excerpt_end_to_end():
    def handler(req):
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<p>Docket: defendant found guilty.</p>")

    f = _fetcher(handler)
    assert f.check_excerpt("https://public.example/d", "defendant found guilty") is True
    assert f.check_excerpt("https://public.example/d", "charges dismissed against defendant") is False
