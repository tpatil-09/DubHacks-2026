"""The three Havenly agents. Each is independently constructible and testable."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(name: str) -> str:
    return (_PROMPT_DIR / f"{name}.md").read_text(encoding="utf-8")


def fence(tag: str, payload: Any) -> str:
    """Wrap data in a labelled block so the model treats it as data, not instructions."""
    body = payload if isinstance(payload, str) else json.dumps(payload, indent=2, ensure_ascii=False)
    body = body.replace(f"</{tag}>", f"<\\/{tag}>")  # prevent early close by embedded content
    return f"<{tag}>\n{body}\n</{tag}>"


def truncate(text: str, limit: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
