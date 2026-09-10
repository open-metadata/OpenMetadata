"""Build and publish open PRs grouped by ingestion reviewer."""

from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

COLUMNS = ("PR creator", "PR number", "Title", "Days since opened")


def github_list(endpoint: str, token: str | None = None) -> list[dict]:
    env = os.environ.copy()
    if token:
        env["GH_TOKEN"] = token
    result = subprocess.run(
        ["gh", "api", "--paginate", "--slurp", endpoint],
        env=env,
        capture_output=True,
        check=False,
        text=True,
        timeout=180,
    )
    if result.returncode:
        raise RuntimeError(
            f"GitHub read failed for {endpoint}: {result.stderr.strip()}"
        )
    return [item for page in json.loads(result.stdout) for item in page]


def group_reviews(
    pulls: list[dict], members: list[dict], team: str
) -> dict[str, list[dict]]:
    names = {member["login"].casefold(): member["login"] for member in members}
    groups = {name: [] for name in sorted(names.values(), key=str.casefold)}
    unassigned = []
    for pr in sorted(pulls, key=lambda pr: (pr["created_at"], pr["number"])):
        if pr["state"] != "open" or pr["draft"] or pr["user"]["type"] == "Bot":
            continue
        reviewers = {
            names[user["login"].casefold()]
            for user in pr["requested_reviewers"]
            + [review["user"] for review in pr["reviews"] if review.get("user")]
            if user["login"].casefold() in names
        }
        for reviewer in reviewers:
            groups[reviewer].append(pr)
        if not reviewers and any(t["slug"] == team for t in pr["requested_teams"]):
            unassigned.append(pr)
    if unassigned:
        groups["Team request — no individual reviewer"] = unassigned
    return groups


def group_sections(
    pulls: list[dict], members: list[dict], team: str, internal: set[str]
) -> dict[str, dict[str, list[dict]]]:
    sections = {}
    for scope, is_internal in (
        ("External contributor PRs", False),
        ("Organization-member PRs", True),
    ):
        sections[scope] = group_reviews(
            [
                pr
                for pr in pulls
                if (pr["user"]["login"].casefold() in internal) == is_internal
            ],
            members,
            team,
        )
    return sections


def markdown_cell(value: str) -> str:
    return html.escape(" ".join(value.split()), quote=False).replace("|", "&#124;")


def render_section(
    groups: dict[str, list[dict]], now: datetime, scope: str
) -> tuple[str, list[dict]]:
    count = len({pr["number"] for pulls in groups.values() for pr in pulls})
    intro = f"{scope} — {count} open PRs"
    markdown = [f"## {intro}", ""]
    messages = [{"text": intro}]
    without_prs = []
    for reviewer, pulls in groups.items():
        if not pulls:
            without_prs.append(reviewer)
            continue
        heading = f"{reviewer} ({len(pulls)})"
        if reviewer == "Team request — no individual reviewer":
            heading = f"⚠️ Needs assignment — {heading}"
        markdown.extend([f"### {heading}", ""])
        markdown.extend(["| " + " | ".join(COLUMNS) + " |", "|---|---|---|---:|"])
        rows = [[{"type": "raw_text", "text": column} for column in COLUMNS]]
        size = sum(map(len, COLUMNS))

        def flush(heading: str, rows: list) -> None:
            messages.append(
                {
                    "text": heading,
                    "blocks": [
                        {
                            "type": "section",
                            "text": {"type": "plain_text", "text": heading},
                        },
                        {
                            "type": "table",
                            "column_settings": [
                                {},
                                {},
                                {"is_wrapped": True},
                                {"align": "right"},
                            ],
                            "rows": list(rows),
                        },
                    ],
                }
            )

        for pr in pulls:
            created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            days = str(max(0, (now - created).days))
            author, number, pr_title, url = (
                pr["user"]["login"],
                f"#{pr['number']}",
                pr["title"],
                pr["html_url"],
            )
            markdown.append(
                f"| {markdown_cell(author)} | [{number}]({url}) | {markdown_cell(pr_title)} | {days} |"
            )
            # Slack limits tables to 100 rows and 10,000 characters per message.
            row_size = sum(map(len, (author, number, pr_title, url, days)))
            if len(rows) == 100 or size + row_size > 9000:
                flush(heading, rows)
                rows = rows[:1]
                size = sum(map(len, COLUMNS))
            rows.append(
                [
                    {"type": "raw_text", "text": author},
                    {
                        "type": "rich_text",
                        "elements": [
                            {
                                "type": "rich_text_section",
                                "elements": [
                                    {"type": "link", "url": url, "text": number}
                                ],
                            }
                        ],
                    },
                    {"type": "raw_text", "text": pr_title},
                    {"type": "raw_text", "text": days},
                ]
            )
            size += row_size
        flush(heading, rows)
        markdown.append("")
    if without_prs:
        markdown.extend(
            ["### No open PRs", "", *[f"- {name}" for name in without_prs], ""]
        )
        messages.append(
            {"text": "No open PRs\n" + "\n".join(f"• {name}" for name in without_prs)}
        )
    return "\n".join(markdown), messages


