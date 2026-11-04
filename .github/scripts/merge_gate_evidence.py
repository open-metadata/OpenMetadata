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

import dataclasses
import hashlib
import io
import json
import re
import zipfile
from datetime import timedelta
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
VERIFY_LOGS_PREFIX = "verify-logs-"
ATTEMPT_SUFFIX = re.compile(r"-a(?P<attempt>\d+)$")
# An artifact and a job's start time come from different services.
CLOCK_SKEW = timedelta(minutes=1)
job_slug = policy_mod.job_slug


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
                job=str(item.get("job") or ""),
            )
        )
    return tests


def _download(owner: str, repo: str, artifact: dict, token: str) -> zipfile.ZipFile | None:
    if artifact.get("expired") or int(artifact.get("size_in_bytes") or 0) > MAX_ARTIFACT_BYTES:
        return None
    return read_zip(pfr.download_zip(owner, repo, artifact, token))


def uploaded_by(artifact: dict, job: dict) -> bool:
    """Whether `artifact` can come from the job's latest execution. A re-run copies
    every job it leaves alone into the new attempt with its original start time, so
    such a job's evidence is the artifact it uploaded in an earlier attempt; a job that
    was re-run starts later, and the earlier attempt's artifact is not its own."""
    created, started = artifact.get("created_at"), job.get("started_at")
    if not created or not started:
        return True
    return mq.parse_ts(created) >= mq.parse_ts(started) - CLOCK_SKEW


def _attempt(name: str) -> int | None:
    match = ATTEMPT_SUFFIX.search(name)
    return int(match["attempt"]) if match else None


def _newest(candidates: list[tuple[int, dict]], job: dict) -> tuple[int, dict] | None:
    """The newest of a job's artifacts that its latest execution uploaded."""
    own = [(attempt, artifact) for attempt, artifact in candidates if uploaded_by(artifact, job)]
    return max(own, key=lambda item: item[0]) if own else None


def _outcome(owner: str, repo: str, artifact: dict, token: str) -> dict:
    archive = _download(owner, repo, artifact, token)
    if archive is None:
        return {}
    with archive:
        member = next((m for m in archive.infolist() if m.filename.endswith("outcome.json")), None)
        outcome = json.loads(member_bytes(archive, member, MAX_MEMBER_BYTES)) if member else {}
    return outcome if isinstance(outcome, dict) else {}


def _playwright_shard_failures(
    owner: str, repo: str, artifacts: list[dict], attempt: int, shard: str, job: dict, token: str
) -> tuple[list[tuple[str, str]], int | None]:
    """Failing tests of one shard of the Playwright reusable, from the results JSON its
    latest execution uploaded (a retry upload of the same attempt wins, as in
    render_playwright_summary.cjs), and the attempt that wrote it."""
    picked: dict[int, dict] = {}
    for artifact in artifacts:
        match = pfr.RESULTS_RE.match(artifact["name"])
        if not match or match["shard"] != shard or int(match["attempt"]) > attempt or not uploaded_by(artifact, job):
            continue
        if match["retry"] or int(match["attempt"]) not in picked:
            picked[int(match["attempt"])] = artifact
    if not picked:
        return [], None
    ran_in = max(picked)
    archive = _download(owner, repo, picked[ran_in], token)
    if archive is None:
        return [], None
    tests: list[tuple[str, str]] = []
    with archive:
        for member in archive.infolist():
            if member.filename.endswith("results.json"):
                failed, _ = playwright_tests(json.loads(member_bytes(archive, member, pfr.MAX_RESULTS_BYTES)))
                tests += [(playwright_id(t), t.get("error") or "") for t in failed]
    return tests, ran_in


def _outcome_attempt(outcome: dict, run_id: int, default: int) -> int | None:
    """The attempt an outcome.json was written in, or None when it is another run's."""
    context = outcome.get("context") if isinstance(outcome.get("context"), dict) else {}
    if str(context.get("runId", run_id)) != str(run_id):
        return None
    try:
        return int(context.get("runAttempt", default))
    except (TypeError, ValueError):
        return None


def _python_shard_outcome(
    owner: str, repo: str, artifacts: list[dict], run_id: int, attempt: int, lane: str, job: dict, token: str
) -> tuple[dict, int | None]:
    """The py-tests-shared integration shard's outcome.json and the attempt that wrote
    it. Its artifact name has no attempt, so the outcome's own context says which
    attempt it is, and the job's start time whether it is this execution's."""
    suffix = f"integration-test-results-{lane.replace('-python-', '-')}"
    for artifact in artifacts:
        if not artifact["name"].endswith(suffix):
            continue
        if not uploaded_by(artifact, job):
            return {}, None
        outcome = _outcome(owner, repo, artifact, token)
        ran_in = _outcome_attempt(outcome, run_id, attempt) if outcome else None
        if ran_in is None or ran_in > attempt:
            return {}, None
        return outcome, ran_in
    return {}, None


