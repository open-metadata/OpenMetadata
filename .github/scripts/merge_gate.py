#!/usr/bin/env python3
"""The merge-gate controller: turns a finished ci.yml run into the `merge-gate` status.

Runs from main (workflow_run, a 10-minute sweep, or by hand), never from the code
under test. For a merge-group run it reads the run's evidence, recomputes the
decision with merge_gate_policy, and acts:

  pass    → status success
  fail    → status failure (GitHub ejects the entry once it reaches the head)
  rerun   → re-run only the jobs the decision names; status stays pending
  pending → status pending and an alert: infrastructure keeps failing

For a pull-request run the gate is strict: it mirrors the run.

Modes (vars.MERGE_GATE_MODE): `shadow` posts `merge-gate (shadow)`, which no ruleset
requires, so the live queue is untouched while verdicts are compared; `enforce`
posts `merge-gate`; `strict` posts `merge-gate` with no forgiveness and no re-runs,
which is the kill switch.

Exits 0 after acting (including "nothing to decide"), 1 when the run cannot be read.
The sweep retries unread runs, and the queue's check timeout fails closed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta
from pathlib import Path
from typing import Any

import merge_gate_entry as entry_mod
import merge_gate_evidence as evidence_mod
import merge_gate_policy as gate
import merge_gate_registry as registry
import merge_gate_triage as triage_mod
import merge_queue_metrics as mq

POLICY_PATH = Path(__file__).resolve().parents[1] / "merge-gate" / "policy.json"
IMPACT_MAP_PATH = Path(__file__).resolve().parents[1] / "java-tests" / "impact-map.json"
MODES = ("shadow", "enforce", "strict")
STATE = {gate.PASS: "success", gate.FAIL: "failure", gate.RERUN: "pending", gate.PENDING: "pending"}
# Conclusions of a run whose jobs ran. Anything else (waiting for approval, never
# started, skipped) has nothing to decide from.
RAN = frozenset({"success", "failure", "cancelled", "timed_out"})


def post(path: str, body: dict | None, token: str) -> Any:
    """One POST, no automatic retry: re-running a job twice is not idempotent."""
    request = urllib.request.Request(
        f"{mq.GITHUB_REST}{path}",
        data=json.dumps(body or {}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "openmetadata-merge-gate",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        raise mq.ApiError(f"HTTP {exc.code} {exc.reason} for POST {path}", exc.code) from exc
    return json.loads(payload) if payload.strip() else None


def ref_alive(owner: str, repo: str, branch: str, token: str) -> bool:
    try:
        mq.rest(f"/repos/{owner}/{repo}/git/ref/heads/{urllib.parse.quote(branch)}", token)
        return True
    except mq.ApiError as exc:
        if exc.status == 404:
            return False
        raise


def _run_pr(run: dict) -> set[int]:
    return {int(p["number"]) for p in run.get("pull_requests") or [] if p.get("number")}


def recent_reruns(owner: str, repo: str, workflow: str, pr: int, token: str, event: str = "merge_group") -> tuple[int, int]:
    """(re-runs of this PR's runs of `event` in 24 h, re-runs of that event anywhere in
    the last hour), counted from run attempts so the budget needs no stored state."""
    since = mq.utcnow() - timedelta(hours=24)
    runs = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/workflows/{Path(workflow).name}/runs"
        f"?event={event}&created=>={since:%Y-%m-%dT%H:%M:%SZ}",
        "workflow_runs",
        token,
        max_pages=20,
    )
    hour_ago = mq.utcnow() - timedelta(hours=1)
    per_pr = sum(
        int(r.get("run_attempt") or 1) - 1
        for r in runs
        if f"/pr-{pr}-" in (r.get("head_branch") or "") or pr in _run_pr(r)
    )
    per_hour = sum(
        int(r.get("run_attempt") or 1) - 1
        for r in runs
        if mq.parse_ts(r.get("updated_at") or r["created_at"]) >= hour_ago
    )
    return per_pr, per_hour


def parent_passed_jobs(owner: str, repo: str, workflow: str, parent_sha: str, token: str) -> frozenset[str]:
    """Jobs that passed in the latest attempt of the parent commit's ci.yml run: the
    entry ahead in the queue, or main. Empty when the parent has no such run."""
    runs = mq.rest(f"/repos/{owner}/{repo}/actions/runs?head_sha={parent_sha}&per_page=20", token)
    ours = [r for r in runs.get("workflow_runs") or [] if r.get("path") == workflow]
    if not ours:
        return frozenset()
    latest = max(ours, key=lambda r: r["id"])
    jobs = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{latest['id']}/attempts/{latest.get('run_attempt') or 1}/jobs",
        "jobs",
        token,
    )
    return frozenset(j["name"] for j in jobs if j.get("conclusion") == "success")


def independent_history(owner: str, repo: str, verified: list, entry, token: str) -> frozenset[str]:
    """Fingerprints seen failing on main or in entries sharing no PR with this one,
    read from the registry's ledger. Only an ambiguous result consults it, so the
    ledger is read only then; any error reads as no history, which ejects."""
    ambiguous = [v.fingerprint for v in verified if gate.classify_test(v) == gate.AMBIGUOUS]
    if not ambiguous:
        return frozenset()
    try:
        records = registry.ledger_read(owner, repo, token)
    except Exception as exc:  # noqa: BLE001 - any failure must mean "no history"
        print(f"::warning::ledger unreadable, treating as no history: {exc}")
        return frozenset()
    return registry.independent_history(records, ambiguous, entry.prs)


def impact_related(verified: list, entry, history: frozenset[str]) -> frozenset[str]:
    """Ambiguous tests the impact map links to the entry's diff. Only an ambiguous result
    with independent history can be forgiven, so only then is the map read; a map that
    cannot be read links every test, which ejects."""
    ambiguous = {v.test_id for v in verified if gate.classify_test(v) == gate.AMBIGUOUS and v.fingerprint in history}
    if not ambiguous:
        return frozenset()
    try:
        impact_map = json.loads(IMPACT_MAP_PATH.read_text())
    except (OSError, ValueError) as exc:
        print(f"::warning::impact map unreadable, linking every ambiguous test: {exc}")
        return frozenset(ambiguous)
    return entry_mod.impact_related(ambiguous, entry.changed_files, impact_map)


def unfinished(run: dict, context: dict) -> bool:
    """A run still going has no verdict yet: its jobs without a conclusion would read as
    passed. The sweep and a dispatch can reach one (a re-run starting, a live run), and
    its own completion is decided when it comes."""
    if run.get("status") == "completed":
        return False
    context["skipped"] = f"run is {run.get('status') or 'not finished'}"
    return True


def not_ci(run: dict, policy_doc: dict, context: dict) -> bool:
    """A run of another workflow — one a PR added under the same name included — is not
    ci.yml's evidence; `workflow_run` matches workflows by name only."""
    if run.get("path") == policy_doc["workflow"]:
        return False
    context["skipped"] = f"not a {policy_doc['workflow']} run ({run.get('path') or 'no path'})"
    return True


