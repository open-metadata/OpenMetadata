import argparse
import io
import json
import os
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
import zlib
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import asdict, replace
from pathlib import Path
from unittest.mock import patch

import merge_queue_evidence as evidence


def sample(sha: str = "a" * 40) -> evidence.Evidence:
    return evidence.Evidence(
        version=1,
        sha=sha,
        base_sha="b" * 40,
        job="Integration Test Lane (parallel)",
        suite="postgres-opensearch:parallel",
        runner=["Linux", "ARM64"],
        tests={"ExampleIT#testExample": "failed:" + "e" * 64},
    )


class TestResultsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "TEST-example.xml"

    def read(self, cases: str) -> dict[str, str]:
        self.path.write_text(
            f"<testsuites><testsuite>{cases}</testsuite></testsuites>", encoding="utf-8"
        )
        return evidence.read_tests([self.path])

    def test_records_executed_skipped_and_parameterized_tests(self) -> None:
        results = self.read(
            '<testcase classname="Example" name="ok[1]"/><testcase classname="Example" name="skip"><skipped/></testcase>'
        )
        self.assertEqual(
            {"Example#ok[1]": "passed", "Example#skip": "skipped"}, results
        )

    def test_failure_signature_normalizes_whitespace_but_preserves_error(self) -> None:
        first = self.read(
            '<testcase classname="Example" name="test"><failure type="AssertionError" message="expected 1\n actual 2"/></testcase>'
        )
        same = self.read(
            '<testcase classname="Example" name="test"><failure type="AssertionError" message="expected 1 actual 2"/></testcase>'
        )
        other = self.read(
            '<testcase classname="Example" name="test"><error type="TimeoutError">Timed out</error></testcase>'
        )
        self.assertEqual(first, same)
        self.assertNotEqual(first, other)

    def test_conflicting_retries_are_not_a_passing_baseline(self) -> None:
        results = self.read(
            '<testcase classname="Example" name="test"/><testcase classname="Example" name="test"><failure message="bad"/></testcase>'
        )
        self.assertEqual("unstable", results["Example#test"])

    def test_surefire_flaky_and_rerun_markers_are_not_passing_tests(self) -> None:
        for tag in ("flakyFailure", "flakyError"):
            with self.subTest(tag=tag):
                result = self.read(
                    f'<testcase classname="Example" name="test"><{tag}>retry</{tag}></testcase>'
                )
                self.assertEqual("unstable", result["Example#test"])

    def test_consistent_failed_reruns_preserve_the_failure(self) -> None:
        first = self.read(
            '<testcase classname="Example" name="test"><failure message="bad"/></testcase>'
        )
        same = self.read(
            '<testcase classname="Example" name="test"><failure message="bad"/><rerunFailure message="bad"/></testcase>'
        )
        other = self.read(
            '<testcase classname="Example" name="test"><failure message="bad"/><rerunFailure message="different"/></testcase>'
        )
        self.assertEqual(first, same)
        self.assertEqual("unstable", other["Example#test"])

    def test_invalid_reports_cannot_supply_evidence(self) -> None:
        for cases in (
            '<testcase name="test"/>',
            '<testcase classname="Example" name="test"><failure/></testcase>',
        ):
            with self.subTest(cases=cases), self.assertRaises(ValueError):
                self.read(cases)
        self.path.write_text("<broken", encoding="utf-8")
        with self.assertRaises(ET.ParseError):
            evidence.read_tests([self.path])


