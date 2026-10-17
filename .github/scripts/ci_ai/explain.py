#!/usr/bin/env python3
"""Explain a merge-queue ejection: role 1 of the CI AI layer. Advisory only.

    python .github/scripts/ci_ai/explain.py --decision decision.json --verify-dir DIR \\
        --pr N --out comment.md [--cache verdicts.json] [--runs-today N] [--dry-run]

Reads the merge gate's decision (merge_gate.py --out), the run's verify documents and
evidence, and the entry's diff; assembles the deterministic evidence bundle; makes at
most one Messages API call; and writes the markdown section for the dequeue comment
plus ci-ai-usage.json. The model is skipped when the blocking failures carry no test
evidence, when the same failure was already explained (the verdict cache), when
CI_AI_MODE is off, or when the daily cap is reached. Whatever happens to the call, the
deterministic section is written and the exit code is 0: the explanation is advisory
and must never fail the job that reports the ejection.

Environment:
  CI_AI_MODE                off (default): never call. shadow: call, but write the AI
                            section to $GITHUB_STEP_SUMMARY only. on: call and include it.
  CI_AI_EXPLAIN_MODEL       default claude-opus-5-5
  CI_AI_EXPLAIN_EFFORT      low (default) | medium | high | xhigh | max
  CI_AI_EXPLAIN_MAX_TOKENS  default 16000, at most 20000
  CI_AI_DAILY_EXPLAIN_MAX   default 40, checked against --runs-today
  ANTHROPIC_API_KEY or the workload identity federation variables, read by the SDK.

The diff is the PR's own change in the queue: `git diff <parent> <head>` in
--repo-root, where the parent is merge_group.base_sha (--parent-sha, else the verify
documents' parentSha) and the head is the decision's headSha. The PRs ahead contribute
a stat from `git diff <base-ref>...<parent>`. Without a parent the diff falls back to
`<base-ref>...<head>`. --diff and --ahead-diff take precomputed diffs instead.

Exit: 0 when the section was written; 2 when the decision could not be read.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

SCRIPTS = Path(__file__).resolve().parents[1]
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from ci_ai import bundle as bundle_mod  # noqa: E402
from ci_ai import fingerprint as fingerprint_mod  # noqa: E402
from ci_ai import model as model_mod  # noqa: E402
from ci_ai import render as render_mod  # noqa: E402
from ci_ai import repro as repro_mod  # noqa: E402
from ci_ai import usage as usage_mod  # noqa: E402

ROLE = "explain"
MODES = ("off", "shadow", "on")
MAX_DECISION_BYTES = 4 * 1024 * 1024
MAX_DIFF_BYTES = bundle_mod.MAX_DIFF_CHARS
GIT_TIMEOUT_SECONDS = 120
MODEL_ID = re.compile(r"^[a-z0-9][a-z0-9.@:_-]{2,100}$")
REV = re.compile(r"^[A-Za-z0-9_][\w./@^~-]{0,200}$")
NOTES = {
    "skipped:no-test-evidence": "No AI explanation: the blocking failures carry no test evidence. Infrastructure failures are re-run by the gate, and deterministic checks print their own fix.",
    "skipped:daily-cap": "No AI explanation: today's explanation budget is used up.",
    "refusal": "No AI explanation: the model declined this evidence.",
    "injection_suspected": "No AI explanation: the evidence contained text aimed at the model, so only the deterministic evidence is shown.",
    "dry-run": "No AI explanation: dry run.",
}
FAILED_ANSWER = "No AI explanation: the model's answer did not pass validation."
FAILED_CALL = "No AI explanation: the model call failed."


@dataclass(frozen=True)
class Config:
    mode: str
    model: str
    effort: str
    max_tokens: int
    daily_max: int

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "Config":
        mode = (env.get("CI_AI_MODE") or "off").strip().lower()
        model = (env.get("CI_AI_EXPLAIN_MODEL") or model_mod.DEFAULT_MODEL).strip()
        effort = (env.get("CI_AI_EXPLAIN_EFFORT") or model_mod.DEFAULT_EFFORT).strip().lower()
        try:
            max_tokens = int(env.get("CI_AI_EXPLAIN_MAX_TOKENS") or model_mod.DEFAULT_MAX_TOKENS)
        except ValueError:
            max_tokens = model_mod.DEFAULT_MAX_TOKENS
        return cls(
            mode=mode if mode in MODES else "off",
            model=model if MODEL_ID.match(model) else model_mod.DEFAULT_MODEL,
            effort=effort if effort in model_mod.EFFORTS else model_mod.DEFAULT_EFFORT,
            max_tokens=min(max(max_tokens, model_mod.MIN_MAX_TOKENS), model_mod.MAX_MAX_TOKENS),
            daily_max=usage_mod.daily_max(env),
        )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--decision", type=Path, required=True, help="merge_gate.py report JSON")
    parser.add_argument("--verify-dir", type=Path, required=True, help="downloaded verify-* (and evidence-*) artifacts")
    parser.add_argument("--evidence-dir", type=Path, default=None, help="downloaded evidence-* artifacts, when kept apart")
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True, help="markdown section to append to the dequeue comment")
    parser.add_argument("--usage-out", type=Path, default=None, help="default: ci-ai-usage.json next to --out")
    parser.add_argument("--cache", type=Path, default=None, help="verdict cache JSON (LRU, 500 entries, 14 days)")
    parser.add_argument("--runs-today", type=int, default=None, help="explain runs already started today")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd(), help="checkout of the entry head")
    parser.add_argument("--head-sha", default="", help="default: the decision's headSha")
    parser.add_argument("--parent-sha", default="", help="merge_group.base_sha; default: the verify documents'")
    parser.add_argument("--base-ref", default="origin/main")
    parser.add_argument("--diff", type=Path, default=None, help="precomputed diff of the PR's own change")
    parser.add_argument("--ahead-diff", type=Path, default=None, help="precomputed diff of the PRs ahead")
    parser.add_argument("--bundle-out", type=Path, default=None, help="write the exact evidence bundle")
    parser.add_argument("--request-out", type=Path, default=None, help="write the exact request (client.beta.messages.create kwargs)")
    parser.add_argument("--dry-run", action="store_true", help="build everything, call nothing")
    return parser.parse_args(argv)


# ------------------------------------------------------------------- diff


def git_diff(root: Path, *revs: str) -> str | None:
    if not all(REV.match(rev.replace("...", "/")) for rev in revs):
        return None
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "-c", "core.quotePath=false", "diff", "--no-color", "--no-ext-diff", "--find-renames", *revs, "--"],
            capture_output=True,
            timeout=GIT_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout[:MAX_DIFF_BYTES].decode("utf-8", errors="replace")


def read_text(path: Path | None) -> str | None:
    if path is None:
        return None
    raw = bundle_mod.read_capped(path, MAX_DIFF_BYTES)
    return raw.decode("utf-8", errors="replace") if raw is not None else None


def entry_diffs(args: argparse.Namespace, decision_doc: dict, evidence: bundle_mod.Evidence) -> tuple[str | None, str | None, str]:
    """(this PR's diff, the PRs ahead's diff, why the first is missing)."""
    if args.diff is not None:
        own = read_text(args.diff)
        return own, read_text(args.ahead_diff), "" if own is not None else "the --diff file could not be read"
    context = bundle_mod.as_dict(decision_doc.get("context"))
    head = args.head_sha or str(context.get("headSha") or "")
    parent = args.parent_sha or (evidence.parent_shas[0] if evidence.parent_shas else "")
    if not bundle_mod.SHA.match(head):
        return None, None, "the decision names no head commit"
    if parent and bundle_mod.SHA.match(parent):
        own = git_diff(args.repo_root, parent, head)
        ahead = git_diff(args.repo_root, f"{args.base_ref}...{parent}")
    else:
        own, ahead = git_diff(args.repo_root, f"{args.base_ref}...{head}"), None
    return own, ahead, "" if own is not None else "git could not diff the entry in --repo-root"


# ------------------------------------------------------------------- the call


@dataclass
class AiResult:
    outcome: str
    explanation: model_mod.Explanation | None = None
    response: Any = None
    cached: bool = False
    model: str = ""


def skip_reason(bundle: bundle_mod.Bundle, config: Config, runs_today: int | None) -> str:
    if not bundle.has_test_evidence:
        return "no-test-evidence"
    if config.mode == "off":
        return "mode-off"
    if runs_today is not None and usage_mod.cap_reached(runs_today, config.daily_max):
        return "daily-cap"
    return ""


def run_ai(
    args: argparse.Namespace,
    config: Config,
    bundle: bundle_mod.Bundle,
    key: str | None,
    now: datetime,
    client_factory: Callable[[], Any],
) -> AiResult:
    reason = skip_reason(bundle, config, args.runs_today)
    if reason:
        return AiResult(f"skipped:{reason}")
    allowed = bundle.diff_paths | bundle.ahead_paths
    cache = fingerprint_mod.VerdictCache.load(args.cache, now) if args.cache else None
    hit = cache.get(key, args.pr, now) if cache is not None and key else None
    if hit is not None:
        explanation = model_mod.Explanation.from_dict(hit, allowed)
        if explanation is not None:
            cache.save()
            return AiResult("cached", explanation, cached=True, model=str(hit.get("model") or config.model))
    if args.dry_run:
        return AiResult("dry-run")
    request = model_mod.build_request(bundle.text, config.model, config.effort, config.max_tokens)
    result = model_mod.call(client_factory, request)
    if result.outcome != "ok":
        if result.detail:
            print(f"::warning::ci-ai explain: {result.outcome}: {result.detail}", file=sys.stderr)
        return AiResult(result.outcome, response=result.response)
    explanation, outcome = model_mod.postprocess(result.data, allowed)
    served = str(getattr(result.response, "model", "") or config.model)
    if explanation is not None and cache is not None and key:
        cache.put(key, {**explanation.to_dict(), "model": served}, args.pr, now)
        cache.save()
    return AiResult(outcome, explanation, response=result.response, model=served)


def note_for(outcome: str) -> str:
    if outcome in NOTES:
        return NOTES[outcome]
    if outcome.startswith("api_error:"):
        return FAILED_CALL
    if outcome in ("max_tokens", "invalid_json", "invalid_output", "empty"):
        return FAILED_ANSWER
    return ""


def append_summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text.rstrip("\n") + "\n\n")
    except OSError as exc:
        print(f"::warning::could not write the job summary: {exc}", file=sys.stderr)


# ------------------------------------------------------------------- main


def main(
    argv: list[str] | None = None,
    *,
    env: Mapping[str, str] | None = None,
    client_factory: Callable[[], Any] = model_mod.make_client,
    planner: repro_mod.Planner = repro_mod.java_plan,
    now: datetime | None = None,
) -> int:
    args = parse_args(argv)
    config = Config.from_env(os.environ if env is None else env)
    now = now or fingerprint_mod.utcnow()
    usage_path = args.usage_out or args.out.parent / "ci-ai-usage.json"
    extra = {"pr": args.pr, "mode": config.mode, "effort": config.effort}

    decision_doc = bundle_mod.load_json(args.decision, MAX_DECISION_BYTES)
    if not isinstance(decision_doc, dict):
        print(f"::error::ci-ai explain: cannot read the decision {args.decision}", file=sys.stderr)
        usage_mod.write(usage_path, {**usage_mod.record(ROLE, config.model, "error:decision-unreadable"), **extra})
        return 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    if bundle_mod.as_dict(decision_doc.get("decision")).get("verdict") != "fail":
        args.out.write_text("")
        usage_mod.write(usage_path, {**usage_mod.record(ROLE, config.model, "skipped:not-a-failure"), **extra})
        return 0

    evidence = bundle_mod.load_evidence([path for path in (args.verify_dir, args.evidence_dir) if path is not None])
    diff_text, ahead_text, diff_note = entry_diffs(args, decision_doc, evidence)
    root = args.repo_root if args.repo_root.is_dir() else None
    bundle = bundle_mod.build_bundle(decision_doc, evidence, diff_text, root, ahead_text=ahead_text, diff_note=diff_note)
    key = fingerprint_mod.explain_key(fingerprint_mod.blocking_fingerprints(decision_doc, evidence).values())
    if args.bundle_out:
        args.bundle_out.parent.mkdir(parents=True, exist_ok=True)
        args.bundle_out.write_text(bundle.text)
    if args.request_out:
        args.request_out.parent.mkdir(parents=True, exist_ok=True)
        request = model_mod.build_request(bundle.text, config.model, config.effort, config.max_tokens)
        args.request_out.write_text(json.dumps(request, indent=1))

    result = run_ai(args, config, bundle, key, now, client_factory)
    repros = repro_mod.repros_for(bundle.tests, root, planner=planner)
    ai_section = (
        render_mod.render_section(
            decision_doc, bundle, repros, result.explanation, model=result.model or config.model, effort=config.effort, cached=result.cached
        )
        if result.explanation is not None
        else ""
    )
    # Only a live role explains its absence; shadow and off leave no trace on the PR.
    note = note_for(result.outcome) if config.mode == "on" else ""
    deterministic = render_mod.render_section(decision_doc, bundle, repros, None, note=note, ci_fix=config.mode != "off")
    comment = ai_section if config.mode == "on" and ai_section else deterministic
    args.out.write_text(comment)

    record = usage_mod.record(ROLE, config.model, result.outcome, result.response)
    record.update(extra, key=key, cached=result.cached, bundle_tokens=bundle.approx_tokens)
    usage_mod.write(usage_path, record)
    line = f"ci-ai explain: {result.outcome} · {record['model']} · ${record['usd']:.4f} · bundle ≈{bundle.approx_tokens} tokens"
    print(line)
    if config.mode == "shadow" and ai_section:
        append_summary(f"{line}\n\nShadow mode: this AI section was not posted.\n\n{ai_section}")
    else:
        append_summary(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
