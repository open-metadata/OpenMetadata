#!/usr/bin/env python3
"""Slack and GitHub side of the flaky-test triage agent (flaky-test-triage.yml).

The agent never holds a write token. It reads the files `collect` writes and
leaves its results in an output directory; `publish`, in a job that runs no
agent code, checks them and does the writing.

  collect  — #pw-health alerts for open-metadata/OpenMetadata that list FLAKY
             tests and have no triage reply yet (pending.json), and every FLAKY
             alert with its replies from the last week (history.json), which the
             agent uses to find an earlier fix.
  publish  — push each fix branch from fixes.bundle, open its PR, then post each
             drafted reply under its alert, filling in PR links and mentions.

Agent output layout (ADR:2026-10-29-flaky-test-triage-agent-writes-nothing-itself):
  fixes/<name>.json   {"branch", "title", "body", "owner"}  body = file in fixes/
  fixes.bundle        git bundle of the fix branches (written by the workflow)
  replies/<ts>.txt    reply text; {{PR:<branch>}} and {{USER:<email>|<login>}}
                      placeholders are filled in here

Reads SLACK_BOT_TOKEN (channels:history, chat:write, users:read.email); publish
also uses gh and git with the job's PAT.
"""

import argparse
import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://slack.com/api/"
CHANNEL = "C0C008ZAK0V"  # #pw-health
OSS = "github.com/open-metadata/OpenMetadata/"
REPO = "open-metadata/OpenMetadata"
MARKER = "Flaky triage"
# Test code only. Not eslint-rules/, reporters/ or the configs: lint and the
# reporters run them on every PR, before anyone has read the diff.
FIX_PATHS = tuple(
    f"openmetadata-ui/src/main/resources/ui/playwright/{d}/"
    for d in ("e2e", "utils", "support", "constant", "fixtures", "test-data")
)
# No 'safe to test': the PR's tests run with repo secrets only after a human has
# reviewed the agent-written diff and added it.
LABELS = ("UI", "skip-pr-checks")
FLAKY = re.compile(r"FLAKY `([^`]+)`")
PR = re.compile(r"github\.com/open-metadata/OpenMetadata/pull/(\d+)")
RUN = re.compile(
    r"<(https://github\.com/open-metadata/OpenMetadata/actions/runs/[^|>]+)\|run>"
)
BRANCH = re.compile(r"^flaky-fix/[a-z0-9._-]{1,100}$")
TS = re.compile(r"^\d+\.\d+$")
PR_SLOT = re.compile(r"\{\{PR:([^}]+)\}\}")
USER_SLOT = re.compile(r"\{\{USER:([^|}]*)\|([^}]*)\}\}")


