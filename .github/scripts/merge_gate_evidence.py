#!/usr/bin/env python3
"""Read a CI run's evidence for the merge gate: failed jobs, failing tests, verify results.

Job conclusions, failed steps and failure annotations come from the API and are
authoritative. Test names come from artifacts the run uploaded; in a merge group
those are produced by the code under test, so every archive is size-capped, every
member is parsed only as data, and nothing read here can turn a failed job green —
it can only explain why it failed.

The same readers serve the live gate and the replay over harvested history, so a
replay result means what the live gate would have seen.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

import merge_gate_policy as policy_mod
import merge_queue_metrics as mq
import playwright_flaky_report as pfr

MAX_ARTIFACT_BYTES = 25 * 1024 * 1024
MAX_MEMBER_BYTES = 8 * 1024 * 1024
MAX_FAILSAFE_BYTES = 256 * 1024
MAX_FAILSAFE_REPORTS = 10
MAX_ERROR_CHARS = 2000
MAX_STACK_LINES = 40
EVIDENCE_PREFIX = "evidence-"
VERIFY_PREFIX = "verify-"
ATTEMPT_SUFFIX = re.compile(r"-a(?P<attempt>\d+)$")
SLUG = re.compile(r"[^a-z0-9]+")


def job_slug(name: str) -> str:
    """Artifact-safe form of a job name: `it / pg-os / parallel` → `it-pg-os-parallel`."""
    return SLUG.sub("-", name.lower()).strip("-")


def fingerprint(test_id: str, message: str) -> str:
    """A failure's identity across runs: the test plus its first error line with ids,
    UUIDs and secrets normalised away by the dequeue report's own signature."""
    signature = mq.failure_signature(message or "")
    signature = re.sub(r"\b\d{3,}\b", "<n>", signature)
    return hashlib.sha1(f"{test_id}|{signature}".encode()).hexdigest()[:12]


def read_zip(data: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(data))


def member_bytes(archive: zipfile.ZipFile, member: zipfile.ZipInfo, cap: int) -> bytes:
    # The declared size bounds what ZipExtFile inflates, so checking it is enough.
    if member.file_size > cap:
        raise ValueError(f"{member.filename} is {member.file_size} bytes, over {cap}")
    return archive.read(member)


def outcomes_from_archive(
    archive: zipfile.ZipFile, run_id: int, attempt: int
) -> tuple[dict | None, dict[str, bytes], list[str]]:
    """The outcome.json of one lane or shard artifact, the failsafe reports of its
    failing classes, and anything that made it unusable."""
    problems: list[str] = []
    members = {Path(m.filename).as_posix(): m for m in archive.infolist()}
    outcome_member = next(
        (m for name, m in members.items() if name.endswith("outcome.json")), None
    )
    if outcome_member is None:
        return None, {}, ["no outcome.json"]
    outcome = json.loads(member_bytes(archive, outcome_member, MAX_MEMBER_BYTES))
    context = outcome.get("context") or {}
    if str(context.get("runId", run_id)) != str(run_id) or str(
        context.get("runAttempt", attempt)
    ) != str(attempt):
        problems.append(
            f"outcome belongs to run {context.get('runId')} attempt {context.get('runAttempt')}"
        )
    reports: dict[str, bytes] = {}
    classes = list(
        dict.fromkeys(
            t.get("className") for t in outcome.get("failedTests") or [] if t.get("className")
        )
    )
    for class_name in classes[:MAX_FAILSAFE_REPORTS]:
        member = next(
            (
                m
                for name, m in members.items()
                if name.endswith(f"failsafe-reports/{class_name}.txt")
            ),
            None,
        )
        if member is None:
            continue
        try:
            reports[f"{class_name}.txt"] = member_bytes(archive, member, MAX_FAILSAFE_BYTES)
        except ValueError as exc:
            problems.append(str(exc))
    return outcome, reports, problems


def failing_tests(outcome: dict) -> list[tuple[str, str]]:
    """(test id, first error) from either outcome schema: classify_test_outcome's
    `failedTests` (JUnit) or classify_playwright_outcome's `failures`."""
    if "failures" in outcome:
        return [
            (str(f.get("stableId") or ""), str(f.get("firstError") or ""))
            for f in outcome.get("failures") or []
            if f.get("stableId")
        ]
    return [
        (str(t.get("id") or ""), str(t.get("message") or ""))
        for t in outcome.get("failedTests") or []
        if t.get("id")
    ]