def did_not_run(run: dict, jobs: list[dict], context: dict) -> tuple[bool, gate.Decision | None]:
    """(stop, decision) for a run whose jobs never ran. "No failed job" is a pass only
    when jobs ran: a run that could not start (a broken workflow file, a called workflow
    asking for more permissions than ci.yml grants) fails, since nothing was tested; a
    run waiting for approval, or cancelled before any job began, gets no verdict."""
    conclusion = run.get("conclusion")
    if jobs and conclusion in RAN:
        return False, None
    if conclusion == "startup_failure" or (not jobs and conclusion in ("failure", "timed_out")):
        return True, gate.Decision(gate.FAIL, "CI did not start: no job ran, so nothing was tested.")
    context["skipped"] = f"no job ran (run concluded {conclusion or 'without a conclusion'})"
    return True, None


def entry_decision(
    owner: str, repo: str, run: dict, policy: gate.Policy, policy_doc: dict, mode: str, token: str
) -> tuple[gate.Decision | None, dict]:
    """The decision for one merge-group run of ci.yml, or None when there is nothing
    to decide (the run is not finished, not a queue ref, or the entry has already left
    the queue)."""
    ref = entry_mod.parse_queue_ref(run.get("head_branch") or "")
    context: dict[str, Any] = {"runId": run["id"], "headSha": run.get("head_sha"), "mode": mode}
    if unfinished(run, context) or not_ci(run, policy_doc, context):
        return None, context
    if ref is None:
        context["skipped"] = "not a merge-queue ref"
        return None, context
    context["pr"] = ref.pr
    if not ref_alive(owner, repo, run["head_branch"], token):
        # The stale-run sweep owns runs on dead refs; a verdict here would be noise.
        context["skipped"] = "entry no longer in the queue"
        return None, context

    attempt = int(run.get("run_attempt") or 1)
    jobs = evidence_mod.run_jobs(owner, repo, run, attempt, token)
    stop, decision = did_not_run(run, jobs, context)
    if stop:
        return decision, context
    if evidence_mod.not_sampled(jobs):
        context["skipped"] = "outside the shadow sample"
        return None, context
    failed_jobs, verified, fingerprints = evidence_mod.run_evidence(owner, repo, run, attempt, token, jobs)
    entry = entry_mod.load_entry(owner, repo, ref, run["head_sha"], token)
    strict = gate.is_strict(list(entry.changed_files), entry.truncated, policy)
    context.update(
        attempt=attempt,
        prs=sorted(entry.prs),
        changedFiles=len(entry.changed_files),
        truncatedDiff=entry.truncated,
        parentSha=ref.parent_sha,
        runCreatedAt=run.get("created_at"),
        # Its verification ran CI code the entry changed, so the registry keeps none of it.
        strict=strict,
    )
    if mode == "strict":
        jobs = [j for j in failed_jobs if j.name != policy.summary_job]
        if jobs:
            return gate.Decision(gate.FAIL, "Strict mode: a job failed.", [j.name for j in jobs]), context
        return gate.Decision(gate.PASS, "Strict mode: all jobs passed."), context

    budgets = policy_doc["budgets"]
    failed_jobs, context["triage"] = triage_mod.read_jobs(
        owner, repo, list(failed_jobs), policy, policy_doc, token, blind_retry_left=attempt < budgets["maxAttempts"]
    )
    per_pr, per_hour = recent_reruns(owner, repo, policy_doc["workflow"], ref.pr, token)
    age = (mq.utcnow() - mq.parse_ts(run["created_at"])).total_seconds() / 60
    history = independent_history(owner, repo, verified, entry, token)
    evidence = gate.Evidence(
        attempt=attempt,
        entry_age_minutes=age,
        failed_jobs=tuple(failed_jobs),
        verified=tuple(verified),
        strict=strict,
        independent_history=history,
        impact_related=impact_related(verified, entry, history),
        reruns_left=per_pr < budgets["maxInfraRerunsPerPrPerDay"]
        and per_hour < budgets["maxRerunsPerHour"],
        # Only consulted once re-runs are spent, so only fetched then.
        parent_passed_jobs=parent_passed_jobs(owner, repo, policy_doc["workflow"], ref.parent_sha, token)
        if attempt >= budgets["maxAttempts"] and failed_jobs
        else frozenset(),
    )
    context.update(entryAgeMinutes=round(age), rerunsForPr=per_pr, rerunsLastHour=per_hour)
    context["fingerprints"] = fingerprints
    return gate.decide(evidence, policy), {**context, "jobIds": {j.name: j.job_id for j in failed_jobs}}


