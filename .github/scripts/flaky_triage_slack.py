#!/usr/bin/env python3
"""Slack side of the flaky-test triage agent (flaky-test-triage.yml).

  pending  — #pw-health alerts for open-metadata/OpenMetadata that list FLAKY tests
             and have no triage reply yet, as JSON. Collate alerts are skipped.
  history  — every alert (with its thread replies) in the last N hours whose text
             mentions a string; the agent uses it to find an earlier fix PR.
  reply    — post a thread reply under an alert.
  user     — Slack user id for an email (users.lookupByEmail), empty if none.

Reads SLACK_BOT_TOKEN. The token needs channels:history, chat:write and
users:read.email.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://slack.com/api/"
OSS = "github.com/open-metadata/OpenMetadata/"
MARKER = "Flaky triage"
FLAKY = re.compile(r"FLAKY `([^`]+)`")
PR = re.compile(r"github\.com/open-metadata/OpenMetadata/pull/(\d+)")
RUN = re.compile(
    r"<(https://github\.com/open-metadata/OpenMetadata/actions/runs/[^|>]+)\|run>"
)


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


def history(channel, hours):
    return paged(
        "conversations.history",
        "messages",
        channel=channel,
        oldest=f"{time.time() - hours * 3600:.6f}",
        limit=200,
    )


def replies(channel, ts):
    return list(
        paged("conversations.replies", "messages", channel=channel, ts=ts, limit=200)
    )[1:]


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


def pending(channel, hours, fetch_replies=replies):
    alerts = []
    for message in history(channel, hours):
        alert = parse_alert(message)
        if not alert:
            continue
        if message.get("reply_count") and any(
            MARKER in r.get("text", "") for r in fetch_replies(channel, alert["ts"])
        ):
            continue
        alerts.append(alert)
    return alerts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--channel", default="C0C008ZAK0V")  # #pw-health
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pending")
    p.add_argument("--since-hours", type=float, default=24)
    p.add_argument("--limit", type=int, default=0, help="0 = all")
    h = sub.add_parser("history")
    h.add_argument("--since-hours", type=float, default=168)
    h.add_argument("--grep", required=True)
    r = sub.add_parser("reply")
    r.add_argument("--ts", required=True)
    r.add_argument("--text-file", required=True)
    u = sub.add_parser("user")
    u.add_argument("--email", required=True)
    args = parser.parse_args()

    if args.cmd == "pending":
        alerts = pending(args.channel, args.since_hours)
        json.dump(alerts[: args.limit] if args.limit else alerts, sys.stdout, indent=2)
    elif args.cmd == "history":
        hits = [
            {
                "ts": m["ts"],
                "text": m.get("text", ""),
                "replies": [x.get("text", "") for x in replies(args.channel, m["ts"])]
                if m.get("reply_count")
                else [],
            }
            for m in history(args.channel, args.since_hours)
            if args.grep in m.get("text", "")
        ]
        json.dump(hits, sys.stdout, indent=2)
    elif args.cmd == "reply":
        with open(args.text_file, encoding="utf-8") as f:
            text = f.read()
        if MARKER not in text:
            sys.exit(f"reply must contain '{MARKER}' so later runs skip the thread")
        call(
            "chat.postMessage",
            channel=args.channel,
            thread_ts=args.ts,
            text=text,
            unfurl_links=False,
        )
    elif args.cmd == "user":
        try:
            print(call("users.lookupByEmail", email=args.email)["user"]["id"])
        except RuntimeError:
            print("")


if __name__ == "__main__":
    main()