def playwright_tests(results: dict) -> tuple[list[dict], list[dict]]:
    """Failed and flaky tests of one Playwright results.json, with the failed test's
    error and stack. Titles carry their describe path joined by ` › `, as
    classify_playwright_outcome.py builds them, so ids match across the two."""
    failed: list[dict] = []
    flaky: list[dict] = []

    def normalize(path: object) -> str:
        # Same normalisation as classify_playwright_outcome._normalize_file.
        value = str(path or "").replace("\\", "/")
        marker = value.find("playwright/e2e/")
        return value[marker:] if marker >= 0 else value

    def walk(suite: dict, titles: tuple[str, ...] = ()) -> None:
        file = normalize(suite.get("file"))
        title = str(suite.get("title") or "").strip()
        if title and title not in (file, file.rsplit("/", 1)[-1]):
            titles = titles + (title,)
        for spec in suite.get("specs") or []:
            base = {
                "file": normalize(spec.get("file")) or file,
                "line": int(spec.get("line") or 0),
                "title": " › ".join((*titles, str(spec.get("title") or "").strip())),
            }
            for test in spec.get("tests") or []:
                project = str(test.get("projectName") or "")
                if test.get("status") == "flaky":
                    flaky.append({**base, "project": project})
                if test.get("status") != "unexpected":
                    continue
                last = (test.get("results") or [{}])[-1]
                error = last.get("error") or {}
                message = pfr.ANSI.sub("", str(error.get("message") or ""))
                stack = pfr.ANSI.sub("", str(error.get("stack") or ""))
                failed.append(
                    {
                        **base,
                        "project": project,
                        "attempts": len(test.get("results") or []),
                        "error": message[:MAX_ERROR_CHARS],
                        "stack": "\n".join(stack.splitlines()[:MAX_STACK_LINES]),
                    }
                )
        for child in suite.get("suites") or []:
            walk(child, titles)

    for suite in results.get("suites") or []:
        walk(suite)
    return failed, flaky


def playwright_id(test: dict) -> str:
    """The stable id classify_playwright_outcome.py gives a test."""
    return f"{test.get('project') or 'unknown-project'} :: {test['file']} :: {test['title']}"


def first_failed_step(job: dict) -> str | None:
    for step in job.get("steps") or []:
        if step.get("conclusion") in policy_mod.FAILED_CONCLUSIONS:
            return step.get("name")
    return None


def verified_tests(document: dict) -> list[policy_mod.VerifiedTest]:
    """VerifiedTest records from one verify-<suite>.json written by verify_failures.py."""
    tests = []
    for item in document.get("tests") or []:
        entry = item.get("entry") or {}
        parent = item.get("parent")
        tests.append(
            policy_mod.VerifiedTest(
                test_id=str(item["id"]),
                fingerprint=str(item.get("fingerprint") or ""),
                entry_failed=int(entry.get("failed", 0)),
                entry_runs=int(entry.get("runs", 0)),
                parent_failed=None if parent is None else int(parent.get("failed", 0)),
                parent_runs=None if parent is None else int(parent.get("runs", 0)),
            )
        )
    return tests


def _download(owner: str, repo: str, artifact: dict, token: str) -> zipfile.ZipFile | None:
    if artifact.get("expired") or int(artifact.get("size_in_bytes") or 0) > MAX_ARTIFACT_BYTES:
        return None
    return read_zip(pfr.download_zip(owner, repo, artifact, token))


def _playwright_shard_failures(
    owner: str, repo: str, artifacts: list[dict], attempt: int, shard: str, token: str
) -> tuple[list[tuple[str, str]], str | None]:
    """Failing tests of one shard of the Playwright reusable, from its results JSON."""
    try:
        picked = [a for a in pfr.pick_results(artifacts, attempt) if pfr.RESULTS_RE.match(a["name"])["shard"] == shard]
    except mq.ApiError as exc:
        return [], str(exc)
    tests: list[tuple[str, str]] = []
    for artifact in picked:
        archive = _download(owner, repo, artifact, token)
        if archive is None:
            return [], f"{artifact['name']} unavailable"
        with archive:
            for member in archive.infolist():
                if member.filename.endswith("results.json"):
                    failed, _ = playwright_tests(json.loads(member_bytes(archive, member, pfr.MAX_RESULTS_BYTES)))
                    tests += [(playwright_id(t), t.get("error") or "") for t in failed]
    return tests, None if picked else "no results JSON for the shard"


