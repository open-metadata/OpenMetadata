"""The Messages call and the checks on its answer, through the real SDK over a fake
HTTP transport: what is sent, and what survives of what comes back."""

import json
import re
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

from ci_ai import model  # noqa: E402

anthropic = pytest.importorskip("anthropic")
try:
    import httpx2 as httpx
except ImportError:  # anthropic 0.x
    import httpx

ALLOWED = frozenset({"openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java", "docs/notes.md"})


class FakeApi:
    """The real SDK client, answering from `responder(body)` instead of the network."""

    def __init__(self, responder):
        self.requests = []

        def handler(request):
            body = json.loads(request.content)
            self.requests.append({"url": str(request.url), "headers": dict(request.headers), "body": body})
            return responder(body)

        self.client = anthropic.Anthropic(
            api_key="test-key",
            base_url="http://anthropic.test",
            max_retries=0,
            http_client=anthropic.DefaultHttpxClient(transport=httpx.MockTransport(handler)),
        )

    def __call__(self):
        return self.client


def answer(**overrides):
    return {
        "verdict": "pr_caused",
        "confidence": "high",
        "culprit_files": [{"path": "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java", "why": "stopped fetching owners"}],
        "explanation": "setFields no longer adds owners, so the PATCH response has none.",
        "next_step": "fix_then_requeue",
        "injection_suspected": False,
        **overrides,
    }


def message(text, *, stop_reason="end_turn", model_id="claude-opus-5-5", stop_details=None, usage=None):
    return httpx.Response(
        200,
        json={
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": model_id,
            "content": [{"type": "thinking", "thinking": "", "signature": "sig"}] + ([{"type": "text", "text": text}] if text is not None else []),
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "stop_details": stop_details,
            "usage": usage or {"input_tokens": 1200, "output_tokens": 300, "cache_read_input_tokens": 1100, "cache_creation_input_tokens": 0},
        },
    )


