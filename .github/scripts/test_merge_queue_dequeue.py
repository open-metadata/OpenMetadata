import argparse
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import merge_queue_dequeue as dequeue

URL = "https://github.com/org/repo"
# The real failure in PR #8069's 07:30 dequeue: a spaCy model download timed out.
SPACY_504 = (
    "cause: HTTP status server error (504 Gateway Timeout) for url (https://github.com/"
    "explosion/spacy-models/releases/download/en_core_web_md-3.8.0/"
    "en_core_web_md-3.8.0-py3-none-any.whl)"
)


def check(job_id, run_id, name, completed_at, conclusion="failure"):
    return {
        "id": job_id,
        "name": name,
        "conclusion": conclusion,
        "completed_at": completed_at,
        "html_url": f"{URL}/actions/runs/{run_id}/job/{job_id}",
    }


def job(job_id, workflow, name, step, conclusion="failure"):
    return {
        "id": job_id,
        "workflow_name": workflow,
        "name": name,
        "conclusion": conclusion,
        "steps": [
            {"name": "Set up job", "conclusion": "success"},
            {"name": step, "conclusion": conclusion},
        ],
    }


class ReportTest(unittest.TestCase):
    def setUp(self) -> None:
        # PR #8069's 07:30 dequeue: the build failed first, then the two gates checking it.
        self.checks = [
            check(13, 1, "py-run-tests", "2026-11-09T07:29:42Z"),
            check(
                11,
                1,
                "python-tests / Build Collate Distribution",
                "2026-11-09T07:29:30Z",
            ),
            check(12, 1, "python-tests / Verify Expected Jobs", "2026-11-09T07:29:36Z"),
            check(99, 9, "lint", "2026-11-09T07:20:00Z", "success"),
        ]
        self.jobs = {
            11: job(
                11,
                "py-tests",
                "python-tests / Build Collate Distribution",
                "Generate Python models",
            ),
            12: job(
                12, "py-tests", "python-tests / Verify Expected Jobs", "Check results"
            ),
            13: job(13, "py-tests", "py-run-tests", "Check Python test workflow"),
        }
        self.rules = [
            {"type": "pull_request", "parameters": {}},
            {
                "type": "required_status_checks",
                "parameters": {"required_status_checks": [{"context": "py-run-tests"}]},
            },
        ]
        self.read_jobs = []
        self.enterContext(
            patch.object(
                dequeue.mq, "paginated_items", side_effect=self.paginated_items
            )
        )
        self.enterContext(patch.object(dequeue.mq, "rest", side_effect=self.rest))
        self.logs = self.enterContext(
            patch.object(dequeue, "failed_logs", return_value=SPACY_504)
        )

    def paginated_items(self, path, key, token, **kwargs):
        self.assertEqual(f"/repos/org/repo/commits/{'a' * 40}/check-runs", path)
        if isinstance(self.checks, Exception):
            raise self.checks
        return self.checks

    def rest(self, path, token):
        if path == "/repos/org/repo/rules/branches/main":
            if isinstance(self.rules, Exception):
                raise self.rules
            return self.rules
        job_id = int(path.rsplit("/", 1)[-1])
        self.read_jobs.append(job_id)
        if isinstance(self.jobs, Exception):
            raise self.jobs
        return self.jobs[job_id]

    def report(self, sha="a" * 40, tests=()):
        args = argparse.Namespace(
            repo="org/repo",
            pr="8069",
            sha=sha,
            reason="FAILED_CHECKS",
            created="2026-11-09T07:30:01Z",
            branch="main",
            queue="Collate merge queue",
        )
        return dequeue.report(args, "token", tests)

    def test_each_run_is_explained_by_its_first_failed_job(self) -> None:
        markdown, _ = self.report()
        self.assertEqual(
            [
                "### 🚦 Removed from the Collate merge queue — `FAILED_CHECKS` (2026-11-09T07:30:01Z)",
                "",
                "Blocked the queue: py-run-tests",
                "",
                f"- [py-tests]({URL}/actions/runs/1): "
                f"[python-tests / Build Collate Distribution]({URL}/actions/runs/1/job/11) "
                "failed at Generate Python models; dependency download failed with HTTP 504. "
                "Also: python-tests / Verify Expected Jobs, py-run-tests.",
            ],
            markdown.splitlines(),
        )
        self.assertEqual([11], self.read_jobs)
        self.assertEqual(11, self.logs.call_args.args[1]["id"])

    def test_slack_gets_the_same_report_with_a_pr_link(self) -> None:
        _, slack = self.report()
        self.assertEqual(
            [
                f":rotating_light: *<{URL}/pull/8069|PR #8069>* removed from the "
                "Collate merge queue — `FAILED_CHECKS`",
                "Blocked the queue: py-run-tests",
                f"• <{URL}/actions/runs/1|py-tests>: "
                f"<{URL}/actions/runs/1/job/11|python-tests / Build Collate Distribution> "
                "failed at Generate Python models; dependency download failed with HTTP 504. "
                "Also: python-tests / Verify Expected Jobs, py-run-tests.",
            ],
            slack.splitlines(),
        )

    def test_a_required_check_failing_in_two_runs_is_named_once(self) -> None:
        self.checks.append(check(23, 2, "py-run-tests", "2026-11-09T07:30:43Z"))
        self.jobs[23] = job(
            23, "py-tests-postgres", "py-run-tests", "Check Python test workflow"
        )
        markdown, _ = self.report()
        self.assertIn("Blocked the queue: py-run-tests", markdown.splitlines())

    def test_cancelled_jobs_are_listed_but_never_the_cause(self) -> None:
        self.checks += [
            check(21, 2, "collate-unit-tests", "2026-11-09T07:40:14Z", "cancelled"),
            check(
                22, 2, "integration-tests-mysql", "2026-11-09T07:40:08Z", "cancelled"
            ),
            check(31, 3, "setup", "2026-11-09T07:00:00Z", "cancelled"),
            check(32, 3, "unit", "2026-11-09T07:10:00Z"),
        ]
        self.jobs[21] = job(
            21, "Maven CI", "collate-unit-tests", "Unit Tests", "cancelled"
        )
        self.jobs[22] = job(
            22, "Maven CI", "integration-tests-mysql", "Tests", "cancelled"
        )
        self.jobs[32] = job(32, "Unit", "unit", "Build")
        lines = self.report()[0].splitlines()
        self.assertIn(
            f"- [Maven CI]({URL}/actions/runs/2): "
            "integration-tests-mysql (cancelled), collate-unit-tests (cancelled).",
            lines,
        )
        self.assertIn(
            f"- [Unit]({URL}/actions/runs/3): [unit]({URL}/actions/runs/3/job/32) failed at "
            "Build; dependency download failed with HTTP 504. Also: setup (cancelled).",
            lines,
        )
        self.assertNotIn(21, self.read_jobs)
        self.assertNotIn(31, self.read_jobs)
        logged = [call.args[1]["id"] for call in self.logs.call_args_list]
        self.assertNotIn(22, logged)

    def test_setup_step_504s_are_explained_without_leaking_the_log(self) -> None:
        # Steps that failed with HTTP 504s in the #8399 dequeues.
        self.logs.return_value = (
            "Failed to download https://user:password@example.com/file?token=abcd\n"
            "HTTP status server error (504 Gateway timeout)"
        )
        for step in (
            "Set up Python 3.10",
            "Wait for OpenMetadata model generation",
            "Generate OpenMetadata ingestion models",
            "Install Python Prerequisites & Generate Models",
        ):
            self.jobs[11] = job(11, "py-tests", "build", step)
            markdown, slack = self.report()
            for text in (markdown, slack):
                self.assertIn("dependency download failed with HTTP 504", text)
                self.assertNotIn("password", text)

    def test_curl_status_without_a_protocol_name_is_a_download_failure(self) -> None:
        # Install Compose in the #8399 dequeue: curl -f prints the bare status.
        self.jobs[11] = job(11, "e2e", "caip-integration-tests", "Install Compose")
        self.logs.return_value = (
            "Download Compose v2.29.7 for linux-aarch64 from https://github.com/"
            "docker/compose/releases/download/v2.29.7/docker-compose-linux-aarch64\n"
            "curl: (22) The requested URL returned error: 504\n"
            "##[error]Process completed with exit code 22."
        )
        self.assertIn("dependency download failed with HTTP 504", self.report()[0])

    def test_test_steps_are_not_read_for_download_errors(self) -> None:
        self.logs.return_value = "Application failed to fetch response: HTTP status 500"
        for step in (
            "Unit Tests",
            "Integration Tests (MySQL + Elasticsearch)",
            "Run Playwright tests",
            "Run pytest",
        ):
            self.jobs[11] = job(11, "py-tests", "build", step)
            self.assertIn(f"failed at {step}.", self.report()[0])
        self.logs.assert_not_called()

    def test_unreadable_logs_keep_the_failed_step(self) -> None:
        self.logs.side_effect = subprocess.TimeoutExpired("gh", 60)
        self.assertIn("failed at Generate Python models. Also:", self.report()[0])

    def test_unreadable_job_keeps_the_run_listed(self) -> None:
        self.jobs = dequeue.mq.ApiError("HTTP 403", status=403)
        self.assertIn(
            f"- [run 1]({URL}/actions/runs/1): python-tests / Build Collate Distribution, "
            "python-tests / Verify Expected Jobs, py-run-tests (details unavailable).",
            self.report()[0].splitlines(),
        )

    def test_unreadable_checks_or_rules_are_reported_as_unknown(self) -> None:
        self.rules = dequeue.mq.ApiError("HTTP 403", status=403)
        self.assertIn(
            "Required checks could not be read.", self.report()[0].splitlines()
        )
        self.checks = dequeue.mq.ApiError("HTTP 403", status=403)
        self.assertIn(
            "Could not read the checks of merge-queue commit aaaaaaa.",
            self.report()[0].splitlines(),
        )

    def test_reports_without_a_failed_required_job(self) -> None:
        self.assertIn(
            "The entry left the queue before it was built, so no checks ran against it.",
            self.report(sha="")[0].splitlines(),
        )
        self.rules[1]["parameters"]["required_status_checks"] = [{"context": "lint"}]
        self.assertIn(
            "No required check failed — the entry may have timed out, or been dequeued "
            "while a required check was still pending.",
            self.report()[0].splitlines(),
        )
        self.checks = [check(99, 9, "lint", "2026-11-09T07:20:00Z", "success")]
        self.assertIn(
            "No failing check on merge-queue commit aaaaaaa — invalidated by an entry "
            "ahead in the queue, or a required check timed out.",
            self.report()[0].splitlines(),
        )

    def test_checks_api_reports_are_listed_without_reading_a_job(self) -> None:
        self.checks.append(
            {
                "id": 41,
                "name": "Unit Test Report",
                "conclusion": "failure",
                "completed_at": "2026-11-09T07:31:00Z",
                "html_url": f"{URL}/runs/41",
            }
        )
        self.assertIn(
            f"- [Unit Test Report]({URL}/runs/41)", self.report()[0].splitlines()
        )
        self.assertNotIn(41, self.read_jobs)

    def test_untrusted_names_cannot_add_markup_or_mentions(self) -> None:
        name = "<!channel> [link](https://evil.example) @team `x`"
        self.checks = [check(11, 1, name, "2026-11-09T07:29:30Z")]
        self.jobs[11] = job(11, "py-tests", name, "Unit Tests")
        markdown, slack = self.report()
        self.assertNotIn("<!channel>", slack)
        self.assertIn("&lt;!channel&gt;", slack)
        self.assertNotIn("[link](https://evil.example)", markdown)
        self.assertIn("\\[link\\]", markdown)
        self.assertIn("&#64;team", markdown)
        self.assertNotIn("`x`", markdown)

    def test_failed_tests_named_by_the_workflow_are_listed_escaped(self) -> None:
        markdown, slack = self.report(tests=["Login › signs in <!channel>"])
        self.assertEqual(
            ["", "Failed tests:", "- Login › signs in &lt;!channel&gt;"],
            markdown.splitlines()[-3:],
        )
        self.assertEqual(
            ["Failed tests:", "• Login › signs in &lt;!channel&gt;"],
            slack.splitlines()[-2:],
        )

    def test_main_writes_the_comment_and_the_slack_payload(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            body, payload = Path(directory) / "body.md", Path(directory) / "slack.json"
            tests = Path(directory) / "tests.txt"
            tests.write_text("Login › signs in\n\n")
            argv = [
                "merge_queue_dequeue.py",
                "--repo", "org/repo", "--pr", "8069", "--branch", "main",
                "--queue", "Collate merge queue", "--reason", "FAILED_CHECKS",
                "--sha", "a" * 40, "--created", "2026-11-09T07:30:01Z",
                "--channel", "C123", "--body", str(body), "--slack", str(payload),
                "--failed-tests", str(tests),
            ]  # fmt: skip
            with (
                patch.object(sys, "argv", argv),
                patch.object(dequeue.mq, "env_token", return_value="token"),
            ):
                dequeue.main()
            self.assertIn("Blocked the queue: py-run-tests", body.read_text())
            self.assertTrue(
                body.read_text().endswith("Failed tests:\n- Login › signs in\n")
            )
            slack = json.loads(payload.read_text())
            self.assertEqual("C123", slack["channel"])
            self.assertIn("Blocked the queue: py-run-tests", slack["text"])
            self.assertTrue(slack["text"].endswith("Failed tests:\n• Login › signs in"))


class LogsTest(unittest.TestCase):
    def test_direct_job_logs_are_bounded_and_filtered_to_the_failed_step(self) -> None:
        job = {
            "id": 2,
            "steps": [
                {
                    "conclusion": "failure",
                    "started_at": "2026-11-09T05:00:01Z",
                    "completed_at": "2026-11-09T05:00:02Z",
                }
            ],
        }
        expected = "2026-11-09T05:00:02.999999Z download HTTP 504"

        def produce(command: list[str], **kwargs) -> None:
            self.assertEqual(
                ["gh", "api", "repos/org/repo/actions/jobs/2/logs"], command
            )
            self.assertEqual(60, kwargs["timeout"])
            kwargs["stdout"].write(
                (
                    "2026-11-09T05:00:00Z old HTTP 500\n"
                    + expected
                    + "\n2026-11-09T05:00:03Z later\n"
                ).encode()
            )

        with patch.object(dequeue.subprocess, "run", side_effect=produce):
            self.assertEqual(expected, dequeue.failed_logs("org/repo", job))
        with (
            patch.object(dequeue.subprocess, "run", side_effect=produce),
            patch.object(dequeue, "MAX_LOG_BYTES", 10),
        ):
            self.assertEqual("", dequeue.failed_logs("org/repo", job))


if __name__ == "__main__":
    unittest.main()