def _python_shard_outcome(
    owner: str, repo: str, artifacts: list[dict], run_id: int, attempt: int, lane: str, token: str
) -> dict | None:
    """The py-tests-shared integration shard's outcome.json. Its artifact name has no
    attempt, so the outcome's own context decides whether it is this attempt's."""
    suffix = f"integration-test-results-{lane.replace('-python-', '-')}"
    for artifact in artifacts:
        if not artifact["name"].endswith(suffix):
            continue
        archive = _download(owner, repo, artifact, token)
        if archive is None:
            return None
        with archive:
            outcome, _, problems = outcomes_from_archive(archive, run_id, attempt)
        return None if problems else outcome
    return None


PY_SHARD_JOB = re.compile(r"Integration Tests \((?P<shard>shard-\d+), (?P<python>[\d.]+)\)")
NOT_SAMPLED_STEP = "Not sampled"


def run_jobs(owner: str, repo: str, run: dict, attempt: int, token: str) -> list[dict]:
    return mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/attempts/{attempt}/jobs",
        "jobs",
        token,
    )


def not_sampled(jobs: list[dict]) -> bool:
    """True when ci.yml's plan job left the run outside the shadow sample. Such a run
    skipped every suite, so it proves nothing and must not count as a pass."""
    return any(
        step.get("name") == NOT_SAMPLED_STEP and step.get("conclusion") == "success"
        for job in jobs
        if job.get("name") == "plan"
        for step in job.get("steps") or []
    )


def run_evidence(
    owner: str, repo: str, run: dict, attempt: int, token: str, jobs: list[dict] | None = None
) -> tuple[list[policy_mod.FailedJob], list[policy_mod.VerifiedTest], dict[str, str]]:
    """Failed jobs, verify results and test fingerprints for one attempt of a ci.yml run.

    ci.yml's own test jobs upload `evidence-<job slug>-a<attempt>` (an outcome.json)
    and its verify steps `verify-<name>-a<attempt>` (a verify.json). The Playwright
    and Python suites it calls as reusable workflows keep their own artifacts, which
    are read the way their summary jobs read them.
    """
    if jobs is None:
        jobs = run_jobs(owner, repo, run, attempt, token)
    failed = [j for j in jobs if j.get("conclusion") in policy_mod.FAILED_CONCLUSIONS]
    reasons = {r["url"]: r["reason"] for r in pfr.job_reasons(owner, repo, failed, token)}

    artifacts = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/artifacts", "artifacts", token
    )
    outcomes: dict[str, dict] = {}
    verified: list[policy_mod.VerifiedTest] = []
    fingerprints: dict[str, str] = {}
    for artifact in artifacts:
        name = artifact["name"]
        match = ATTEMPT_SUFFIX.search(name)
        if not match or int(match["attempt"]) != attempt:
            continue
        if not name.startswith((EVIDENCE_PREFIX, VERIFY_PREFIX)):
            continue
        archive = _download(owner, repo, artifact, token)
        if archive is None:
            continue
        with archive:
            for member in archive.infolist():
                if name.startswith(VERIFY_PREFIX) and member.filename.endswith("verify.json"):
                    document = json.loads(member_bytes(archive, member, MAX_MEMBER_BYTES))
                    if str(document.get("runAttempt")) == str(attempt):
                        verified += verified_tests(document)
                if name.startswith(EVIDENCE_PREFIX) and member.filename.endswith("outcome.json"):
                    outcome = json.loads(member_bytes(archive, member, MAX_MEMBER_BYTES))
                    outcomes[ATTEMPT_SUFFIX.sub("", name[len(EVIDENCE_PREFIX) :])] = outcome

    records = []
    for job in failed:
        outcome = outcomes.get(job_slug(job["name"])) or {}
        tests = failing_tests(outcome)
        if not outcome and (shard := pfr.SHARD_JOB_RE.search(job["name"])):
            tests, _ = _playwright_shard_failures(owner, repo, artifacts, attempt, shard[1], token)
        elif not outcome and (py := PY_SHARD_JOB.search(job["name"])):
            lane = f"{py['shard']}-python-{py['python']}"
            outcome = _python_shard_outcome(owner, repo, artifacts, run["id"], attempt, lane, token) or {}
            tests = failing_tests(outcome)
        for test_id, message in tests:
            fingerprints.setdefault(test_id, fingerprint(test_id, message))
        records.append(
            policy_mod.FailedJob(
                name=job["name"],
                conclusion=job.get("conclusion") or "failure",
                failed_step=first_failed_step(job),
                reason=reasons.get(job.get("html_url"), ""),
                outcome=outcome.get("classification"),
                failing_tests=tuple(test_id for test_id, _ in tests),
                job_id=job.get("id"),
            )
        )
    return records, verified, fingerprints