def call(method, **params):
    token = os.environ["SLACK_BOT_TOKEN"]
    if method == "chat.postMessage":
        req = urllib.request.Request(
            API + method,
            data=json.dumps(params).encode(),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
    else:
        req = urllib.request.Request(
            f"{API}{method}?{urllib.parse.urlencode(params)}",
            headers={"Authorization": f"Bearer {token}"},
        )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.load(resp)
    if not body.get("ok"):
        raise RuntimeError(f"{method}: {body.get('error')}")
    return body


def paged(method, key, **params):
    cursor = None
    while True:
        body = call(method, **params, **({"cursor": cursor} if cursor else {}))
        yield from body.get(key, [])
        cursor = body.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            return


def history(hours):
    oldest = f"{time.time() - hours * 3600:.6f}"
    return paged(
        "conversations.history", "messages", channel=CHANNEL, oldest=oldest, limit=200
    )


def replies(ts):
    messages = paged("conversations.replies", "messages", channel=CHANNEL, ts=ts)
    return [m.get("text", "") for m in list(messages)[1:]]


def parse_alert(message):
    """The OSS flaky alert in a channel message, or None for anything else."""
    text = message.get("text", "")
    tests = FLAKY.findall(text)
    if OSS not in text or not tests:
        return None
    run = RUN.search(text)
    return {
        "ts": message["ts"],
        "text": text,
        "prs": sorted(set(PR.findall(text)), key=int),
        "tests": tests,
        "run": run.group(1) if run else None,
    }


def collect(messages, fetch_replies=replies):
    """(pending, history): untriaged alerts, and every alert with its replies."""
    pending, seen = [], []
    for message in messages:
        alert = parse_alert(message)
        if not alert:
            continue
        alert["replies"] = (
            fetch_replies(alert["ts"]) if message.get("reply_count") else []
        )
        seen.append(alert)
        if not any(MARKER in r for r in alert["replies"]):
            pending.append(alert)
    return pending, seen


def fill(text, pr_urls, mention, run_url):
    text = PR_SLOT.sub(
        lambda m: pr_urls.get(m.group(1)) or f"not opened, see {run_url}", text
    )
    return USER_SLOT.sub(lambda m: mention(m.group(1), m.group(2)), text)


def slack_mention(email, login):
    if email:
        try:
            return f"<@{call('users.lookupByEmail', email=email)['user']['id']}>"
        except RuntimeError:
            pass
    return f"@{login}" if login else "unknown"


def git(*args):
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def fix_problem(fix, out, changed_files):
    """Why a drafted fix must not be published, or None."""
    if not BRANCH.match(fix.get("branch", "")):
        return f"bad branch name {fix.get('branch')!r}"
    if not 0 < len(fix.get("title", "")) <= 120:
        return "missing or long title"
    body = (out / "fixes" / fix.get("body", "")).resolve()
    if body.parent != (out / "fixes").resolve() or not body.is_file():
        return "body file missing or outside fixes/"
    if not changed_files:
        return "branch changes nothing"
    outside = [f for f in changed_files if not f.startswith(FIX_PATHS)]
    if outside:
        return f"changes files outside the test code: {outside}"
    return None


def publish(out, pending_ts, dry_run, run_url, summary):
    pr_urls = {}
    for path in sorted((out / "fixes").glob("*.json")):
        try:
            fix = json.loads(path.read_text())
        except ValueError:
            summary.append(f"- skipped {path.name}: not JSON")
            continue
        branch = fix.get("branch", "")
        changed = []
        if BRANCH.match(branch):
            try:
                git("fetch", "-q", str(out / "fixes.bundle"), f"{branch}:{branch}")
                changed = git("diff", "--name-only", f"origin/main...{branch}").split()
            except subprocess.CalledProcessError as e:
                summary.append(f"- skipped fix `{branch}`: {(e.stderr or '').strip()}")
                continue
        problem = fix_problem(fix, out, changed)
        if problem:
            summary.append(f"- skipped fix `{branch}`: {problem}")
            continue
        if dry_run:
            summary.append(f"- would open `{branch}`: {fix['title']} ({changed})")
            continue
        cmd = ["gh", "pr", "create", "-R", REPO, "--base", "main", "--head", branch]
        cmd += [
            "--title",
            fix["title"],
            "--body-file",
            str(out / "fixes" / fix["body"]),
        ]
        for label in LABELS:
            cmd += ["--label", label]
        try:
            git("push", "-q", "origin", f"{branch}:refs/heads/{branch}")
            url = subprocess.run(
                cmd, check=True, capture_output=True, text=True
            ).stdout.strip()
        except subprocess.CalledProcessError as e:
            # The reply still goes out, with "not opened, see <run>" for the link.
            summary.append(f"- failed to open `{branch}`: {(e.stderr or '').strip()}")
            continue
        pr_urls[branch] = url
        summary.append(f"- opened {url}")
        if fix.get("owner"):
            # Owner may not be a collaborator; the PR stands without them.
            subprocess.run(
                [
                    "gh",
                    "pr",
                    "edit",
                    url,
                    "--add-reviewer",
                    fix["owner"],
                    "--add-assignee",
                    fix["owner"],
                ],
                check=False,
            )

    for path in sorted((out / "replies").glob("*.txt")):
        ts = path.stem
        if not TS.match(ts) or ts not in pending_ts:
            summary.append(f"- skipped reply {path.name}: not a pending alert")
            continue
        text = fill(
            path.read_text(),
            pr_urls,
            slack_mention if not dry_run else lambda email, login: f"@{login}",
            run_url,
        )
        if MARKER not in text:
            summary.append(f"- skipped reply {ts}: no '{MARKER}' marker")
            continue
        if dry_run:
            summary.append(f"- would reply under {ts}:\n\n```\n{text}\n```")
            continue
        try:
            call(
                "chat.postMessage",
                channel=CHANNEL,
                thread_ts=ts,
                text=text,
                unfurl_links=False,
            )
        except (RuntimeError, OSError) as e:
            summary.append(f"- failed to reply under {ts}: {e}")
            continue
        summary.append(f"- replied under {ts}")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--since-hours", type=float, default=7)
    c.add_argument("--limit", type=int, default=0, help="0 = all")
    c.add_argument("--out", type=Path, required=True)
    p = sub.add_parser("publish")
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--pending", type=Path, required=True)
    p.add_argument("--run-url", required=True)
    p.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.cmd == "collect":
        # A week of alerts feeds the agent's dedupe; only the window is triaged.
        cutoff = time.time() - args.since_hours * 3600
        pending, seen = collect(history(168))
        pending = [a for a in pending if float(a["ts"]) >= cutoff]
        if args.limit:
            pending = pending[: args.limit]
        args.out.mkdir(parents=True, exist_ok=True)
        (args.out / "pending.json").write_text(json.dumps(pending, indent=2))
        (args.out / "history.json").write_text(json.dumps(seen, indent=2))
        print(len(pending))
    else:
        pending_ts = {a["ts"] for a in json.loads(args.pending.read_text())}
        summary = []
        publish(args.out, pending_ts, args.dry_run, args.run_url, summary)
        print("\n".join(summary) or "Nothing to publish.")


if __name__ == "__main__":
    main()