def rerun(owner: str, repo: str, run: dict, decision: gate.Decision, job_ids: dict, token: str) -> list[str]:
    """Re-run the named jobs, each with its dependents. A single job is re-run by itself.
    Several go through the run's failed jobs, a superset that never re-runs a passing
    job: the first targeted re-run starts a new attempt, and GitHub then refuses a
    targeted re-run of any job from the attempt before it."""
    notes = []
    names = decision.rerun_jobs
    if len(names) == 1 and job_ids.get(names[0]) is not None:
        try:
            post(f"/repos/{owner}/{repo}/actions/jobs/{job_ids[names[0]]}/rerun", None, token)
            return [f"{names[0]}: re-run requested"]
        except mq.ApiError as exc:
            notes.append(f"{names[0]}: {exc}")
    post(f"/repos/{owner}/{repo}/actions/runs/{run['id']}/rerun-failed-jobs", None, token)
    return notes + [f"re-ran the run's failed jobs for {', '.join(names)}"]


def controller_url() -> str:
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    return f"{server}/{repository}/actions/runs/{run_id}" if repository and run_id else ""


def write_report(path: Path | None, payload: dict) -> None:
    text = json.dumps(payload, indent=1, sort_keys=True, default=str)
    if path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
        decision = payload.get("decision") or {}
        lines = [
            f"### merge-gate ({payload['context'].get('mode')}): {decision.get('verdict', 'skipped')}",
            "",
            decision.get("summary") or payload["context"].get("skipped", ""),
            "",
        ]
        for key in ("forgiven", "blocking"):
            for item in decision.get(key) or []:
                lines.append(f"- {key}: `{mq.sanitize_external(json.dumps(item))}`")
        lines += [f"- {reason}" for reason in decision.get("reasons") or []]
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    print(text)


