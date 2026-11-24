#!/usr/bin/env python3
"""Aggregate per-leg outcome artifacts into one Slack + PR-comment summary.

Consumed by both notifier jobs in playwright-sso-login-nightly.yml. Reads
`sso-login-outcome-<provider>/` directories written by each matrix leg
(`status.txt` + optional `results.json`) and writes:

  slack_blocks.json  Slack Block Kit payload for chat.postMessage — uses a
                     native `type: table` block (see saas-provisioner's
                     slack_release_test.py for the shape) so numeric
                     columns stay right-aligned and status cells carry
                     emoji + fallback text in a real rendered table
                     instead of a monospace code block.
  pr_comment.md      GitHub Markdown for the PR sticky comment — pipe-
                     delimited table with gemoji shortcodes so GitHub
                     renders an HTML table with borders.
  status.txt         Overall verdict: passed | failed | skipped. Notifiers
                     read this to derive the header emoji.

Inputs (env):
  OUTCOMES_DIR  where actions/download-artifact wrote the pattern download
                (default: `outcomes`)
  REF_NAME      github.ref_name — shown in the header
  EVENT_NAME    github.event_name — shown in the header
  RUN_URL       full URL of the workflow run — linked from both surfaces
  GITHUB_SHA    commit under test — first 7 chars shown in the PR comment

Usage: python3 build_sso_login_summary.py [output_dir]
       (default output_dir: /tmp/sso-summary)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Must match the matrix order in the workflow so the table reads top-to-bottom
# the same as the workflow definition.
PROVIDERS = [
    "basic",
    "ldap",
    "keycloak-oidc-confidential",
    "keycloak-oidc-public",
    "msal-mock",
    "auth0-mock",
    "okta",
    "keycloak-azure-saml",
    "keycloak-azure-saml-crosssite",
]

# Status label + emoji shortcode. Uppercase text labels stay for the PR
# comment's clarity; the emoji makes the row scannable at a glance.
STATUS_META = {
    "pass":       ("pass",       "white_check_mark"),
    "flaky":      ("flaky",      "warning"),
    "fail":       ("FAIL",       "x"),
    "setup-fail": ("SETUP-FAIL", "x"),
    "no-report":  ("NO-REPORT",  "x"),
    "skipped":    ("skipped",    "fast_forward"),
    "unknown":    ("UNKNOWN",    "grey_question"),
}


def fmt_duration(ms: int) -> str:
    if not ms:
        return "-"
    total_sec = ms // 1000
    return f"{total_sec // 60}m {total_sec % 60:02d}s"


def collect_rows(in_dir: Path):
    """Walks the outcomes directory and returns (rows, verdict, totals_line).

    Each row is (provider, status_key, stats_dict_or_None). status_key is
    one of the keys in STATUS_META. stats_dict is None for
    skipped/setup-fail/no-report/unknown.
    """
    rows = []
    any_failed = False
    any_ran = False
    tot_pass = tot_fail = tot_flaky = tot_skip = tot_dur = 0

    for p in PROVIDERS:
        d = in_dir / f"sso-login-outcome-{p}"
        status_file = d / "status.txt"
        results_file = d / "results.json"

        if not status_file.exists():
            # Missing outcome artifact — treat as failure so the overall
            # verdict never posts PASSED while a leg is unaccounted for.
            any_failed = True
            rows.append((p, "unknown", None))
            continue

        status = status_file.read_text().strip()
        if status == "skipped":
            rows.append((p, "skipped", None))
        elif status == "setup-failed":
            any_failed = True
            rows.append((p, "setup-fail", None))
        elif status == "completed":
            any_ran = True
            if not results_file.exists():
                any_failed = True
                rows.append((p, "no-report", None))
                continue
            stats = json.loads(results_file.read_text()).get("stats", {}) or {}
            pass_ = int(stats.get("expected") or 0)
            fail_ = int(stats.get("unexpected") or 0)
            flaky_ = int(stats.get("flaky") or 0)
            skip_ = int(stats.get("skipped") or 0)
            dur = int(float(stats.get("duration") or 0))
            tot_pass += pass_
            tot_fail += fail_
            tot_flaky += flaky_
            tot_skip += skip_
            tot_dur += dur
            if fail_ > 0:
                any_failed = True
                key = "fail"
            elif flaky_ > 0:
                key = "flaky"
            else:
                key = "pass"
            rows.append((p, key, {
                "pass": pass_, "fail": fail_, "flaky": flaky_,
                "skip": skip_, "duration": dur,
            }))
        else:
            # Unrecognized status — same policy as missing-artifact.
            any_failed = True
            rows.append((p, "unknown", None))

    verdict = "failed" if any_failed else "passed" if any_ran else "skipped"
    totals = (
        f"Totals: {tot_pass} passed · {tot_fail} failed · "
        f"{tot_flaky} flaky · {tot_skip} skipped · duration {fmt_duration(tot_dur)}"
    )
    return rows, verdict, totals


# ── Slack Block Kit ──────────────────────────────────────────────────────────

def _raw(text) -> dict:
    return {"type": "raw_text", "text": str(text)}


def _status_cell(key: str) -> dict:
    """Rich text cell: emoji + label, kept inside one section so Slack
    renders it as `:emoji: label` on a single line."""
    label, emoji = STATUS_META[key]
    return {
        "type": "rich_text",
        "elements": [{
            "type": "rich_text_section",
            "elements": [
                {"type": "emoji", "name": emoji},
                {"type": "text", "text": f" {label}"},
            ],
        }],
    }


def build_slack_blocks(rows, verdict: str, totals: str) -> dict:
    header_row = [_raw(h) for h in ("Provider", "Status", "Pass", "Fail", "Flaky", "Skip", "Duration")]
    table_rows = [header_row]
    for provider, key, stats in rows:
        if stats is None:
            table_rows.append([_raw(provider), _status_cell(key), _raw("-"), _raw("-"), _raw("-"), _raw("-"), _raw("-")])
        else:
            table_rows.append([
                _raw(provider),
                _status_cell(key),
                _raw(stats["pass"]), _raw(stats["fail"]), _raw(stats["flaky"]), _raw(stats["skip"]),
                _raw(fmt_duration(stats["duration"])),
            ])

    verdict_word = {"passed": "PASSED", "failed": "FAILED", "skipped": "SKIPPED"}[verdict]
    verdict_emoji = {"passed": "white_check_mark", "failed": "x", "skipped": "fast_forward"}[verdict]

    ref_name = os.environ.get("REF_NAME", "")
    event_name = os.environ.get("EVENT_NAME", "")
    run_url = os.environ.get("RUN_URL", "")

    context_text = f"Branch: `{ref_name}` · Event: {event_name}"
    if run_url:
        context_text += f" · <{run_url}|View run>"

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f":{verdict_emoji}: SSO Login Nightly — {verdict_word}", "emoji": True}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": context_text}]},
        {
            "type": "table",
            # Provider column wraps long slugs (keycloak-azure-saml-crosssite);
            # numeric columns right-align to keep counts scannable.
            "column_settings": [
                {"is_wrapped": True},
                {},
                {"align": "right"},
                {"align": "right"},
                {"align": "right"},
                {"align": "right"},
                {"align": "right"},
            ],
            "rows": table_rows,
        },
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*{totals}*"}},
    ]

    # `text` is the notification fallback used by push notifications /
    # accessibility clients that don't render blocks.
    fallback = f":{verdict_emoji}: SSO Login Nightly {verdict_word} on `{ref_name}` — {totals}"
    return {"text": fallback, "blocks": blocks}


# ── PR Markdown ──────────────────────────────────────────────────────────────

STATUS_MD = {
    key: f":{emoji}: {label}"
    for key, (label, emoji) in STATUS_META.items()
}


def build_pr_markdown(rows, verdict: str, totals: str) -> str:
    md_rows = [
        "| Provider | Status | Pass | Fail | Flaky | Skip | Duration |",
        "| :--- | :--- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for provider, key, stats in rows:
        if stats is None:
            md_rows.append(f"| {provider} | {STATUS_MD[key]} | - | - | - | - | - |")
        else:
            md_rows.append(
                f"| {provider} | {STATUS_MD[key]} | {stats['pass']} | {stats['fail']} | "
                f"{stats['flaky']} | {stats['skip']} | {fmt_duration(stats['duration'])} |"
            )

    verdict_line = {
        "passed":  ":white_check_mark: SSO Login Nightly — **PASSED**",
        "failed":  ":x: SSO Login Nightly — **FAILED**",
        "skipped": ":fast_forward: SSO Login Nightly — **SKIPPED**",
    }[verdict]

    run_url = os.environ.get("RUN_URL", "")
    sha = os.environ.get("GITHUB_SHA", "")[:7]

    return "\n".join([
        "<!-- sso-login-nightly-summary -->",
        verdict_line,
        "",
        f"[View workflow run]({run_url}) · Commit `{sha}`",
        "",
        *md_rows,
        "",
        f"**{totals}**",
        "",
    ])


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sso-summary")
    in_dir = Path(os.environ.get("OUTCOMES_DIR", "outcomes"))
    out_dir.mkdir(parents=True, exist_ok=True)

    rows, verdict, totals = collect_rows(in_dir)

    (out_dir / "status.txt").write_text(verdict + "\n")
    (out_dir / "slack_blocks.json").write_text(
        json.dumps(build_slack_blocks(rows, verdict, totals), indent=2) + "\n"
    )
    (out_dir / "pr_comment.md").write_text(build_pr_markdown(rows, verdict, totals))


if __name__ == "__main__":
    main()
