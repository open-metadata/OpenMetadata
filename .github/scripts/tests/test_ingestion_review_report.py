from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ingestion_review_report as report

NOW = datetime(2026, 9, 14, tzinfo=timezone.utc)
MEMBERS = [{"login": "reviewer-a"}, {"login": "reviewer-b"}, {"login": "reviewer-c"}]


def pull(number=1, created="2026-09-10T00:00:00Z", **fields):
    return {
        "number": number,
        "created_at": created,
        "html_url": f"https://github.com/example/project/pull/{number}",
        "title": "Fix connector",
        "state": "open",
        "draft": False,
        "user": {"login": "contributor", "type": "User"},
        "requested_reviewers": [{"login": "reviewer-a"}],
        "requested_teams": [],
        "reviews": [],
        **fields,
    }


class ReviewReportTest(unittest.TestCase):
    def test_slack_rate_limit_recovers_and_permanent_rate_limit_fails(self):
        def limited():
            return urllib.error.HTTPError(
                "https://slack.com/api/chat.postMessage",
                429,
                "Too many requests",
                {"Retry-After": "1"},
                None,
            )

        with (
            patch.object(report.time, "sleep"),
            patch.object(
                report.urllib.request,
                "urlopen",
                side_effect=[limited(), io.BytesIO(b'{"ok":true,"ts":"123.456"}')],
            ),
        ):
            self.assertEqual(
                report.slack_post({"text": "Report"}, "test-token")["ts"], "123.456"
            )
        with (
            patch.object(report.time, "sleep"),
            patch.object(report.urllib.request, "urlopen", side_effect=limited()),
            self.assertRaises(urllib.error.HTTPError),
        ):
            report.slack_post({"text": "Report"}, "test-token")

    def test_open_prs_remain_after_reviews_but_drafts_and_closed_prs_are_excluded(self):
        pulls = [
            pull(1),
            pull(
                2,
                requested_reviewers=[],
                reviews=[
                    {"user": {"login": "Reviewer-B"}, "state": "APPROVED"},
                    {"user": {"login": "reviewer-b"}, "state": "COMMENTED"},
                ],
            ),
            pull(
                3,
                requested_reviewers=[],
                reviews=[
                    {"user": {"login": "reviewer-a"}, "state": "CHANGES_REQUESTED"},
                ],
            ),
            pull(4, state="closed"),
            pull(5, requested_reviewers=[{"login": "another-team"}]),
            pull(6, draft=True),
        ]
        groups = report.group_reviews(pulls, MEMBERS, "ingestion")
        self.assertEqual([pr["number"] for pr in groups["reviewer-a"]], [1, 3])
        self.assertEqual([pr["number"] for pr in groups["reviewer-b"]], [2])
        self.assertEqual(groups["reviewer-c"], [])

    def test_external_scope_uses_membership_not_author_association(self):
        pulls = [
            pull(1, author_association="COLLABORATOR"),
            pull(
                2,
                user={"login": "Internal", "type": "User"},
                author_association="CONTRIBUTOR",
            ),
            pull(3, user={"login": "automation", "type": "Bot"}),
        ]
        sections = report.group_sections(pulls, MEMBERS, "ingestion", {"internal"})
        external = sections["External contributor PRs"]
        self.assertEqual([pr["number"] for pr in external["reviewer-a"]], [1])
        internal = sections["Organization-member PRs"]
        self.assertEqual([pr["number"] for pr in internal["reviewer-a"]], [2])

    def test_team_request_does_not_duplicate_pr_already_associated_with_member(self):
        pulls = [
            pull(1, requested_reviewers=[], requested_teams=[{"slug": "ingestion"}]),
            pull(2, requested_teams=[{"slug": "ingestion"}]),
            pull(3, requested_reviewers=[], requested_teams=[{"slug": "other"}]),
        ]
        groups = report.group_reviews(pulls, MEMBERS, "ingestion")
        self.assertEqual(
            [pr["number"] for pr in groups["Team request — no individual reviewer"]],
            [1],
        )
        self.assertEqual([pr["number"] for pr in groups["reviewer-a"]], [2])

    def test_oldest_first_exact_columns_links_and_elapsed_days(self):
        pulls = [
            pull(1),
            pull(2, "2026-09-01T00:00:00Z"),
            pull(3, "2026-09-13T23:00:00Z"),
        ]
        groups = report.group_reviews(pulls, MEMBERS, "ingestion")
        markdown, messages = report.render_section(
            groups, NOW, "External contributor PRs"
        )
        self.assertIn(
            "| PR creator | PR number | Title | Days since opened |", markdown
        )
        self.assertIn(
            "| contributor | [#2](https://github.com/example/project/pull/2) | Fix connector | 13 |",
            markdown,
        )
        self.assertLess(markdown.index("[#2]"), markdown.index("[#1]"))
        self.assertLess(markdown.index("[#1]"), markdown.index("[#3]"))
        rows = messages[1]["blocks"][1]["rows"]
        self.assertEqual([row[3]["text"] for row in rows[1:]], ["13", "4", "0"])
        link = rows[1][1]["elements"][0]["elements"][0]
        self.assertEqual(
            link,
            {
                "type": "link",
                "text": "#2",
                "url": "https://github.com/example/project/pull/2",
            },
        )

    def test_multiple_reviewers_count_as_one_pr_and_untrusted_titles_are_literal(self):
        title = "Fix | <script> & <!subteam^S123>\nmore"
        pr = pull(
            title=title,
            requested_reviewers=[{"login": "reviewer-a"}, {"login": "reviewer-b"}],
        )
        markdown, messages = report.render_section(
            report.group_reviews([pr], MEMBERS, "ingestion"),
            NOW,
            "External contributor PRs",
        )
        self.assertIn("1 open PRs", messages[0]["text"])
        self.assertIn(
            "Fix &#124; &lt;script&gt; &amp; &lt;!subteam^S123&gt; more", markdown
        )
        self.assertEqual(
            messages[1]["blocks"][1]["rows"][1][2], {"type": "raw_text", "text": title}
        )

    def test_large_reports_split_without_dropping_or_reordering_prs(self):
        for title in ("Fix", "x" * 250):
            with self.subTest(title_length=len(title)):
                pulls = [pull(i, title=title) for i in range(1, 221)]
                _, messages = report.render_section(
                    {"reviewer-a": pulls}, NOW, "External contributor PRs"
                )
                numbers = []
                for message in messages[1:]:
                    rows = message["blocks"][1]["rows"]
                    self.assertLessEqual(len(rows), 100)
                    character_count = 0
                    for row in rows:
                        for cell in row:
                            if cell["type"] == "raw_text":
                                character_count += len(cell["text"])
                            else:
                                link = cell["elements"][0]["elements"][0]
                                character_count += len(link["text"]) + len(link["url"])
                    self.assertLessEqual(character_count, 10000)
                    numbers.extend(
                        row[1]["elements"][0]["elements"][0]["text"] for row in rows[1:]
                    )
                self.assertEqual(numbers, [f"#{i}" for i in range(1, 221)])

    def test_cli_paginates_members_pulls_reviews_and_writes_summary_without_posting(
        self,
    ):
        responses = {
            "orgs/example/teams/ingestion/members?per_page=100": [
                MEMBERS[:1],
                MEMBERS[1:],
            ],
            "orgs/example/members?per_page=100": [MEMBERS, [{"login": "internal"}]],
            "repos/example/project/pulls?state=open&per_page=100": [
                [pull(1, user={"login": "internal", "type": "User"})],
                [
                    pull(2, requested_reviewers=[]),
                    pull(3, draft=True),
                    pull(4, draft=True, user={"login": "internal", "type": "User"}),
                ],
            ],
            "repos/example/project/pulls/1/reviews?per_page=100": [[]],
            "repos/example/project/pulls/2/reviews?per_page=100": [
                [],
                [{"user": {"login": "reviewer-b"}, "state": "APPROVED"}],
            ],
        }

        def github(command, **kwargs):
            pages = responses[command[-1]]
            return subprocess.CompletedProcess(command, 0, json.dumps(pages), "")

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "slack.json"
            summary = Path(directory) / "summary.md"
            with (
                patch.dict(
                    os.environ,
                    {"GH_ORG_TOKEN": "test-token", "GITHUB_STEP_SUMMARY": str(summary)},
                ),
                patch.object(report.subprocess, "run", side_effect=github),
                patch.object(
                    report.urllib.request,
                    "urlopen",
                    side_effect=AssertionError("Build must not send Slack messages"),
                ),
                redirect_stdout(io.StringIO()),
            ):
                status = report.main(
                    [
                        "build",
                        "--repository",
                        "example/project",
                        "--channel",
                        "C123",
                        "--output",
                        str(output),
                    ]
                )
            self.assertEqual(status, 0)
            external_text, internal_text = summary.read_text().split(
                "## Organization-member PRs", 1
            )
            self.assertIn("[#2]", external_text)
            self.assertNotIn("[#1]", external_text)
            self.assertIn("[#1]", internal_text)
            self.assertNotIn("[#2]", internal_text)
            self.assertNotIn("[#3]", summary.read_text())
            self.assertNotIn("[#4]", summary.read_text())
            messages = json.loads(output.read_text())
            self.assertEqual(messages[0]["channel"], "C123")
            self.assertIn("External contributor PRs", messages[1]["text"])
            internal_index = next(
                i
                for i, message in enumerate(messages)
                if message["text"].startswith("Organization-member PRs")
            )
            external_numbers = [
                row[1]["elements"][0]["elements"][0]["text"]
                for message in messages[2:internal_index]
                if "blocks" in message
                for row in message["blocks"][1]["rows"][1:]
            ]
            internal_numbers = [
                row[1]["elements"][0]["elements"][0]["text"]
                for message in messages[internal_index + 1 :]
                if "blocks" in message
                for row in message["blocks"][1]["rows"][1:]
            ]
            self.assertEqual(external_numbers, ["#2"])
            self.assertEqual(internal_numbers, ["#1"])

    def test_membership_failure_does_not_publish_a_misleading_empty_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "slack.json"
            failure = subprocess.CompletedProcess([], 1, "", "HTTP 403")
            with (
                patch.dict(os.environ, {"GH_ORG_TOKEN": "test-token"}),
                patch.object(report.subprocess, "run", return_value=failure),
                redirect_stderr(io.StringIO()),
            ):
                status = report.main(
                    [
                        "build",
                        "--repository",
                        "example/project",
                        "--channel",
                        "C123",
                        "--output",
                        str(output),
                    ]
                )
            self.assertEqual(status, 1)
            self.assertFalse(output.exists())

    def test_post_uses_one_thread_and_surfaces_slack_api_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "slack.json"
            path.write_text(
                json.dumps(
                    [
                        {"channel": "C123", "text": "Report"},
                        {"channel": "C123", "text": "Reviewer"},
                    ]
                )
            )
            sent = []

            def slack(request, **kwargs):
                sent.append(json.loads(request.data))
                return io.BytesIO(json.dumps({"ok": True, "ts": "123.456"}).encode())

            with (
                patch.dict(os.environ, {"SLACK_TOKEN": "test-token"}),
                patch.object(report.urllib.request, "urlopen", side_effect=slack),
            ):
                status = report.main(["post", "--input", str(path)])
            self.assertEqual(status, 0)
            self.assertNotIn("thread_ts", sent[0])
            self.assertEqual(sent[1]["thread_ts"], "123.456")
            with (
                patch.dict(os.environ, {"SLACK_TOKEN": "test-token"}),
                patch.object(
                    report.urllib.request,
                    "urlopen",
                    return_value=io.BytesIO(b'{"ok":false,"error":"not_in_channel"}'),
                ),
                redirect_stderr(io.StringIO()),
            ):
                self.assertEqual(report.main(["post", "--input", str(path)]), 1)


if __name__ == "__main__":
    unittest.main()