def act(args: argparse.Namespace, token: str, run: dict) -> dict[str, Any]:
    """Decide one CI run by its own event and act on the verdict (the status, and any
    re-run it asks for) unless --dry-run. The report's `decision` is None when there is
    nothing to decide."""
    policy_doc = json.loads(args.policy.read_text())
    policy = gate.Policy.from_dict(policy_doc)
    if run.get("event") == "merge_group":
        decision, context = entry_decision(args.owner, args.repo, run, policy, policy_doc, args.mode, token)
        # An entry's status links the decision; a PR head's links its own run.
        target = controller_url() or run.get("html_url")
    elif run.get("event") == "pull_request":
        decision, context = pr_decision(args.owner, args.repo, run, policy, policy_doc, args.mode, token)
        target = run.get("html_url")
    else:
        return {"context": {"runId": run.get("id"), "mode": args.mode, "skipped": f"event {run.get('event')}"}, "decision": None}
    payload: dict[str, Any] = {"context": context, "decision": decision.as_dict() if decision else None}
    if decision and not args.dry_run:
        if decision.verdict == gate.RERUN:
            payload["rerun"] = rerun(args.owner, args.repo, run, decision, context.get("jobIds", {}), token)
        status_context = policy_doc["shadowStatusContext"] if args.mode == "shadow" else policy_doc["statusContext"]
        post(
            f"/repos/{args.owner}/{args.repo}/statuses/{run['head_sha']}",
            {"state": STATE[decision.verdict], "context": status_context, "description": decision.summary, "target_url": target},
            token,
        )
        if decision.alert:
            print(f"::warning::merge-gate is holding PR #{context.get('pr')}: {decision.summary}")
    return payload


def decide_one(args: argparse.Namespace, token: str, event: str | None) -> int:
    """The `entry`, `pr` and `auto` commands: one run, which must be of `event` if given."""
    run = mq.rest(f"/repos/{args.owner}/{args.repo}/actions/runs/{args.run_id}", token)
    if event and run.get("event") != event:
        payload = {"context": {"runId": args.run_id, "mode": args.mode, "skipped": f"event {run.get('event')}"}, "decision": None}
    else:
        payload = act(args, token, run)
    write_report(args.out, payload)
    return 0


def cmd_entry(args: argparse.Namespace, token: str) -> int:
    return decide_one(args, token, "merge_group")


