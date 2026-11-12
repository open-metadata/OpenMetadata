"""Compare existing CI test reports with the queue's exact main base.

ADR:2026-11-12-dequeue-alerts-compare-main-before-attributing-failures
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from functools import lru_cache

from playwright_flaky_report import pick_results

MAX_REPORT_BYTES = 16 * 1024 * 1024
MAX_JOB_LOG_BYTES = 64 * 1024 * 1024
MAX_HISTORY_COMMITS = 20
MAX_BASELINE_RUNS = 10
MAX_CACHED_READS = 128
MAX_CACHED_SNAPSHOTS = 16
MAX_ENRICHMENT_SECONDS = 90
MAX_REQUEST_SECONDS = 20
MAX_SNAPSHOTS = 8
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


class BudgetExceeded(TimeoutError):
    """Optional diagnosis must leave time to publish the alert."""


@dataclass(frozen=True)
class Test:
    name: str
    status: str
    errors: tuple[str, ...] = ()
    symptom: str = "Test assertion failed; see the linked test report."


@dataclass(frozen=True)
class Snapshot:
    run: dict
    job: dict
    tests: dict[str, Test]
    environment: tuple
    unverified_reason: str = (
        "the tested build or workflow revisions could not be verified."
    )


@dataclass(frozen=True)
class Diagnosis:
    comparison: str
    failures: tuple[Test, ...] = ()
    main: tuple[Test, ...] = ()
    pr: tuple[Test, ...] = ()
    baseline_url: str = ""
    introductions: tuple[tuple[str, str], ...] = ()


def normalized_error(message: str) -> str:
    return " ".join(ANSI.sub("", message).split())


def playwright_error(result: dict) -> str:
    errors = result.get("errors") or [result.get("error", {})]
    if any(not error.get("message") for error in errors):
        return ""
    return json.dumps(
        sorted(
            {
                normalized_error(
                    f"{error.get('stack') or error['message']} "
                    f"{json.dumps(error.get('location') or result.get('errorLocation'), sort_keys=True)}"
                )
                for error in errors
            }
        )
    )


def symptom(message: str) -> str:
    """Use fixed descriptions, never copy error messages or URLs into an alert."""
    message = normalized_error(message)
    if "toBeGreaterThan" in message and "Timeout" in message:
        return "The expected count did not increase before the timeout."
    if "toBeVisible" in message or "locator.waitFor" in message:
        return "An expected page element did not become visible before the timeout."
    if re.search(r"timeout|timed out", message, re.IGNORECASE):
        return "The test timed out."
    return "Test assertion failed; see the linked test report."


def playwright_tests(report: dict) -> dict[str, Test]:
    tests = {}

    def collect(suites: list, parents: tuple[str, ...]) -> None:
        for suite in suites:
            path = (*parents, suite["title"])
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    name = " › ".join((test["projectName"], *path, spec["title"]))
                    attempts = test.get("results", [])
                    errors = tuple(
                        sorted(
                            {
                                playwright_error(result)
                                for result in attempts
                                if result.get("status") in {"failed", "timedOut"}
                            }
                        )
                    )
                    status = {
                        "expected": "passed",
                        "unexpected": "failed",
                        "skipped": "skipped",
                        "flaky": "flaky",
                    }[test["status"]]
                    if status == "failed" and (
                        len(errors) != 1
                        or not errors[0]
                        or any(
                            r["status"] not in {"failed", "timedOut"} for r in attempts
                        )
                    ):
                        status = "unstable"
                    if status == "passed" and (
                        not attempts or any(r["status"] != "passed" for r in attempts)
                    ):
                        status = (
                            "expected-failure"
                            if test.get("expectedStatus") != "passed"
                            else "flaky"
                        )
                    last_error = (
                        attempts[-1].get("error", {}).get("message", "")
                        if attempts
                        else ""
                    )
                    result = Test(name, status, errors, symptom(last_error))
                    if name in tests and tests[name] != result:
                        result = Test(name, "unstable", errors, result.symptom)
                    tests[name] = result
            collect(suite.get("suites", []), path)

    collect(report["suites"], ())
    if report.get("errors"):
        tests["Playwright suite error outside a test"] = Test(
            "Playwright suite error outside a test", "unstable"
        )
    return tests


def junit_tests(data: bytes) -> dict[str, Test]:
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("JUnit report contains an entity declaration")
    tests = {}
    for case in ET.fromstring(data).iter("testcase"):
        name = f"{case.attrib['classname']}#{case.attrib['name']}"
        failures = [
            item
            for item in case
            if item.tag in {"failure", "error", "rerunFailure", "rerunError"}
        ]
        errors = tuple(
            sorted(
                {
                    normalized_error(
                        f"{item.get('type', '')} {item.get('message', '')} {item.text or ''}"
                    )
                    for item in failures
                }
            )
        )
        status = "failed" if errors else "passed"
        if case.find("skipped") is not None:
            status = "skipped" if not errors else "unstable"
        if (
            len(errors) > 1
            or errors == ("",)
            or any(
                not (item.get("message") or item.text or "").strip()
                for item in failures
            )
        ):
            status = "unstable"
        if any(case.find(tag) is not None for tag in ("flakyFailure", "flakyError")):
            status = "unstable" if errors else "flaky"
        result = Test(name, status, errors, symptom(errors[-1]) if errors else "")
        if name in tests and tests[name] != result:
            result = Test(name, "unstable", errors, result.symptom)
        tests[name] = result
    return tests


def download(path: str, limit: int, token: str, timeout: float = 60) -> bytes:
    request = urllib.request.Request(f"https://api.github.com/{path}")
    # Artifact and log endpoints redirect to storage; never forward the GitHub token.
    request.add_unredirected_header("Authorization", f"Bearer {token}")
    deadline = time.monotonic() + timeout
    data = bytearray()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        while len(data) <= limit:
            if time.monotonic() >= deadline:
                raise TimeoutError("CI evidence download budget exhausted")
            chunk = response.read1(min(65536, limit + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
    if len(data) > limit:
        raise ValueError("CI evidence exceeds its size limit")
    return bytes(data)


def checkout_revisions(logs: str) -> tuple:
    revisions, repository, awaiting_sha = {}, "", False
    for raw in logs.splitlines():
        line = re.sub(r"^\S+Z\s", "", raw)
        if "Syncing repository: " in line:
            repository = line.rsplit("/", 1)[-1]
            awaiting_sha = False
        if "[command]" in line and "git log -1 --format=%H" in line:
            awaiting_sha = True
        elif awaiting_sha and re.fullmatch(r"[0-9a-f]{40}", line):
            if repository in {"OpenMetadata", "ai-platform"}:
                revisions[repository] = line
            awaiting_sha = False
    if "OpenMetadata" not in revisions:
        raise ValueError("Resolved dependency revisions are unavailable")
    return tuple(sorted(revisions.items()))


def artifact_matches(name: str, job: dict) -> bool:
    matrix = re.search(r"\(([^)]+)\)$", job["name"])
    parameters = [value.strip() for value in matrix[1].split(",")] if matrix else []
    if name.startswith("playwright-results-json-"):
        shard = re.sub(
            r"-a\d+(?:-retry)?$", "", name.removeprefix("playwright-results-json-")
        )
        expected = (
            "webserver"
            if "local-webserver" in job["name"]
            else (parameters[0] if parameters else "1")
        )
        return shard == expected and (
            "playwright" in job["name"].lower()
            or job["name"] == "caip-integration-tests"
        )
    if "-junit-" in name:
        family = "unit" if "Unit Tests" in job["name"] else "integration"
        return bool(parameters) and name.endswith(
            f"-junit-{family}-{'-'.join(parameters)}"
        )
    if name in {
        "openmetadata-service-surefire-reports",
        "k8s-operator-surefire-reports",
    }:
        expected = (
            "openmetadata-service-unit-tests"
            if name.startswith("openmetadata-service-")
            else "k8s_operator-unit-tests"
        )
        return job["name"].rsplit(" / ", 1)[-1] == expected
    if "-test-results-" in name:
        family = "unit" if "Unit Tests" in job["name"] else "integration"
        if not parameters and family == "unit" and job.get("python_version"):
            parameters = [job["python_version"]]
        return bool(parameters) and name.endswith(
            f"-{family}-test-results-{'-'.join(parameters)}"
        )
    return False


class Evidence:
    def __init__(self, repo: str, branch: str, created: str, token: str):
        self.repo, self.branch, self.created, self.token = repo, branch, created, token
        self.deadline = time.monotonic() + MAX_ENRICHMENT_SECONDS
        self.snapshots = 0

    def remaining(self) -> float:
        seconds = self.deadline - time.monotonic()
        if seconds <= 0:
            raise BudgetExceeded("Diagnosis time budget exhausted")
        return seconds

    def read(self, path: str, limit: int) -> bytes:
        try:
            data = download(
                path, limit, self.token, min(MAX_REQUEST_SECONDS, self.remaining())
            )
        except Exception:
            self.remaining()
            raise
        self.remaining()
        return data

    @lru_cache(maxsize=MAX_CACHED_READS)
    def api(self, path: str):
        return json.loads(self.read(f"repos/{self.repo}/{path}", MAX_REPORT_BYTES))

    def items(self, path: str, key: str) -> list[dict]:
        items = []
        separator = "&" if "?" in path else "?"
        for page in range(1, 11):
            self.remaining()
            payload = self.api(f"{path}{separator}per_page=100&page={page}")
            batch = payload[key]
            items.extend(batch)
            if len(batch) < 100 or len(items) >= payload.get(
                "total_count", float("inf")
            ):
                return items
        raise ValueError("CI evidence pagination exceeded its limit")

    def workflow_environment(self, run: dict) -> tuple:
        revisions = {run["head_sha"]}
        for reference in run.get("referenced_workflows", []):
            if not reference["path"].startswith(f"{self.repo}/.github/workflows/"):
                return ()
            if not re.fullmatch(r"[0-9a-f]{40}", reference["sha"]):
                return ()
            revisions.add(reference["sha"])
        definitions = set()
        for revision in sorted(revisions):
            entries = self.api(f"contents/.github?ref={revision}")
            trees = tuple(
                sorted(
                    (entry["name"], entry["sha"])
                    for entry in entries
                    if entry["name"] in {"workflows", "actions", "scripts"}
                )
            )
            if not any(name == "workflows" for name, _ in trees):
                return ()
            definitions.add(trees)
        return tuple(sorted(definitions))

    @lru_cache(maxsize=MAX_CACHED_SNAPSHOTS)
    def snapshot(self, run_id: int, job_id: int) -> Snapshot | None:
        self.remaining()
        if self.snapshots >= MAX_SNAPSHOTS:
            raise BudgetExceeded("Diagnosis snapshot budget exhausted")
        self.snapshots += 1
        run = self.api(f"actions/runs/{run_id}")
        job = self.api(f"actions/jobs/{job_id}")
        if run["run_attempt"] != 1 or job["run_id"] != run_id:
            return None
        logs = self.read(
            f"repos/{self.repo}/actions/jobs/{job_id}/logs",
            MAX_JOB_LOG_BYTES,
        ).decode("utf-8", errors="replace")
        revisions = dict(checkout_revisions(logs))
        if revisions.get("OpenMetadata") != run["head_sha"]:
            raise ValueError("The job checked out a different commit")
        versions = set(re.findall(r"\bpython-version:\s*['\"]?(\d+\.\d+)\b", logs))
        if len(versions) == 1:
            job = {**job, "python_version": next(iter(versions))}
        artifacts = self.items(
            f"actions/runs/{run_id}/artifacts",
            "artifacts",
        )
        matching = [
            artifact
            for artifact in artifacts
            if artifact_matches(artifact["name"], job)
        ]
        artifacts = pick_results(
            [
                artifact
                for artifact in matching
                if artifact["name"].startswith("playwright-results-json-")
            ],
            run["run_attempt"],
        ) + [
            artifact
            for artifact in matching
            if not artifact["name"].startswith("playwright-results-json-")
        ]
        tests, configurations = {}, []
        for artifact in artifacts:
            if not artifact_matches(artifact["name"], job) or artifact["expired"]:
                continue
            if (
                not job["started_at"]
                <= artifact["created_at"]
                <= (job["completed_at"] or self.created)
            ):
                continue
            if artifact["size_in_bytes"] > MAX_REPORT_BYTES:
                raise ValueError("CI report archive is too large")
            archive = self.read(
                f"repos/{self.repo}/actions/artifacts/{artifact['id']}/zip",
                MAX_REPORT_BYTES,
            )
            with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
                reports = [
                    item
                    for item in bundle.infolist()
                    if item.filename == "results.json" or item.filename.endswith(".xml")
                ]
                if sum(item.file_size for item in reports) > MAX_REPORT_BYTES:
                    raise ValueError("Uncompressed CI reports are too large")
                for item in reports:
                    data = bundle.read(item)
                    if item.filename == "results.json":
                        report = json.loads(data)
                        config = report["config"]
                        metadata = config.get("metadata") or {}
                        recorded_sha = (metadata.get("ci") or {}).get("commitHash") or (
                            metadata.get("gitCommit") or {}
                        ).get("hash")
                        if recorded_sha != run["head_sha"]:
                            raise ValueError(
                                "Playwright report belongs to another commit"
                            )
                        configuration = {
                            key: config.get(key)
                            for key in (
                                "version",
                                "workers",
                                "fullyParallel",
                                "globalTimeout",
                                "maxFailures",
                                "updateSnapshots",
                            )
                        }
                        configuration["projects"] = [
                            {
                                key: project.get(key)
                                for key in (
                                    "name",
                                    "retries",
                                    "timeout",
                                    "repeatEach",
                                    "testMatch",
                                    "testIgnore",
                                )
                            }
                            for project in config["projects"]
                        ]
                        configurations.append(json.dumps(configuration, sort_keys=True))
                        results = playwright_tests(report)
                    else:
                        results = junit_tests(data)
                    for name, result in results.items():
                        tests[name] = (
                            result
                            if name not in tests or tests[name] == result
                            else Test(name, "unstable")
                        )
        if not tests:
            return None
        if (
            "playwright-ci (" in job["name"]
            or "Integration Tests (" in job["name"]
            or any(
                step.get("conclusion") == "success"
                and re.search(
                    r"(?:Download|Restore).*(?:build bundle|distribution|generated .*models|server image)",
                    step["name"],
                    re.IGNORECASE,
                )
                for step in job.get("steps", [])
            )
        ):
            return Snapshot(
                run,
                job,
                tests,
                (),
                "the source revisions of the downloaded build were not verified.",
            )
        workflow = run["path"].split("@", 1)[0]
        if not re.fullmatch(r"\.github/workflows/[\w.-]+\.ya?ml", workflow):
            raise ValueError("Invalid workflow path")
        try:
            definitions = self.workflow_environment(run)
        except BudgetExceeded:
            raise
        except Exception as exc:
            print(
                f"::warning::Could not verify workflow definitions: {type(exc).__name__}",
                file=sys.stderr,
            )
            definitions = ()
        if not definitions:
            return Snapshot(run, job, tests, ())
        environment = (
            definitions,
            tuple(sorted(job["labels"])),
            (),
            tuple(sorted(configurations)),
        )
        return Snapshot(run, job, tests, environment)

    @lru_cache(maxsize=MAX_CACHED_READS)
    def baselines(self, workflow_id: int, sha: str, name: str) -> tuple[Snapshot, ...]:
        self.remaining()
        payload = self.api(
            f"actions/workflows/{workflow_id}/runs?head_sha={sha}&status=completed&per_page={MAX_BASELINE_RUNS}"
        )
        if payload["total_count"] > MAX_BASELINE_RUNS:
            raise ValueError("Too many baseline runs to compare completely")
        snapshots = []
        for run in payload["workflow_runs"]:
            branch_matches = run["head_branch"] == self.branch or (
                run["event"] == "merge_group"
                and run["head_branch"].startswith(f"gh-readonly-queue/{self.branch}/")
            )
            if (
                not branch_matches
                or run["head_sha"] != sha
                or run["event"] not in {"push", "workflow_dispatch", "merge_group"}
                or run["created_at"] > self.created
            ):
                continue
            try:
                jobs = self.items(f"actions/runs/{run['id']}/jobs?filter=all", "jobs")
            except BudgetExceeded:
                raise
            except Exception as exc:
                print(
                    f"::warning::Could not read baseline run {run['id']}: {type(exc).__name__}",
                    file=sys.stderr,
                )
                continue
            for job in jobs:
                if (
                    job["name"] == name
                    and job["conclusion"] in {"success", "failure"}
                    and job["completed_at"] <= self.created
                ):
                    try:
                        snapshot = self.snapshot(run["id"], job["id"])
                    except BudgetExceeded:
                        raise
                    except Exception as exc:
                        print(
                            f"::warning::Could not read baseline job {job['id']}: {type(exc).__name__}",
                            file=sys.stderr,
                        )
                        continue
                    if snapshot:
                        snapshots.append(snapshot)
        self.remaining()
        return tuple(snapshots)

    def introduction(
        self, candidate: Snapshot, base: str, failure: Test
    ) -> tuple[str, str]:
        current = base
        for _ in range(MAX_HISTORY_COMMITS):
            self.remaining()
            commit = self.api(f"git/commits/{current}")
            if not commit["parents"]:
                break
            parent = commit["parents"][0]["sha"]
            baselines = self.baselines(
                candidate.run["workflow_id"], parent, candidate.job["name"]
            )
            observations = [
                baseline.tests.get(failure.name)
                for baseline in baselines
                if baseline.environment == candidate.environment
            ]
            if observations and all(
                test and test.status == "passed" for test in observations
            ):
                return current, "first matching failure after a passing parent"
            if not observations or not all(
                test and test.status == "failed" and test.errors == failure.errors
                for test in observations
            ):
                return (
                    "",
                    f"not established — no consistent pass-to-fail boundary at {parent[:7]}",
                )
            current = parent
        return "", f"not established within {MAX_HISTORY_COMMITS} main commits"

    def diagnose(self, run_id: int, job_id: int, sha: str) -> Diagnosis:
        candidate = self.snapshot(run_id, job_id)
        if candidate is None:
            return Diagnosis(
                "Unknown — executed test reports are unavailable or the run was retried."
            )
        failures = tuple(
            test
            for test in candidate.tests.values()
            if test.status in {"failed", "unstable"}
        )
        if candidate.run["head_sha"] != sha or candidate.run["event"] != "merge_group":
            return Diagnosis("Unknown — this is not the failed queue run.", failures)
        prefix = f"gh-readonly-queue/{self.branch}/pr-"
        head_branch = candidate.run["head_branch"]
        base = head_branch.rsplit("-", 1)[-1]
        if not head_branch.startswith(prefix) or not re.fullmatch(
            r"[0-9a-f]{40}", base
        ):
            return Diagnosis(
                "Unknown — the queue's main base could not be resolved.", failures
            )
        # The queue branch suffix is GitHub's base SHA, not the PR head or today's main.
        if not failures:
            return Diagnosis("Unknown — the failing job recorded no failed tests.")
        if not candidate.environment:
            return Diagnosis(
                f"Unknown — {candidate.unverified_reason}",
                failures,
            )
        try:
            baselines = self.baselines(
                candidate.run["workflow_id"], base, candidate.job["name"]
            )
        except BudgetExceeded:
            return Diagnosis("Unknown — diagnosis search budget exhausted.", failures)
        except Exception as exc:
            print(
                f"::warning::Could not read main comparison evidence: {type(exc).__name__}",
                file=sys.stderr,
            )
            return Diagnosis(
                "Unknown — main comparison evidence could not be read.", failures
            )
        comparable = [
            baseline
            for baseline in baselines
            if baseline.environment == candidate.environment
        ]
        if not comparable:
            return Diagnosis(
                f"Unknown — no executed baseline with matching dependencies, runner and workflow at main {base[:7]}.",
                failures,
            )
        main, pr = [], []
        for failure in failures:
            observations = [baseline.tests.get(failure.name) for baseline in comparable]
            if failure.status != "failed":
                continue
            if all(
                test and test.status == "failed" and test.errors == failure.errors
                for test in observations
            ):
                main.append(failure)
            elif all(test and test.status == "passed" for test in observations):
                pr.append(failure)
        unknown = len(failures) - len(main) - len(pr)
        if len(pr) == len(failures):
            comparison = "Likely PR/merge-group error — the failed tests passed on the exact main base."
        elif len(main) == len(failures):
            comparison = "Main — the same tests fail with the same errors on the exact main base."
        else:
            comparison = f"Mixed/unknown — {len(pr)} PR/merge-group, {len(main)} main, {unknown} unconfirmed test failures."
        introductions = []
        for failure in main:
            try:
                introductions.append(self.introduction(candidate, base, failure))
            except BudgetExceeded:
                introductions.append(
                    ("", "not established — diagnosis search budget exhausted")
                )
            except Exception as exc:
                print(
                    f"::warning::Could not locate the introducing commit: {type(exc).__name__}",
                    file=sys.stderr,
                )
                introductions.append(
                    ("", "not established — commit history evidence is unavailable")
                )
        return Diagnosis(
            comparison,
            failures,
            tuple(main),
            tuple(pr),
            comparable[0].run["html_url"],
            tuple(introductions),
        )
