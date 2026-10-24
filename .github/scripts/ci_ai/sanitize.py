"""Hygiene for text that crosses a trust boundary, in both directions.

Inbound: test names, error messages, stacks, test source and diffs come from the code
under test. Before any of it reaches the model it loses terminal escapes, control
characters and invisible or bidi characters (Trojan Source, tag-character smuggling);
its secrets are redacted; and it is wrapped in an <untrusted> block it cannot close.

Outbound: the model's text is untrusted as well. Before it reaches a PR comment, links
outside github.com/open-metadata are dropped, @-mentions stop notifying, and HTML and
block-level markdown are escaped.
"""

from __future__ import annotations

import html
import re
from urllib.parse import urlsplit

UNTRUSTED_KINDS = frozenset({"diff", "log", "test-name", "source"})
LINK_REMOVED = "[link removed]"
ALLOWED_LINK_PREFIX = "/open-metadata/"

ANSI = re.compile(r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]|\x1b[@-Z\\-_]")
CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
# Escapes, not the characters themselves: a reviewer cannot see these in source.
INVISIBLE = re.compile(
    r"[­͏؜ᅟᅠ឴឵᠋-᠏"
    r"​-‏"  # zero-width space and joiners, LRM, RLM
    r"‪-‮"  # bidi embeddings and overrides
    r"⁠-⁯"  # word joiner, invisible operators, bidi isolates
    r"ㅤ︀-️﻿ﾠ￹-￻"
    r"\U0001d173-\U0001d17a"
    r"\U000e0000-\U000e007f"  # tag characters: invisible ASCII
    r"\U000e0100-\U000e01ef]"
)

# Ported from redactSecrets in render_playwright_summary.cjs, then the token families
# a CI log can carry. Order matters: a header line is redacted whole before the token
# patterns look inside it.
PRIVATE_KEY = re.compile(
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|\Z)",
    re.DOTALL,
)
SENSITIVE_HEADER = re.compile(
    r"((?:proxy-authorization|authorization|set-cookie|cookie|x-auth-token|x-api-key|api-key)"
    r"[ \t]*[:=][ \t]*)[^\r\n]*",
    re.IGNORECASE,
)
JSON_WEB_TOKEN = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")
BEARER = re.compile(r"\b(bearer[ \t]+)[A-Za-z0-9._~+/-]{8,}=*", re.IGNORECASE)
GITHUB_TOKEN = re.compile(r"\b(?:gh[a-z]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})")
ANTHROPIC_KEY = re.compile(r"\bsk-ant-[A-Za-z0-9_-]{8,}")
AWS_SECRET = re.compile(
    r"((?:aws_?secret_?access_?key|aws_?session_?token|secret_?access_?key)[\"']?[ \t]*[:=][ \t]*[\"']?)"
    r"[A-Za-z0-9/+=]{16,}",
    re.IGNORECASE,
)
AWS_KEY_ID = re.compile(r"\b(?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA)[A-Z0-9]{16}\b")
SLACK_TOKEN = re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}")

# Anything the model could read as the end of an untrusted block, or the start of a
# new one, whether written raw or as an HTML entity.
UNTRUSTED_TAG = re.compile(r"(?:<|&lt;|&#0*60;|&#x0*3c;)(\s*/?\s*untrusted)", re.IGNORECASE)

MARKDOWN_LINK = re.compile(
    r"(!?)\[([^\]\n]*)\]\(\s*<?([^\s)>]*)>?(?:\s+(?:\"[^\"\n]*\"|'[^'\n]*'|\([^)\n]*\)))?\s*\)"
)
AUTOLINK = re.compile(r"<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]*)>")
BARE_URL = re.compile(r"(?i)\b(?:(?:https?|ftp)://|www\.)[^\s<>()\[\]{}\"'`]+")
TRAILING_PUNCTUATION = ".,;:!?'\""
MENTION = re.compile(r"@(?=[A-Za-z0-9_])")
CROSS_REPO_REF = re.compile(r"\b([A-Za-z0-9][A-Za-z0-9-]*)/([A-Za-z0-9._-]+)#(?=\d)")
LEADING_BLOCK = re.compile(r"^([#>+*=|-])")
LEADING_ORDERED = re.compile(r"^(\d+)([.)])")


def strip_invisible(text: str) -> str:
    return INVISIBLE.sub("", text)


def _redact_private_key(match: re.Match) -> str:
    """One placeholder per line of the key, keeping a leading diff marker, so a key in
    a diff does not change the hunk's line count."""
    lines = match.group(0).split("\n")
    rest = [(line[:1] if line[:1] in "+- " else "") + "<redacted>" for line in lines[1:]]
    return "\n".join(["<redacted private key>", *rest])