def pr_decision(
    owner: str, repo: str, run: dict, policy: gate.Policy, policy_doc: dict, mode: str, token: str
) -> tuple[gate.Decision | None, dict]:
    """The decision for one pull_request run of ci.yml: its own result, except that a
    job which failed on infrastructure is re-run (gate.decide_pr), and drafts never pass.
    None when there is nothing to decide."""
    context: dict[str, Any] = {"runId": run["id"], "headSha": run.get("head_sha"), "mode": mode}
    if unfinished(run, context) or not_ci(run, policy_doc, context):
        return None, context
    attempt = int(run.get("run_attempt") or 1)
    jobs = evidence_mod.run_jobs(owner, repo, run, attempt, token)
    stop, decision = did_not_run(run, jobs, context)
    if stop:
        return decision, context
    if evidence_mod.not_sampled(jobs):
        context["skipped"] = "outside the shadow sample"
        return None, context
    numbers = sorted(_run_pr(run))
    if numbers:
        pull = mq.rest(f"/repos/{owner}/{repo}/pulls/{numbers[0]}", token)
        context["pr"] = numbers[0]
        if (pull.get("head") or {}).get("sha") not in (None, run.get("head_sha")):
            # A newer push has its own run; re-running this one would test stale code.
            context["skipped"] = "superseded by a newer push"
            return None, context
        if pull.get("draft"):
            return gate.Decision(gate.FAIL, "Draft PR: mark it ready for review to run the full PR lane."), context
    if run.get("conclusion") == "success":
        return gate.Decision(gate.PASS, "PR checks passed."), context
    failed_jobs, _, _ = evidence_mod.run_evidence(owner, repo, run, attempt, token, jobs)
    if mode == "strict":
        names = ", ".join(j.name for j in failed_jobs if j.name != policy.summary_job) or run.get("conclusion")
        return gate.Decision(gate.FAIL, f"PR checks failed: {names}."), context
    # PR runs get no blind retry: an unexplained failure is the author's unless read as a blip.
    failed_jobs, context["triage"] = triage_mod.read_jobs(owner, repo, failed_jobs, policy, policy_doc, token, blind_retry_left=False)
    budgets = policy_doc["budgets"]
    per_pr, per_hour = recent_reruns(owner, repo, policy_doc["workflow"], numbers[0] if numbers else 0, token, event="pull_request")
    context.update(attempt=attempt, rerunsForPr=per_pr, rerunsLastHour=per_hour)
    evidence = gate.Evidence(
        attempt=attempt,
        entry_age_minutes=0,
        failed_jobs=tuple(failed_jobs),
        reruns_left=per_pr < budgets["maxInfraRerunsPerPrPerDay"] and per_hour < budgets.get("maxPrRerunsPerHour", 20),
    )
    return gate.decide_pr(evidence, policy), {**context, "jobIds": {j.name: j.job_id for j in failed_jobs}}


def cmd_pr(args: argparse.Namespace, token: str) -> int:
    return decide_one(args, token, "pull_request")


def cmd_auto(args: argparse.Namespace, token: str) -> int:
    """Decide a run by its own event, for manual dispatch."""
    return decide_one(args, token, None)


# Verdicts per sweep; a run that gets none (outside the sample, superseded, out of the
# queue, still going) does not count, so it cannot crowd out one that does.
SWEEP_LIMIT = 50
SWEEP_PAGES = 5
# The runs API filters on creation only, and a run finishes long after it is created:
# each listing reaches back past the longest its runs and their re-runs take. Queue runs
# have their own listing and come first, so PR traffic cannot crowd them out.
SWEEP_LISTINGS = (("merge_group", timedelta(hours=6)), ("pull_request", timedelta(hours=3)))


def sweep_candidates(args: argparse.Namespace, token: str, workflow: str) -> tuple[list[dict], list[str]]:
    """Runs that finished inside the sweep's window: queue runs, then PR runs, each oldest
    first, since the oldest entry is the nearest its check timeout. A listing that cannot
    be read is reported and skipped; the other is still swept."""
    now = mq.utcnow()
    oldest, newest = now - timedelta(minutes=args.minutes), now - timedelta(minutes=args.grace_minutes)
    candidates, problems = [], []
    for event, lookback in SWEEP_LISTINGS:
        try:
            runs = mq.paginated_items(
                f"/repos/{args.owner}/{args.repo}/actions/workflows/{workflow}/runs"
                f"?event={event}&status=completed&created=>={now - lookback:%Y-%m-%dT%H:%M:%SZ}",
                "workflow_runs",
                token,
                max_pages=SWEEP_PAGES,
            )
        except mq.ApiError as exc:
            problems.append(f"{event} runs unreadable: {exc}")
            continue
        finished = [run for run in runs if oldest <= mq.parse_ts(run["updated_at"]) <= newest]
        candidates += sorted(finished, key=lambda run: mq.parse_ts(run["created_at"]))
    return candidates, problems


