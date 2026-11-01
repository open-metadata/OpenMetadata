"""Cost of the CI AI calls, the usage record, and the daily cap."""

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

SCRIPTS = Path(__file__).parents[1]
sys.path.insert(0, str(SCRIPTS))

from ci_ai import usage  # noqa: E402

# 1,000 uncached input, 500 output, 2,000 cache-read, 400 cache-write tokens.
TOKENS = (1_000, 500, 2_000, 400)


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        # 1000*4 + 500*20 + 2000*0.20 + 400*5.00 (1.25 * 4)
        ("claude-opus-5-5", 0.0164),
        # 1000*2 + 500*10 + 2000*0.20 + 400*2.50
        ("claude-sonnet-5-5", 0.0084),
        # 1000*1 + 500*5 + 2000*0.10 + 400*1.25
        ("claude-haiku-4-5", 0.0042),
    ],
)
def test_cost_per_model_including_cache_reads_and_writes(model, expected):
    assert usage.cost_usd(model, *TOKENS) == pytest.approx(expected)


def test_longest_model_name_wins_so_opus_5_5_never_prices_as_opus_5():
    assert usage.price_for("claude-opus-5-5") == (usage.Price(4.00, 20.00, 0.20), True)
    assert usage.price_for("claude-opus-5") == (usage.Price(5.00, 25.00, 0.50), True)
    assert usage.price_for("claude-opus-5-5-20270101")[0] == usage.Price(4.00, 20.00, 0.20)


def test_an_unknown_model_is_priced_at_the_most_expensive_rate_and_flagged():
    price, known = usage.price_for("claude-future-9")

    assert not known
    assert price.output == max(p.output for p in usage.PRICES.values())


def response(model, usage_block):
    return SimpleNamespace(model=model, usage=usage_block)


def test_record_without_iterations_uses_the_served_model_and_top_level_usage():
    served = response("claude-opus-5-5", SimpleNamespace(input_tokens=1_000, output_tokens=500, cache_read_input_tokens=2_000, cache_creation_input_tokens=400, iterations=None))

    record = usage.record("explain", "claude-opus-5-5", "ok", served)

    assert record == {
        "role": "explain",
        "model": "claude-opus-5-5",
        "requested_model": "claude-opus-5-5",
        "input_tokens": 1_000,
        "cache_read_input_tokens": 2_000,
        "cache_creation_input_tokens": 400,
        "output_tokens": 500,
        "usd": pytest.approx(0.0164),
        "outcome": "ok",
        "price_known": True,
        "fallback_used": False,
    }


def test_a_fallback_bills_each_attempt_at_its_own_models_rate():
    iterations = [
        {"type": "message", "model": "claude-opus-5-5", "input_tokens": 100, "output_tokens": 0, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0},
        {"type": "fallback_message", "model": "claude-opus-4-8", "input_tokens": 100, "output_tokens": 200, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0},
    ]
    top_level = {"input_tokens": 100, "output_tokens": 200, "iterations": iterations}

    record = usage.record("explain", "claude-opus-5-5", "ok", {"model": "claude-opus-4-8", "usage": top_level})

    # Opus 5.5: 100 * 4; Opus 4.8: 100 * 5 + 200 * 25.
    assert record["usd"] == pytest.approx((400 + 500 + 5_000) / 1_000_000)
    assert (record["model"], record["requested_model"], record["fallback_used"]) == ("claude-opus-4-8", "claude-opus-5-5", True)
    assert (record["input_tokens"], record["output_tokens"]) == (200, 200)


def test_a_run_without_a_call_records_zero_cost_and_its_outcome(tmp_path):
    record = usage.record("explain", "claude-opus-5-5", "skipped:mode-off")
    path = tmp_path / "out" / "ci-ai-usage.json"

    usage.write(path, record)

    assert record["usd"] == 0.0 and record["outcome"] == "skipped:mode-off"
    assert all(record[name] == 0 for name in usage.TOKEN_FIELDS)
    assert path.read_text().endswith("}\n")


@pytest.mark.parametrize(
    ("count", "maximum", "reached"),
    [(0, 40, False), (39, 40, False), (40, 40, True), (41, 40, True), (0, 0, True), (-3, 1, False)],
)
def test_cap_is_reached_when_earlier_runs_used_the_allowance(count, maximum, reached):
    assert usage.cap_reached(count, maximum) is reached


def test_daily_max_comes_from_the_environment_with_a_safe_default():
    assert usage.daily_max({}) == usage.DEFAULT_DAILY_EXPLAIN_MAX
    assert usage.daily_max({usage.DAILY_MAX_ENV: "12"}) == 12
    assert usage.daily_max({usage.DAILY_MAX_ENV: "lots"}) == usage.DEFAULT_DAILY_EXPLAIN_MAX
    assert usage.daily_max({usage.DAILY_MAX_ENV: "-5"}) == 0


def test_cap_command_prints_and_appends_to_github_output(tmp_path, monkeypatch, capsys):
    output = tmp_path / "github_output"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv(usage.DAILY_MAX_ENV, "3")

    assert usage.main(["cap", "--count", "3"]) == 0
    assert usage.main(["cap", "--count", "1"]) == 0

    assert capsys.readouterr().out.splitlines() == ["cap_reached=true", "cap_reached=false"]
    assert output.read_text() == "cap_reached=true\ncap_reached=false\n"