def redact_secrets(text: str) -> str:
    value = PRIVATE_KEY.sub(_redact_private_key, text)
    value = SENSITIVE_HEADER.sub(r"\1<redacted>", value)
    value = JSON_WEB_TOKEN.sub("<redacted>", value)
    value = BEARER.sub(r"\1<redacted>", value)
    value = GITHUB_TOKEN.sub("<redacted>", value)
    value = ANTHROPIC_KEY.sub("<redacted>", value)
    value = AWS_SECRET.sub(r"\1<redacted>", value)
    value = AWS_KEY_ID.sub("<redacted>", value)
    return SLACK_TOKEN.sub("<redacted>", value)


def clean_untrusted(value: object, max_chars: int | None = None) -> str:
    """Untrusted text as the model may see it. Invisible characters go before the
    secrets are matched, so a zero-width space inside a token cannot hide it."""
    text = ANSI.sub("", str(value if value is not None else ""))
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace(" ", "\n").replace(" ", "\n")
    text = CONTROL.sub("", strip_invisible(text))
    text = redact_secrets(text)
    if max_chars is not None and len(text) > max_chars:
        text = text[: max(0, max_chars - 1)] + "…"
    return text


def clean_untrusted_lines(text: str) -> list[str]:
    """Like clean_untrusted, for text whose line structure carries meaning (a diff):
    lines split on `\\n` only, and nothing cleaned can add or remove one."""
    lines = []
    for raw in text.split("\n"):
        line = ANSI.sub("", raw).replace("\r", "").replace(" ", " ").replace(" ", " ")
        lines.append(CONTROL.sub("", strip_invisible(line)))
    return redact_secrets("\n".join(lines)).split("\n")


def single_line(value: object, max_chars: int) -> str:
    return clean_untrusted(" ".join(str(value or "").split()), max_chars)


def neutralize_tags(text: str) -> str:
    return UNTRUSTED_TAG.sub(r"[\1", text)


def wrap_untrusted(kind: str, text: str) -> str:
    """One untrusted block. The text is cleaned here, so callers cannot forget to."""
    if kind not in UNTRUSTED_KINDS:
        raise ValueError(f"unknown untrusted kind {kind!r}")
    body = neutralize_tags(clean_untrusted(text)).strip("\n")
    return f'<untrusted kind="{kind}">\n{body}\n</untrusted>'


# ------------------------------------------------------------------- outbound


def allowed_link(url: str) -> bool:
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return False
    return (
        parts.scheme.lower() == "https"
        and parts.netloc.lower() == "github.com"
        and parts.path.lower().startswith(ALLOWED_LINK_PREFIX)
    )


def drop_links(text: str) -> str:
    """Keep links into github.com/open-metadata; reduce every other link to its label,
    and remove images and bare or autolinked URLs outright."""

    def markdown_link(match: re.Match) -> str:
        image, label, url = match.groups()
        if not image and allowed_link(url):
            return f"[{label}]({url})"
        return label

    def bare(match: re.Match) -> str:
        url = match.group(0)
        stripped = url.rstrip(TRAILING_PUNCTUATION)
        tail = url[len(stripped) :]
        return (stripped if allowed_link(stripped) else LINK_REMOVED) + tail

    text = MARKDOWN_LINK.sub(markdown_link, text)
    text = AUTOLINK.sub(lambda m: m.group(1) if allowed_link(m.group(1)) else LINK_REMOVED, text)
    return BARE_URL.sub(bare, text)


def clean_model_text(value: object, limit: int) -> str:
    """Model prose reduced to one capped paragraph of plain text with safe links."""
    text = drop_links(clean_untrusted(value))
    text = " ".join(text.split())
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def markdown_text(text: str) -> str:
    """Plain text made inert for a GitHub comment: no HTML, no notifying mentions, no
    cross-repo references, no block markup at the start."""
    value = html.escape(text, quote=False)
    value = MENTION.sub("@&#8203;", value)
    value = CROSS_REPO_REF.sub(
        lambda m: m.group(0) if m.group(1).lower() == "open-metadata" else f"{m.group(1)}/{m.group(2)}&#35;",
        value,
    )
    value = LEADING_ORDERED.sub(r"\1\\\2", value)
    return LEADING_BLOCK.sub(r"\\\1", value)


def code_span(value: object, *, table: bool = False, max_chars: int = 200) -> str:
    """A one-line code span that no backtick in the value can close early."""
    text = single_line(value, max_chars)
    if table:
        text = text.replace("|", "\\|")
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    fence = "`" * (longest + 1)
    pad = " " if not text or text.startswith("`") or text.endswith("`") else ""
    return f"{fence}{pad}{text}{pad}{fence}"


def code_block(text: str, language: str = "") -> str:
    longest = max((len(run) for run in re.findall(r"`{3,}", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}{language}\n{text.rstrip()}\n{fence}"
