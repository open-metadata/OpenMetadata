#!/usr/bin/env python3
"""Token cost of the CI AI calls, the usage record each run writes, and the daily cap.

Every explain run writes ci-ai-usage.json, skipped runs included, so the daily spend
line can count outcomes as well as dollars:

  {"role", "model", "input_tokens", "cache_read_input_tokens",
   "cache_creation_input_tokens", "output_tokens", "usd", "outcome", ...}

Prices are first-party USD per million tokens. A cache write (5-minute TTL) costs
CACHE_WRITE_MULTIPLIER times the input price. When a server-side fallback answered,
usage.iterations lists every attempt with the model that ran it, and each attempt is
priced at its own model's rate. An unknown model is priced at the most expensive known
rate, and the record says so.

The daily cap is enforced before a runner starts: the dispatching workflow counts the
explain runs that already started today and asks

  python .github/scripts/ci_ai/usage.py cap --count N     # max from CI_AI_DAILY_EXPLAIN_MAX

which prints `cap_reached=true|false` and appends it to $GITHUB_OUTPUT. explain.py
applies the same check to --runs-today as a second line of defence.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CACHE_WRITE_MULTIPLIER = 1.25
DEFAULT_DAILY_EXPLAIN_MAX = 40
DAILY_MAX_ENV = "CI_AI_DAILY_EXPLAIN_MAX"
MILLION = 1_000_000


@dataclass(frozen=True)
class Price:
    input: float
    output: float
    cache_read: float

    @property
    def cache_write(self) -> float:
        return self.input * CACHE_WRITE_MULTIPLIER


PRICES = {
    "claude-opus-5-5": Price(4.00, 20.00, 0.20),
    "claude-sonnet-5-5": Price(2.00, 10.00, 0.20),
    "claude-haiku-4-5": Price(1.00, 5.00, 0.10),
    # Targets of the server-side refusal fallback bill at their own rates.
    "claude-opus-5": Price(5.00, 25.00, 0.50),
    "claude-opus-4-8": Price(5.00, 25.00, 0.50),
    "claude-sonnet-5": Price(2.00, 10.00, 0.20),
}
MOST_EXPENSIVE = max(PRICES.values(), key=lambda price: (price.output, price.input))


def price_for(model: str) -> tuple[Price, bool]:
    """(price, known). Longest name first, so claude-opus-5-5 never prices as claude-opus-5."""
    for name in sorted(PRICES, key=len, reverse=True):
        if model == name or model.startswith((f"{name}-", f"{name}@")):
            return PRICES[name], True
    return MOST_EXPENSIVE, False


def cost_usd(model: str, input_tokens: int, output_tokens: int, cache_read: int, cache_write: int) -> float:
    price, _ = price_for(model)
    total = (
        input_tokens * price.input
        + output_tokens * price.output
        + cache_read * price.cache_read
        + cache_write * price.cache_write
    )
    return round(total / MILLION, 6)


def field(obj: Any, name: str) -> Any:
    return obj.get(name) if isinstance(obj, dict) else getattr(obj, name, None)


def count(obj: Any, name: str) -> int:
    try:
        return int(field(obj, name) or 0)
    except (TypeError, ValueError):
        return 0


TOKEN_FIELDS = ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens")


def record(role: str, requested_model: str, outcome: str, response: Any = None) -> dict:
    """The usage record for one call, or for a run that made none (response None)."""
    totals = dict.fromkeys(TOKEN_FIELDS, 0)
    base = {"role": role, "model": requested_model, "requested_model": requested_model, **totals}
    if response is None:
        return {**base, "usd": 0.0, "outcome": outcome, "price_known": True, "fallback_used": False}
    usage = field(response, "usage")
    served = str(field(response, "model") or requested_model)
    # Top-level usage covers only the attempt that answered; iterations cover them all.
    attempts = list(field(usage, "iterations") or []) or [usage]
    usd, known, fallback = 0.0, True, False
    for attempt in attempts:
        kind = field(attempt, "type")
        fallback = fallback or kind == "fallback_message"
        model = str(field(attempt, "model") or (requested_model if kind == "message" else served))
        tokens = {name: count(attempt, name) for name in TOKEN_FIELDS}
        for name in TOKEN_FIELDS:
            totals[name] += tokens[name]
        usd += cost_usd(model, tokens["input_tokens"], tokens["output_tokens"], tokens["cache_read_input_tokens"], tokens["cache_creation_input_tokens"])
        known = known and price_for(model)[1]
    return {
        **base,
        "model": served,
        **totals,
        "usd": round(usd, 6),
        "outcome": outcome,
        "price_known": known,
        "fallback_used": fallback,
    }


def write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")


def daily_max(env: dict | os._Environ | None = None) -> int:
    value = (env if env is not None else os.environ).get(DAILY_MAX_ENV, "")
    try:
        return max(0, int(value)) if str(value).strip() else DEFAULT_DAILY_EXPLAIN_MAX
    except ValueError:
        return DEFAULT_DAILY_EXPLAIN_MAX


def cap_reached(count_today: int, maximum: int) -> bool:
    """True when `count_today` runs (those already started today, not this one) have
    used the daily allowance. A maximum of 0 turns the role off."""
    return max(0, int(count_today)) >= max(0, int(maximum))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CI AI usage helpers")
    commands = parser.add_subparsers(dest="command", required=True)
    cap = commands.add_parser("cap", help="Is the daily cap reached?")
    cap.add_argument("--count", type=int, required=True, help="runs already started today")
    cap.add_argument("--max", type=int, default=None, help=f"default: ${DAILY_MAX_ENV} or {DEFAULT_DAILY_EXPLAIN_MAX}")
    args = parser.parse_args(argv)
    maximum = daily_max() if args.max is None else args.max
    line = f"cap_reached={'true' if cap_reached(args.count, maximum) else 'false'}"
    print(line)
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