def _verify_records(
    owner: str, repo: str, artifacts: list[dict], attempt: int, token: str
) -> list[tuple[int, policy_mod.VerifiedTest]]:
    """Every verify record of this attempt and the earlier ones, with the attempt that
    wrote it. A job a re-run left alone keeps the evidence of the attempt it ran in, and
    that attempt's verification is the one that read it."""
    records: list[tuple[int, policy_mod.VerifiedTest]] = []
    for artifact in artifacts:
        name, written = artifact["name"], _attempt(artifact["name"])
        if not name.startswith(VERIFY_PREFIX) or name.startswith(VERIFY_LOGS_PREFIX):
            continue
        if written is None or written > attempt:
            continue
        archive = _download(owner, repo, artifact, token)
        if archive is None:
            continue
        with archive:
            for member in archive.infolist():
                if member.filename.endswith("verify.json"):
                    document = json.loads(member_bytes(archive, member, MAX_MEMBER_BYTES))
                    if str(document.get("runAttempt")) == str(written):
                        records += [(written, test) for test in verified_tests(document)]
    return records


def answering(
    records: list[tuple[int, policy_mod.VerifiedTest]], job: str, test_id: str, fingerprint_: str, seen_in: int | None
) -> policy_mod.VerifiedTest | None:
    """The verification that answers one failure: of this test, in this job (or tied to
    no job), of this failure, run no earlier than the attempt the failure was seen in.
    The newest wins; it is returned tied to the job."""
    best: tuple[int, policy_mod.VerifiedTest] | None = None
    for written, record in records:
        if record.test_id != test_id or record.job not in ("", job):
            continue
        if seen_in is not None and written < seen_in:
            continue
        if record.fingerprint and fingerprint_ and record.fingerprint != fingerprint_:
            continue
        if best is None or written >= best[0]:
            best = (written, record)
    return dataclasses.replace(best[1], job=job) if best else None


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

    An attempt lists every job, including the ones its re-run left alone, so a job's
    evidence is what its latest execution uploaded, whichever attempt that was, and a
    failure is answered only by a verification that ran after it was seen.
    """
    if jobs is None:
        jobs = run_jobs(owner, repo, run, attempt, token)
    failed = [j for j in jobs if j.get("conclusion") in policy_mod.FAILED_CONCLUSIONS]
    reasons = {r["url"]: r["reason"] for r in pfr.job_reasons(owner, repo, failed, token)}

    artifacts = mq.paginated_items(
        f"/repos/{owner}/{repo}/actions/runs/{run['id']}/artifacts", "artifacts", token
    )
    evidence: dict[str, list[tuple[int, dict]]] = {}
    for artifact in artifacts:
        name, written = artifact["name"], _attempt(artifact["name"])
        if name.startswith(EVIDENCE_PREFIX) and written is not None and written <= attempt:
            evidence.setdefault(ATTEMPT_SUFFIX.sub("", name[len(EVIDENCE_PREFIX) :]), []).append((written, artifact))
    verify_records = _verify_records(owner, repo, artifacts, attempt, token)

    records = []
    verified: list[policy_mod.VerifiedTest] = []
    fingerprints: dict[str, str] = {}
    for job in failed:
        slug = job_slug(job["name"])
        picked = _newest(evidence.get(slug, []), job)
        seen_in, outcome = (picked[0], _outcome(owner, repo, picked[1], token)) if picked else (None, {})
        tests = failing_tests(outcome)
        if not outcome and (shard := pfr.SHARD_JOB_RE.search(job["name"])):
            tests, seen_in = _playwright_shard_failures(owner, repo, artifacts, attempt, shard[1], job, token)
        elif not outcome and (py := PY_SHARD_JOB.search(job["name"])):
            lane = f"{py['shard']}-python-{py['python']}"
            outcome, seen_in = _python_shard_outcome(owner, repo, artifacts, run["id"], attempt, lane, job, token)
            tests = failing_tests(outcome)
        for test_id, message in tests:
            failure = fingerprint(test_id, message)
            fingerprints.setdefault(test_id, failure)
            if record := answering(verify_records, slug, test_id, failure, seen_in):
                verified.append(record)
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
