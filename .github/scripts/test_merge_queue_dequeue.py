import argparse
import io
import json
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import merge_queue_dequeue as dequeue


class ReportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.run = {
            "id": 101,
            "run_attempt": 2,
            "head_sha": "a" * 40,
            "event": "merge_group",
            "workflow_id": 44,
        }
        self.job = {
            "id": 301,
            "name": "java",
            "conclusion": "failure",
            "steps": [{"name": "Unit Tests", "conclusion": "failure"}],
        }
        self.baseline = {
            "id": 201,
            "run_attempt": 1,
            "head_sha": "b" * 40,
            "event": "push",
            "head_branch": "main",
            "conclusion": "success",
        }
        self.base_job = {"id": 401, "name": "java", "conclusion": "success"}
        self.pages = {
            "/repos/org/repo/actions/runs/101/attempts/2/jobs": [self.job],
            f"/repos/org/repo/actions/workflows/44/runs?head_sha={'b' * 40}&status=completed": [
                self.baseline
            ],
            "/repos/org/repo/actions/runs/201/attempts/1/jobs": [self.base_job],
        }
        self.rest = self.enterContext(
            patch.object(
                dequeue.mq,
                "rest",
                side_effect=lambda path, token: (
                    self.run
                    if path.endswith("/101")
                    else {"merge_base_commit": {"sha": "b" * 40}}
                ),
            )
        )
        self.enterContext(
            patch.object(
                dequeue.mq,
                "paginated_items",
                side_effect=lambda path, key, token, **kwargs: self.pages[path],
            )
        )
        self.logs = self.enterContext(
            patch.object(dequeue, "failed_logs", return_value="")
        )

    def diagnose(self) -> str:
        return dequeue.diagnose(
            "org/repo",
            "a" * 40,
            "https://github.com/org/repo/actions/runs/101/job/301",
            self.job["name"],
            "main",
            "token",
        )

    def test_main_job_outcomes_are_context_not_proof_of_identical_failures(
        self,
    ) -> None:
        self.assertIn("possible PR/merge-group regression or flake", self.diagnose())
        self.base_job.update(
            conclusion="failure", steps=[{"name": "Build", "conclusion": "failure"}]
        )
        text = self.diagnose()
        self.assertIn("Main also failed this job", text)
        self.assertIn("matching cause unconfirmed", text)
        self.assertIn("https://github.com/org/repo/actions/runs/201", text)

    def test_exact_shared_main_commit_in_queue_is_a_valid_baseline(self) -> None:
        self.baseline.update(
            event="merge_group", head_branch="gh-readonly-queue/main/pr-123-base"
        )
        self.assertIn("Job passed on main", self.diagnose())
        self.assertIn(f"compare/{'a' * 40}...main", self.rest.call_args_list[1].args[0])

    def test_wrong_revision_branch_event_or_incomplete_job_is_not_a_baseline(
        self,
    ) -> None:
        for field, value in (
            ("head_sha", "c" * 40),
            ("head_branch", "feature"),
            ("event", "pull_request"),
            ("conclusion", "cancelled"),
        ):
            with self.subTest(field=field), patch.dict(self.baseline, {field: value}):
                self.assertIn("No completed matching main job", self.diagnose())
        for conclusion in ("skipped", "cancelled", None):
            self.base_job["conclusion"] = conclusion
            self.assertIn("No completed matching main job", self.diagnose())

    def test_stale_attempt_or_wrong_queue_commit_is_rejected(self) -> None:
        self.job["id"] = 999
        self.assertIn("not from the current queue-run attempt", self.diagnose())
        self.job["id"] = 301
        self.run["head_sha"] = "c" * 40
        self.assertIn("not from the current queue-run attempt", self.diagnose())

    def test_reported_504s_are_explained_without_artifacts_or_baseline_reads(
        self,
    ) -> None:
        self.run["status"] = "in_progress"
        for step in (
            "Set up Python 3.10",
            "Wait for OpenMetadata model generation",
            "Generate OpenMetadata ingestion models",
            "Install Python Prerequisites & Generate Models",
        ):
            self.job["steps"] = [{"name": step, "conclusion": "failure"}]
            self.logs.return_value = "Failed to download https://user:password@example.com/file?token=abcd\nHTTP status server error (504 Gateway timeout)"
            text = self.diagnose()
            self.assertIn(step, text)
            self.assertIn("HTTP 504", text)
            self.assertNotIn("password", text)
            self.assertNotIn("Job passed on main", text)
        self.assertTrue(
            all(call.args[0].endswith("/101") for call in self.rest.call_args_list)
        )

    def test_java_and_browser_application_errors_are_not_download_failures(
        self,
    ) -> None:
        self.logs.return_value = "Application failed to fetch response: HTTP status 500"
        for step in (
            "Unit Tests",
            "Integration Tests (MySQL + Elasticsearch)",
            "Integration Tests (Postgres + OpenSearch)",
            "Run Playwright tests",
        ):
            self.job["steps"] = [{"name": step, "conclusion": "failure"}]
            self.assertNotIn("download", self.diagnose())
        self.logs.assert_not_called()

    def test_summary_points_to_the_other_failed_job(self) -> None:
        self.pages["/repos/org/repo/actions/runs/101/attempts/2/jobs"].append(
            {"id": 302, "name": "build", "conclusion": "failure"}
        )
        for name in ("playwright-summary", "caip-playwright-summary"):
            self.job["name"] = name
            self.assertEqual(
                "Summary check; failed jobs in this run: build.", self.diagnose()
            )
        self.logs.assert_not_called()

    def test_unavailable_main_context_preserves_the_failed_step(self) -> None:
        self.rest.side_effect = [self.run, dequeue.mq.ApiError("HTTP 403")]
        self.assertIn(
            "Failed step: Unit Tests. Main comparison unavailable", self.diagnose()
        )

    def test_logs_expiring_does_not_prevent_main_context(self) -> None:
        self.job["steps"] = [{"name": "Build", "conclusion": "failure"}]
        self.logs.side_effect = subprocess.TimeoutExpired("gh", 60)
        self.assertIn("Failed step: Build. Job passed on main", self.diagnose())


class LogsAndRenderingTest(unittest.TestCase):
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

    def test_failure_read_and_untrusted_text_do_not_break_other_reports(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "failures.tsv"
            path.write_text(
                "bad line\nhttps://github.com/org/repo/actions/runs/1/job/2\tfirst\nhttps://github.com/org/repo/actions/runs/3/job/4\t<!channel>\n"
            )
            args = argparse.Namespace(
                repo="org/repo", sha="a" * 40, branch="main", failures=path
            )
            output = io.StringIO()
            with (
                patch.object(dequeue.mq, "env_token", return_value="token"),
                patch.object(
                    dequeue,
                    "diagnose",
                    side_effect=[
                        RuntimeError("unreadable"),
                        "Step [link](https://evil.example) @team",
                    ],
                ),
                redirect_stdout(output),
            ):
                dequeue.report(args)
            result = json.loads(output.getvalue())
            self.assertIn("Malformed Actions job reference", result["slack"])
            self.assertIn("Job details unavailable", result["slack"])
            self.assertIn("&lt;!channel&gt;", result["slack"])
            self.assertIn("\\[link\\]", result["markdown"])
            self.assertIn("&#64;team", result["markdown"])


if __name__ == "__main__":
    unittest.main()
