"""Logging with secret scrubbing.

Every handler installed by :func:`configure_logging` passes records through
:class:`SecretScrubber`, which redacts known secret values and token-shaped
strings before anything is emitted.
"""
from __future__ import annotations

import logging
import re
from typing import Iterable, List

_TOKEN_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"tvly-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._\-]{16,}"),
]
REDACTED = "[REDACTED]"
_known_secrets: List[str] = []


def register_secrets(values: Iterable[str]) -> None:
    for v in values:
        if v and len(v) >= 8 and v not in _known_secrets:
            _known_secrets.append(v)


def scrub(text: str) -> str:
    """Remove secrets from arbitrary text (log lines, exception messages, subprocess stderr)."""
    if not text:
        return text
    for s in _known_secrets:
        text = text.replace(s, REDACTED)
    for pat in _TOKEN_PATTERNS:
        text = pat.sub(lambda m: (m.group(1) if m.groups() else "") + REDACTED, text)
    return text


class SecretScrubber(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = scrub(record.getMessage())
        record.args = ()
        return True


def configure_logging(verbose: bool = False) -> None:
    root = logging.getLogger("safematch")
    root.setLevel(logging.DEBUG if verbose else logging.INFO)
    if not any(isinstance(f, SecretScrubber) for h in root.handlers for f in h.filters):
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s", "%H:%M:%S"))
        handler.addFilter(SecretScrubber())
        root.addHandler(handler)
    root.propagate = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"safematch.{name}")