def cmd_sweep(args: argparse.Namespace, token: str) -> int:
    """Decide finished CI runs whose head has no gate verdict: a missed or failed
    `workflow_run` delivery must not leave an entry waiting for the queue timeout.

    A run qualifies when it finished between `--minutes` and `--grace-minutes` ago (the
    grace is the decide job's timeout, so a delivered decision is never raced) and its
    head's latest gate status is missing or pending. A re-run leaves the status pending
    until its new attempt is decided, so a missed delivery for that attempt is caught; an
    entry the gate holds is pending too, so it is decided again on each sweep in the
    window (ADR:2026-10-13-merge-queue-entries-are-decided-by-the-merge-gate-status)."""
    policy_doc = json.loads(args.policy.read_text())
    context = policy_doc["shadowStatusContext"] if args.mode == "shadow" else policy_doc["statusContext"]
    candidates, problems = sweep_candidates(args, token, Path(policy_doc["workflow"]).name)
    verdicts, reports, left = 0, [], 0
    for listed in candidates:
        if verdicts >= SWEEP_LIMIT:
            left += 1
            continue
        try:
            statuses = mq.rest(f"/repos/{args.owner}/{args.repo}/commits/{listed['head_sha']}/statuses?per_page=100", token)
            # Newest first, so the first one in the gate's context is the head's current state.
            latest = next((s for s in statuses if s.get("context") == context), None)
            if latest and latest.get("state") != "pending":
                continue
            # Read again: a re-run may have started since the listing.
            run = mq.rest(f"/repos/{args.owner}/{args.repo}/actions/runs/{listed['id']}", token)
            payload = act(args, token, run)
        except (mq.ApiError, OSError, ValueError, KeyError) as exc:
            # Counted, so an outage costs one sweep's budget and no more.
            problems.append(f"run {listed['id']}: {exc}")
            verdicts += 1
            continue
        if payload["decision"] is not None:
            verdicts += 1
            write_report(None, payload)
        reports.append(payload)
    if left:
        print(f"::warning::sweep: {SWEEP_LIMIT} verdicts reached; the next sweep reaches the {left} runs not checked")
    for problem in problems:
        print(f"::warning::sweep: {problem}")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({"candidates": len(candidates), "verdicts": verdicts, "left": left, "problems": problems, "runs": reports}, indent=1, default=str))
    print(f"sweep: {len(candidates)} runs finished in the window, {verdicts} verdicts, {left} left, {len(problems)} problems")
    return 1 if problems else 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--owner", default="open-metadata")
    parser.add_argument("--repo", default="OpenMetadata")
    parser.add_argument("--policy", type=Path, default=POLICY_PATH)
    parser.add_argument("--mode", choices=MODES, default=os.environ.get("MERGE_GATE_MODE") or "shadow")
    parser.add_argument("--dry-run", action="store_true", help="Decide and print; post nothing")
    parser.add_argument("--out", type=Path, default=None)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("entry", "pr", "auto"):
        sub = commands.add_parser(name)
        sub.add_argument("--run-id", type=int, required=True)
    sweep = commands.add_parser("sweep")
    sweep.add_argument("--minutes", type=int, default=60, help="oldest completion to consider")
    sweep.add_argument("--grace-minutes", type=int, default=15, help="newest completion to consider")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.mode not in MODES:
        print(f"::error::Unknown MERGE_GATE_MODE {args.mode!r}")
        return 1
    token = mq.env_token()
    commands = {"entry": cmd_entry, "pr": cmd_pr, "auto": cmd_auto, "sweep": cmd_sweep}
    try:
        return commands[args.command](args, token)
    except (mq.ApiError, OSError, ValueError, KeyError) as exc:
        # No status is posted: a pending gate times out closed, and the sweep retries.
        print(f"::error::merge-gate could not decide {getattr(args, 'run_id', 'the sweep')}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