class ClassificationTest(unittest.TestCase):
    def test_same_test_and_error_is_also_failing_on_main(self) -> None:
        self.assertTrue(
            evidence.compare_tests(sample(), sample()).startswith(
                "Also failing on main"
            )
        )

    def test_only_a_recorded_pass_is_a_possible_regression(self) -> None:
        baseline = replace(sample(), tests={"ExampleIT#testExample": "passed"})
        self.assertTrue(
            evidence.compare_tests(sample(), baseline).startswith(
                "Possible PR/merge-group regression"
            )
        )
        for result in ("skipped", "unstable", "failed:" + "f" * 64):
            with self.subTest(result=result):
                baseline = replace(sample(), tests={"ExampleIT#testExample": result})
                self.assertTrue(
                    evidence.compare_tests(sample(), baseline).startswith("Unknown")
                )
        self.assertTrue(
            evidence.compare_tests(sample(), replace(sample(), tests={})).startswith(
                "Unknown"
            )
        )

    def test_mixed_failures_do_not_exonerate_the_pr(self) -> None:
        candidate = replace(
            sample(), tests={**sample().tests, "NewIT#new": "failed:" + "f" * 64}
        )
        text = evidence.compare_tests(candidate, sample())
        self.assertTrue(text.startswith("Unknown"))
        self.assertIn("1 have the same failure on main, 1 unconfirmed", text)

    def test_setup_failure_and_conflicting_retries_are_unknown(self) -> None:
        for tests in (
            {},
            {"ExampleIT#testExample": "passed"},
            {**sample().tests, "Other#retry": "unstable"},
        ):
            with self.subTest(tests=tests):
                self.assertTrue(
                    evidence.compare_tests(
                        replace(sample(), tests=tests), sample()
                    ).startswith("Unknown")
                )

    def test_incomplete_or_wrong_revision_evidence_is_rejected(self) -> None:
        for updates in (
            {"sha": "f" * 40},
            {"version": 2},
            {"base_sha": ""},
            {"runner": []},
            {"tests": {"Example#test": "success"}},
        ):
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                evidence.parse_evidence(
                    {**asdict(sample()), **updates}, sha="a" * 40, job=sample().job
                )


class ComparisonApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.candidate = sample()
        self.baseline = replace(
            sample("b" * 40), tests={"ExampleIT#testExample": "passed"}
        )
        self.run = {
            "id": 101,
            "run_attempt": 2,
            "head_sha": self.candidate.sha,
            "event": "merge_group",
            "workflow_id": 44,
        }
        self.base_run = {
            "id": 201,
            "run_attempt": 3,
            "head_sha": self.baseline.sha,
            "event": "push",
            "conclusion": "success",
            "html_url": "https://github.com/org/repo/actions/runs/201",
        }
        self.job = {"id": 301, "name": self.candidate.job, "conclusion": "failure"}
        self.base_job = {"id": 401, "name": self.candidate.job, "conclusion": "success"}
        self.pages = {
            "/repos/org/repo/actions/runs/101/attempts/2/jobs": [self.job],
            "/repos/org/repo/actions/runs/201/attempts/3/jobs": [self.base_job],
            f"/repos/org/repo/actions/workflows/44/runs?head_sha={'b' * 40}&branch=main&status=completed": [
                self.base_run
            ],
            "/repos/org/repo/actions/runs/101/artifacts": [
                self.artifact(501, self.candidate.job, 2)
            ],
            "/repos/org/repo/actions/runs/201/artifacts": [
                self.artifact(601, self.candidate.job, 3)
            ],
        }
        self.archives: dict[int, bytes] = {}
        self.rest = self.enterContext(
            patch.object(evidence.mq, "rest", return_value=self.run)
        )
        self.enterContext(
            patch.object(
                evidence.mq,
                "paginated_items",
                side_effect=lambda path, key, token: self.pages[path],
            )
        )
        self.download = self.enterContext(
            patch.object(evidence.subprocess, "run", side_effect=self.archive_response)
        )

    def artifact(self, identifier: int, job: str, attempt: int) -> dict:
        return {
            "id": identifier,
            "name": f"ci-test-evidence-{job}-{attempt}",
            "expired": False,
            "size_in_bytes": 1024,
        }

    def archive_response(
        self, command: list[str], **kwargs
    ) -> subprocess.CompletedProcess:
        identifier = int(command[-1].split("/")[-2])
        if identifier in self.archives:
            return subprocess.CompletedProcess(
                command, 0, stdout=self.archives[identifier]
            )
        data = self.candidate if identifier == 501 else self.baseline
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr("evidence.json", json.dumps(asdict(data)))
        return subprocess.CompletedProcess(command, 0, stdout=archive.getvalue())

    def compare(self) -> str:
        return evidence.compare_job(
            "org/repo",
            "a" * 40,
            "https://github.com/org/repo/actions/runs/101/job/301",
            self.candidate.job,
            "main",
            "test-token",
        )

    def test_downloaded_evidence_produces_reason_and_baseline_link(self) -> None:
        text = self.compare()
        self.assertIn("Possible PR/merge-group regression", text)
        self.assertIn(self.base_run["html_url"], text)
        self.baseline = replace(self.baseline, tests=self.candidate.tests)
        self.assertIn("Also failing on main", self.compare())

    def test_exact_base_is_required_and_main_tip_is_never_used(self) -> None:
        self.baseline = replace(self.baseline, sha="f" * 40)
        self.base_run["head_sha"] = self.baseline.sha
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_missing_baseline_evidence_is_unknown(self) -> None:
        self.pages["/repos/org/repo/actions/runs/201/artifacts"] = []
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_skipped_baseline_is_unknown(self) -> None:
        self.base_job["conclusion"] = "skipped"
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_cancelled_baseline_is_unknown(self) -> None:
        self.base_run["conclusion"] = "cancelled"
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_expired_candidate_evidence_is_unknown(self) -> None:
        self.pages["/repos/org/repo/actions/runs/101/artifacts"][0]["expired"] = True
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_previous_run_attempt_is_unknown(self) -> None:
        self.job["id"] = 999
        self.assertTrue(self.compare().startswith("Unknown"))

    def test_cancelled_and_timed_out_jobs_are_named_accurately(self) -> None:
        for conclusion in ("cancelled", "timed_out", None):
            with self.subTest(conclusion=conclusion):
                self.job["conclusion"] = conclusion
                self.assertIn(
                    f"Unknown: job conclusion is {conclusion or 'pending'}",
                    self.compare(),
                )

    def test_profile_lane_and_runner_must_match(self) -> None:
        for update in (
            {"suite": "postgres-opensearch:global-state"},
            {"suite": "mysql-elasticsearch:parallel"},
            {"runner": ["Linux", "X64"]},
        ):
            with self.subTest(update=update):
                self.baseline = replace(sample("b" * 40), **update)
                self.assertTrue(self.compare().startswith("Unknown"))

    def test_archive_size_is_bounded_before_download(self) -> None:
        self.pages["/repos/org/repo/actions/runs/101/artifacts"][0]["size_in_bytes"] = (
            evidence.MAX_EVIDENCE_BYTES + 1
        )
        with self.assertRaisesRegex(ValueError, "too large"):
            self.compare()
        self.download.assert_not_called()

    def test_uncompressed_json_size_is_bounded(self) -> None:
        self.pages["/repos/org/repo/actions/runs/101/artifacts"][0]["size_in_bytes"] = 1
        with (
            patch.object(evidence, "MAX_EVIDENCE_BYTES", 32),
            self.assertRaisesRegex(ValueError, "JSON is too large"),
        ):
            self.compare()


