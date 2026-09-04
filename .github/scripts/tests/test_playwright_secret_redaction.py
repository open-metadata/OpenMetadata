from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[3]
RENDERER = ROOT / ".github/scripts/render_playwright_summary.cjs"
PUBLISHER = ROOT / ".github/scripts/publish_playwright_pr_comment.cjs"

LEAKED_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiJ9"
    ".eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImFkbWluIn0"
    ".dkLypt-7l9jR74XoUkNjjThCSylew4igwwBp89sfuAB0QDn9eHWjj"
)


def redact(value: str) -> str:
    harness = f"""
const {{ redactSecrets }} = require({json.dumps(str(RENDERER))});
process.stdout.write(JSON.stringify(redactSecrets({json.dumps(value)})));
"""
    result = subprocess.run(
        ["node", "-e", harness],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_bearer_header_value_is_removed_and_the_call_log_survives():
    call_log = (
        "TimeoutError: apiRequestContext.get: Timeout 30000ms exceeded.\n"
        "Call log:\n"
        "  - → GET http://localhost:8585/api/v1/apps/name/SearchIndexing\n"
        "    - accept: */*\n"
        f"    - Authorization: Bearer {LEAKED_JWT}\n"
        "    - Connection: keep-alive\n"
    )

    redacted = redact(call_log)

    assert LEAKED_JWT not in redacted
    assert "Bearer" not in redacted
    assert "    - Authorization: <redacted>\n" in redacted
    assert "Timeout 30000ms exceeded" in redacted
    assert "    - accept: */*\n" in redacted
    assert "    - Connection: keep-alive\n" in redacted


def test_redaction_stops_at_the_end_of_the_header_line():
    redacted = redact("authorization: secret\nnext line survives")

    assert redacted == "authorization: <redacted>\nnext line survives"


def test_other_credential_headers_are_covered():
    for header in (
        "Authorization",
        "proxy-authorization",
        "Cookie",
        "set-cookie",
        "X-Auth-Token",
        "x-api-key",
        "api-key",
    ):
        assert redact(f"{header}: super-secret") == f"{header}: <redacted>"

    assert redact("cookie=jwtToken=super-secret") == "cookie=<redacted>"


def test_bare_json_web_tokens_are_removed_without_a_header():
    redacted = redact(f"navigating to http://localhost:8585/?token={LEAKED_JWT}")

    assert LEAKED_JWT not in redacted
    assert redacted.endswith("?token=<redacted>")


def test_ordinary_failure_text_is_left_alone():
    message = "expect(locator).toBeVisible() failed\nLocator: getByTestId('save')"

    assert redact(message) == message


def read_redaction_block(path: Path) -> str:
    source = path.read_text(encoding="utf-8")
    match = re.search(
        r"const SENSITIVE_HEADER_PATTERN =.*?^}$",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert match, f"{path.name} no longer defines redactSecrets"
    return match.group(0)


def test_the_publisher_copy_cannot_drift_from_the_renderer_copy():
    """The trusted publisher keeps its own copy so it stays self-contained; pin
    the two implementations together so a fix to one is a fix to both."""
    assert read_redaction_block(RENDERER) == read_redaction_block(PUBLISHER)