def render_report(
    sections: dict[str, dict[str, list[dict]]], now: datetime, repository: str
) -> tuple[str, list[dict]]:
    title = f"Open PRs by ingestion reviewer — {now:%Y-%m-%d}"
    description = (
        f"{repository} · All review states; drafts and bots excluded.\n"
        "Grouped by current review requests and previous review authors."
    )
    markdown = [f"# {title}", "", description, ""]
    messages = [{"text": f"{title}\n{description}"}]
    for scope, groups in sections.items():
        section_markdown, section_messages = render_section(groups, now, scope)
        markdown.append(section_markdown)
        messages.extend(section_messages)
    return "\n".join(markdown), messages


def slack_post(payload: dict, token: str) -> dict:
    request = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.load(response)
            if not result.get("ok"):
                raise RuntimeError(
                    f"Slack post failed: {result.get('error', 'unknown_error')}"
                )
            return result
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 2:
                raise
            delay = max(1, int(exc.headers.get("Retry-After", "1")))
            if delay > 60:
                raise RuntimeError(
                    f"Slack rate limited; retry after {delay} seconds"
                ) from exc
            time.sleep(delay)
    raise RuntimeError("Slack retry limit reached")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build")
    build.add_argument("--repository", required=True)
    build.add_argument("--team", default="ingestion")
    build.add_argument("--channel", required=True)
    build.add_argument("--output", type=Path, required=True)
    post = commands.add_parser("post")
    post.add_argument("--input", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "post":
            token = os.environ.get("SLACK_TOKEN")
            if not token:
                raise RuntimeError("SLACK_TOKEN is required to publish the report")
            messages = json.loads(args.input.read_text(encoding="utf-8"))
            parent = slack_post(messages[0], token)
            for message in messages[1:]:
                slack_post({**message, "thread_ts": parent["ts"]}, token)
            return 0

        org = args.repository.split("/", 1)[0]
        org_token = os.environ.get("GH_ORG_TOKEN")
        if not org_token:
            raise RuntimeError(
                "GH_ORG_TOKEN requires organization Members:read (or read:org)"
            )
        members = github_list(
            f"orgs/{org}/teams/{args.team}/members?per_page=100", org_token
        )
        if not members:
            raise RuntimeError(
                "Team membership is empty; refusing to publish an empty report"
            )
        internal = {
            user["login"].casefold()
            for user in github_list(f"orgs/{org}/members?per_page=100", org_token)
        }
        if not {member["login"].casefold() for member in members} <= internal:
            raise RuntimeError(
                "Organization membership is incomplete; cannot classify external authors"
            )
        pulls = github_list(f"repos/{args.repository}/pulls?state=open&per_page=100")
        pulls = [pr for pr in pulls if not pr["draft"] and pr["user"]["type"] != "Bot"]
        for pr in pulls:
            pr["reviews"] = github_list(
                f"repos/{args.repository}/pulls/{pr['number']}/reviews?per_page=100"
            )
        sections = group_sections(pulls, members, args.team, internal)
        markdown, messages = render_report(
            sections, datetime.now(timezone.utc), args.repository
        )
        args.output.write_text(
            json.dumps(
                [
                    {
                        "channel": args.channel,
                        "unfurl_links": False,
                        "unfurl_media": False,
                        **message,
                    }
                    for message in messages
                ]
            ),
            encoding="utf-8",
        )
        if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(summary, "a", encoding="utf-8") as output:
                output.write(markdown + "\n")
        print(markdown)
        return 0
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as exc:
        print(f"Report failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