class ReportTest(unittest.TestCase):
    def test_no_failed_jobs_report_unknown_to_both_destinations(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            failures = Path(directory) / "failures.tsv"
            failures.write_text("", encoding="utf-8")
            args = argparse.Namespace(
                repo="org/repo", sha="a" * 40, branch="main", failures=failures
            )
            output = io.StringIO()
            with (
                patch.object(evidence.mq, "env_token", return_value="test-token"),
                redirect_stdout(output),
            ):
                evidence.report(args)
            reason = (
                "Attribution: Unknown: no completed failing Actions job to compare."
            )
            self.assertEqual(
                {"markdown": reason, "slack": reason}, json.loads(output.getvalue())
            )

    def test_job_names_are_formatted_for_each_destination(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            failures = Path(directory) / "failures.tsv"
            failures.write_text(
                "https://github.com/org/repo/actions/runs/1/job/2\t  unit `tests` & <!channel>  \n",
                encoding="utf-8",
            )
            args = argparse.Namespace(
                repo="org/repo", sha="a" * 40, branch="main", failures=failures
            )
            output = io.StringIO()
            with (
                patch.object(evidence.mq, "env_token", return_value="test-token"),
                patch.object(
                    evidence,
                    "compare_job",
                    return_value="Unknown: no test evidence for this job.",
                ) as compare,
                redirect_stdout(output),
            ):
                evidence.report(args)
            self.assertIn("`tests`", output.getvalue())
            report = json.loads(output.getvalue())
            self.assertIn("`` unit `tests` & <!channel> ``", report["markdown"])
            self.assertIn("unit 'tests' &amp; &lt;!channel&gt;", report["slack"])
            for text in report.values():
                self.assertIn("Unknown: no test evidence for this job.", text)
            compare.assert_called_once_with(
                "org/repo",
                "a" * 40,
                "https://github.com/org/repo/actions/runs/1/job/2",
                "  unit `tests` & <!channel>  ",
                "main",
                "test-token",
            )

    def test_failed_evidence_read_does_not_drop_other_alerts(self) -> None:
        for failure_error in (
            evidence.mq.ApiError("HTTP 403"),
            RuntimeError("artifact decoder failed"),
            RecursionError("JSON nesting is too deep"),
            zlib.error("invalid compressed data"),
        ):
            with self.subTest(error=type(failure_error).__name__):
                with tempfile.TemporaryDirectory() as directory:
                    failures = Path(directory) / "failures.tsv"
                    failures.write_text(
                        "malformed\nhttps://github.com/org/repo/actions/runs/1/job/2\t<!channel>\nhttps://github.com/org/repo/actions/runs/3/job/4\tsecond-job\n",
                        encoding="utf-8",
                    )
                    args = argparse.Namespace(
                        repo="org/repo", sha="a" * 40, branch="main", failures=failures
                    )
                    output, error = io.StringIO(), io.StringIO()
                    with (
                        patch.object(
                            evidence.mq, "env_token", return_value="test-token"
                        ),
                        patch.object(
                            evidence,
                            "compare_job",
                            side_effect=[
                                failure_error,
                                "Also failing on main: 1 matching test failure(s).",
                            ],
                        ),
                        redirect_stdout(output),
                        redirect_stderr(error),
                    ):
                        evidence.report(args)
                    report = json.loads(output.getvalue())
                    self.assertIn("&lt;!channel&gt;: Unknown", report["slack"])
                    self.assertIn("` <!channel> `: Unknown", report["markdown"])
                    for text in report.values():
                        self.assertIn("Unknown: malformed Actions job reference", text)
                        self.assertIn("Also failing on main", text)
                        self.assertIn("second-job", text)
                    self.assertIn("warning", error.getvalue())


class RecordCliTest(unittest.TestCase):
    def test_records_the_actual_checkout_and_queue_base_without_submodules(
        self,
    ) -> None:
        script = Path(evidence.__file__).resolve()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(
                [
                    "git",
                    "-C",
                    str(root),
                    "-c",
                    "user.name=CI",
                    "-c",
                    "user.email=ci@example.com",
                    "commit",
                    "--allow-empty",
                    "-qm",
                    "test checkout",
                ],
                check=True,
            )
            sha = evidence.checkout_sha(root)
            event = root / "event.json"
            event.write_text(
                json.dumps({"merge_group": {"base_sha": "b" * 40}}), encoding="utf-8"
            )
            (root / "TEST-example.xml").write_text(
                '<testsuite><testcase classname="ExampleIT" name="testExample"/></testsuite>',
                encoding="utf-8",
            )
            output = root / "output/evidence.json"
            env = {
                **os.environ,
                "GITHUB_EVENT_PATH": str(event),
                "GITHUB_SHA": sha,
                "RUNNER_OS": "Linux",
                "RUNNER_ARCH": "ARM64",
            }
            command = [
                "python3",
                str(script),
                "record",
                "--job",
                sample().job,
                "--suite",
                sample().suite,
                "--reports",
                "TEST-*.xml",
                "--output",
                str(output),
            ]
            subprocess.run(command, cwd=root, env=env, check=True)
            result = evidence.parse_evidence(
                json.loads(output.read_text(encoding="utf-8")),
                sha=sha,
                job=sample().job,
            )
            self.assertEqual("b" * 40, result.base_sha)
            self.assertEqual(sha, result.sha)
            self.assertEqual({"ExampleIT#testExample": "passed"}, result.tests)
            event.write_text("{}", encoding="utf-8")
            subprocess.run(command, cwd=root, env=env, check=True)
            self.assertEqual(
                sha, json.loads(output.read_text(encoding="utf-8"))["base_sha"]
            )
            empty = root / "unversioned"
            empty.mkdir()
            self.assertEqual("", evidence.checkout_sha(empty))


if __name__ == "__main__":
    unittest.main()