def test_request_puts_a_cached_stable_system_prompt_first_and_asks_for_the_schema():
    first = model.build_request("bundle one", "claude-opus-5-5", "low", 16_000)
    second = model.build_request("bundle two", "claude-opus-5-5", "low", 16_000)

    assert first["system"] == second["system"]
    assert first["system"] == [{"type": "text", "text": model.SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]
    assert first["messages"] == [{"role": "user", "content": "bundle one"}]
    assert first["output_config"] == {"format": {"type": "json_schema", "schema": model.OUTPUT_SCHEMA}, "effort": "low"}
    assert first["betas"] == ["server-side-fallback-2026-07-01"] and first["fallbacks"] == "default"
    assert "thinking" not in first


def test_request_drops_what_a_model_does_not_accept():
    haiku = model.build_request("b", "claude-haiku-4-5", "low", 8_000)
    sonnet = model.build_request("b", "claude-sonnet-5-5", "medium", 8_000)
    batch = model.build_request("b", "claude-opus-5-5", "low", 8_000, server_fallback=False)

    assert "effort" not in haiku["output_config"] and "fallbacks" not in haiku and "betas" not in haiku
    assert sonnet["output_config"]["effort"] == "medium" and sonnet["fallbacks"] == "default"
    assert "fallbacks" not in batch and "betas" not in batch


def test_output_schema_is_closed_and_fully_required_at_every_level():
    def check(schema):
        if schema.get("type") == "object":
            assert schema["additionalProperties"] is False
            assert set(schema["required"]) == set(schema["properties"])
            for child in schema["properties"].values():
                check(child)
        if schema.get("type") == "array":
            check(schema["items"])

    check(model.OUTPUT_SCHEMA)


def test_system_prompt_is_long_enough_to_cache_and_carries_no_per_run_values():
    assert len(model.SYSTEM_PROMPT) // 4 >= 512  # Claude Opus 5.5's minimum cacheable prefix
    assert not re.search(r"\d{4,}|#\d|\{|\}", model.SYSTEM_PROMPT)


def test_the_call_reaches_the_beta_endpoint_with_fallback_header_and_structured_output():
    api = FakeApi(lambda body: message(json.dumps(answer())))
    request = model.build_request("bundle", "claude-opus-5-5", "low", 16_000)

    result = model.call(api, request)

    assert result.outcome == "ok" and result.data == answer()
    sent = api.requests[0]
    assert sent["url"].endswith("/v1/messages?beta=true")
    assert sent["headers"]["anthropic-beta"] == "server-side-fallback-2026-07-01"
    assert sent["body"]["fallbacks"] == "default"
    assert sent["body"]["output_config"]["format"]["type"] == "json_schema"
    assert sent["body"]["output_config"]["effort"] == "low"
    assert sent["body"]["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "betas" not in sent["body"]


def test_a_refusal_is_an_outcome_not_content():
    refusal = {"type": "refusal", "category": "cyber", "explanation": None}
    api = FakeApi(lambda body: message(None, stop_reason="refusal", stop_details=refusal))

    result = model.call(api, model.build_request("b", "claude-opus-5-5", "low", 16_000))

    assert (result.outcome, result.detail, result.data) == ("refusal", "cyber", None)


@pytest.mark.parametrize(
    ("status", "error_type", "outcome"),
    [(529, "overloaded_error", "api_error:http_529"), (500, "api_error", "api_error:http_500"), (429, "rate_limit_error", "api_error:rate_limited"), (400, "invalid_request_error", "api_error:http_400")],
)
def test_api_errors_become_outcomes(status, error_type, outcome):
    api = FakeApi(lambda body: httpx.Response(status, json={"type": "error", "error": {"type": error_type, "message": "nope"}}))

    assert model.call(api, model.build_request("b", "claude-opus-5-5", "low", 16_000)).outcome == outcome


def test_connection_failures_and_missing_credentials_become_outcomes():
    def unreachable(body):
        raise httpx.ConnectError("connection refused")

    def no_credentials():
        raise TypeError("Could not resolve authentication method.")

    request = model.build_request("b", "claude-opus-5-5", "low", 16_000)

    assert model.call(FakeApi(unreachable), request).outcome == "api_error:connection"
    assert model.call(no_credentials, request).outcome == "api_error:TypeError"


@pytest.mark.parametrize(
    ("text", "stop_reason", "outcome"),
    [('{"verdict": "pr_ca', "max_tokens", "max_tokens"), ("not json", "end_turn", "invalid_json"), ("", "end_turn", "empty")],
)
def test_truncated_or_malformed_answers_are_rejected(text, stop_reason, outcome):
    api = FakeApi(lambda body: message(text, stop_reason=stop_reason))

    assert model.call(api, model.build_request("b", "claude-opus-5-5", "low", 16_000)).outcome == outcome


def test_postprocess_keeps_only_culprits_in_the_diff_normalised_and_capped():
    culprits = [
        {"path": "a/openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java", "why": "first"},
        {"path": "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java", "why": "duplicate"},
        {"path": "/etc/passwd", "why": "not in the diff"},
        {"path": "`docs/notes.md`", "why": "see @octocat " + "y" * 400},
    ]

    explanation, outcome = model.postprocess(answer(culprit_files=culprits), ALLOWED)

    assert outcome == "ok"
    assert [path for path, _ in explanation.culprit_files] == [
        "openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java",
        "docs/notes.md",
    ]
    assert len(explanation.culprit_files[1][1]) == model.WHY_CHARS


def test_postprocess_caps_the_explanation_and_drops_foreign_links():
    text = "Owners vanish; see https://evil.example/steal and https://github.com/open-metadata/OpenMetadata/pull/9. " + "z" * 2000

    explanation, _ = model.postprocess(answer(explanation=text), ALLOWED)

    assert len(explanation.explanation) == model.EXPLANATION_CHARS
    assert "evil.example" not in explanation.explanation
    assert "https://github.com/open-metadata/OpenMetadata/pull/9" in explanation.explanation


def test_suspected_injection_discards_the_whole_answer():
    assert model.postprocess(answer(injection_suspected=True), ALLOWED) == (None, "injection_suspected")


@pytest.mark.parametrize(
    "broken",
    [
        answer(verdict="merge_it"),
        answer(confidence="certain"),
        answer(next_step="force_merge"),
        answer(injection_suspected="no"),
        answer(explanation="   "),
        {**answer(), "extra": "field"},
        ["not", "an", "object"],
    ],
)
def test_postprocess_rejects_answers_outside_the_schema(broken):
    assert model.postprocess(broken, ALLOWED) == (None, "invalid_output")


def test_a_cached_explanation_is_rechecked_against_the_current_diff():
    stored = model.postprocess(answer(), ALLOWED)[0].to_dict()

    reloaded = model.Explanation.from_dict(stored, frozenset({"docs/notes.md"}))

    assert reloaded is not None and reloaded.culprit_files == []
    assert model.Explanation.from_dict({"verdict": "pr_caused"}, ALLOWED) is None
