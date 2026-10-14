#!/usr/bin/env python3
"""The merge gate's decision, as pure functions over evidence the controller gathered.

Nothing here talks to GitHub. Every input is data the controller read with trusted
code from the run under decision; every output is a Decision the controller turns
into a commit status, a job re-run, a PR comment and registry updates. Keeping it
pure is what lets the replay run it over harvested history and lets the tests pin
the verify table exactly.

A failure stops blocking an entry only when the same run proves it is not the
entry's: the failing test did not reproduce on targeted re-runs of the entry, or it
also failed on the entry's parent commit. History never forgives a failure on its
own; it only breaks the tie when a test fails once in three on the entry and never
on the parent.
"""

from __future__ import annotations

import fnmatch
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

PASS = "pass"
FAIL = "fail"
RERUN = "rerun"
PENDING = "pending"

FLAKY = "flaky"
PRE_EXISTING = "pre-existing"
INTRODUCED = "introduced"
AMBIGUOUS = "ambiguous"
NOT_VERIFIED = "not-verified"

FAILED_CONCLUSIONS = frozenset({"failure", "timed_out", "cancelled"})
STATUS_DESCRIPTION_LIMIT = 140


@dataclass(frozen=True)
class Signature:
    id: str
    pattern: re.Pattern

    def search(self, text: str) -> bool:
        return bool(text and self.pattern.search(text))


@dataclass(frozen=True)
class Policy:
    entry_runs: int
    parent_runs: int
    max_failing_tests: int
    max_attempts: int
    max_entry_age_minutes: int
    strict_paths: tuple[str, ...]
    deterministic_jobs: tuple[str, ...]
    verify_jobs: tuple[str, ...]
    deterministic_signatures: tuple[Signature, ...]
    infra_classifications: frozenset[str]
    infra_steps: re.Pattern
    infra_signatures: tuple[Signature, ...]
    summary_job: str
    # (suite, job globs, cap): a suite whose failing tests exceed its cap is not
    # verified. One JVM re-runs a cluster of IT failures cheaply; browser re-runs are not.
    suite_caps: tuple[tuple[str, tuple[str, ...], int], ...] = ()
    # A job read as a transient blip (a known signature in its log, or the triage call)
    # may be re-run up to this attempt, one past max_attempts.
    transient_max_attempts: int = 3
    # Markers of failing tests in a job log: a job with no test artifact that shows
    # these failed on its tests, so neither log signatures nor triage apply to it.
    test_failure_markers: re.Pattern | None = None

    def suite_for_job(self, job_name: str) -> tuple[str, int]:
        for suite, globs, cap in self.suite_caps:
            if any(fnmatch.fnmatchcase(job_name, glob) for glob in globs):
                return suite, cap
        return "other", self.max_failing_tests

    @classmethod
    def from_dict(cls, data: dict) -> "Policy":
        def signatures(key: str) -> tuple[Signature, ...]:
            return tuple(
                Signature(item["id"], re.compile(item["pattern"], re.IGNORECASE))
                for item in data[key]
            )

        return cls(
            entry_runs=int(data["verify"]["entryRuns"]),
            parent_runs=int(data["verify"]["parentRuns"]),
            max_failing_tests=int(data["verify"]["maxFailingTests"]),
            max_attempts=int(data["budgets"]["maxAttempts"]),
            max_entry_age_minutes=int(data["budgets"]["maxEntryAgeMinutes"]),
            strict_paths=tuple(data["strictPaths"]),
            deterministic_jobs=tuple(data["deterministicJobs"]),
            verify_jobs=tuple(data["verifyJobs"]),
            deterministic_signatures=signatures("deterministicSignatures"),
            infra_classifications=frozenset(data["infraClassifications"]),
            infra_steps=re.compile(data["infraSteps"]),
            infra_signatures=signatures("infraSignatures"),
            summary_job=data["summaryJob"],
            suite_caps=tuple(
                (name, tuple(spec["jobs"]), int(spec["maxFailingTests"]))
                for name, spec in (data["verify"].get("suites") or {}).items()
            ),
            transient_max_attempts=int((data.get("transient") or {}).get("maxAttempts", 3)),
            test_failure_markers=re.compile(data["testFailureMarkers"]) if data.get("testFailureMarkers") else None,
        )

    @classmethod
    def load(cls, path: Path) -> "Policy":
        return cls.from_dict(json.loads(path.read_text()))


@dataclass(frozen=True)
class FailedJob:
    """One failed, timed-out or cancelled job of the attempt under decision."""

    name: str
    conclusion: str
    failed_step: str | None = None
    reason: str = ""
    outcome: str | None = None
    failing_tests: tuple[str, ...] = ()
    job_id: int | None = None
    # What the failed step's log showed, for a job that left no test evidence:
    # "infra" (a known signature in the log) or "transient" (the triage call read it
    # as a blip, quoting `log_why`). Either can only earn the job a re-run.
    log_signal: str = ""
    log_why: str = ""


@dataclass(frozen=True)
class VerifiedTest:
    """Targeted re-runs of one failing test: on the entry, then on its parent."""

    test_id: str
    fingerprint: str
    entry_failed: int
    entry_runs: int
    parent_failed: int | None = None
    parent_runs: int | None = None


@dataclass(frozen=True)
class Evidence:
    attempt: int
    entry_age_minutes: float
    failed_jobs: tuple[FailedJob, ...]
    verified: tuple[VerifiedTest, ...] = ()
    strict: bool = False
    # Fingerprints that failed on main or in entries sharing no PR with this one.
    independent_history: frozenset[str] = frozenset()
    # Test ids the impact planners link to the entry's diff.
    impact_related: frozenset[str] = frozenset()
    reruns_left: bool = True
    # Jobs that passed on the parent commit's own run. A failure that survives its
    # re-run here and passes there is the entry's, whatever it looks like.
    parent_passed_jobs: frozenset[str] = frozenset()


@dataclass
class Decision:
    verdict: str
    summary: str
    reasons: list[str] = field(default_factory=list)
    forgiven: list[dict] = field(default_factory=list)
    blocking: list[dict] = field(default_factory=list)
    rerun_jobs: list[str] = field(default_factory=list)
    alert: bool = False

    def as_dict(self) -> dict:
        return {
            "verdict": self.verdict,
            "summary": self.summary,
            "reasons": self.reasons,
            "forgiven": self.forgiven,
            "blocking": self.blocking,
            "rerunJobs": self.rerun_jobs,
            "alert": self.alert,
        }


def path_matches(path: str, pattern: str) -> bool:
    if pattern.endswith("/**"):
        return path.startswith(pattern[:-2])
    return fnmatch.fnmatchcase(path, pattern)


def is_strict(changed_files: list[str], truncated: bool, policy: Policy) -> bool:
    """CI-defining files change what the evidence means, so their entries get no
    forgiveness; a diff too large to list is treated the same way."""
    return truncated or any(
        path_matches(path, pattern)
        for path in changed_files
        for pattern in policy.strict_paths
    )


def classify_test(test: VerifiedTest) -> str:
    if test.entry_runs <= 0:
        return NOT_VERIFIED
    if test.entry_failed == 0:
        return FLAKY
    if not test.parent_runs:
        return NOT_VERIFIED
    if test.parent_failed:
        return PRE_EXISTING
    # Fails on the entry, never on the parent: two in three or worse reproduces.
    if test.entry_failed * 3 >= test.entry_runs * 2:
        return INTRODUCED
    return AMBIGUOUS


def forgivable(test_class: str, has_history: bool, related: bool) -> bool:
    if test_class in (FLAKY, PRE_EXISTING):
        return True
    if test_class == AMBIGUOUS:
        return has_history and not related
    return False


def job_kind(job: FailedJob, policy: Policy) -> tuple[str, str]:
    """(kind, why) for one failed job: infra, deterministic, test or unknown.

    Direct infra evidence comes first: a build job that died on a Maven Central 503
    is not a compile error, and a lane wedged until exit 124 is not 388 regressions.
    An outcome that only says the tests produced no result is weaker: a static check
    that stopped the job before its tests is still a deterministic failure.
    """
    text = "\n".join(filter(None, [job.reason, job.failed_step or ""]))
    for signature in policy.infra_signatures:
        if signature.search(text):
            return "infra", signature.id
    if job.failed_step and policy.infra_steps.match(job.failed_step):
        return "infra", f"failed in setup step '{job.failed_step}'"
    for signature in policy.deterministic_signatures:
        if signature.search(text):
            return "deterministic", signature.id
    if any(fnmatch.fnmatchcase(job.name, glob) for glob in policy.deterministic_jobs):
        return "deterministic", f"{job.name} failed"
    if job.conclusion == "cancelled":
        return "infra", "job cancelled (timeout or runner loss)"
    if job.outcome in policy.infra_classifications:
        return "infra", f"outcome {job.outcome}"
    if job.failing_tests:
        return "test", f"{len(job.failing_tests)} failing test(s)"
    if job.log_signal == "infra":
        return "infra", f"log: {job.log_why}"
    if job.log_signal == "transient":
        return "transient", f"read as a blip: {job.log_why}"
    return "unknown", "failed without test evidence or a known signature"


def _clip(text: str) -> str:
    return text if len(text) <= STATUS_DESCRIPTION_LIMIT else text[: STATUS_DESCRIPTION_LIMIT - 1] + "…"


RETRYABLE_KINDS = frozenset({"infra", "unknown", "transient"})


def _can_rerun(evidence: Evidence, policy: Policy, attempts: int) -> bool:
    return (
        evidence.attempt < attempts
        and evidence.reruns_left
        and evidence.entry_age_minutes < policy.max_entry_age_minutes
    )


def _retry(
    evidence: Evidence, policy: Policy, kinds: dict[str, tuple[str, str]], reasons: list[str], forgiven: list[dict]
) -> Decision | None:
    """RERUN for the jobs that failed without a test verdict while attempts last: all of
    them until max_attempts, then one attempt further only when every unexplained job
    was read as a transient blip. None when no re-run is due."""
    retryable = [name for name, (kind, _) in kinds.items() if kind in RETRYABLE_KINDS]
    if not retryable:
        return None
    if _can_rerun(evidence, policy, policy.max_attempts):
        return Decision(
            RERUN,
            _clip(f"Re-running {len(retryable)} job(s) that failed without a test verdict (attempt {evidence.attempt} of {policy.max_attempts})."),
            reasons,
            forgiven,
            rerun_jobs=retryable,
        )
    transient = [name for name in retryable if kinds[name][0] == "transient"]
    unknown = [name for name in retryable if kinds[name][0] == "unknown"]
    if transient and not unknown and _can_rerun(evidence, policy, policy.transient_max_attempts):
        return Decision(
            RERUN,
            _clip(f"Re-running {', '.join(transient)}: its log reads as a transient blip (attempt {evidence.attempt} of {policy.transient_max_attempts})."),
            reasons,
            forgiven,
            rerun_jobs=retryable,
        )
    return None


def decide(evidence: Evidence, policy: Policy) -> Decision:
    jobs = [
        job
        for job in evidence.failed_jobs
        if job.name != policy.summary_job and job.conclusion in FAILED_CONCLUSIONS
    ]
    if not jobs:
        return Decision(PASS, "All jobs passed.")

    kinds = {job.name: job_kind(job, policy) for job in jobs}
    reasons = [f"{name}: {kind} ({why})" for name, (kind, why) in kinds.items()]

    if evidence.strict:
        # No failure is forgiven, but a blip is still re-run: a re-run forgives nothing.
        settled = [name for name, (kind, _) in kinds.items() if kind not in RETRYABLE_KINDS]
        retry = None if settled else _retry(evidence, policy, kinds, reasons, [])
        return retry or Decision(
            FAIL,
            _clip("Entry changes CI configuration, so no failure is forgiven."),
            reasons,
            blocking=[{"job": job.name} for job in jobs],
        )

    deterministic = [name for name, (kind, _) in kinds.items() if kind == "deterministic"]
    if deterministic:
        return Decision(
            FAIL,
            _clip(f"Deterministic failure in {', '.join(deterministic)}."),
            reasons,
            blocking=[{"job": name} for name in deterministic],
        )

    failing_tests = list(
        dict.fromkeys(
            test for job in jobs if kinds[job.name][0] == "test" for test in job.failing_tests
        )
    )
    per_suite: dict[str, set[str]] = {}
    caps: dict[str, int] = {}
    for job in jobs:
        if kinds[job.name][0] == "test":
            suite, caps[suite] = policy.suite_for_job(job.name)
            per_suite.setdefault(suite, set()).update(job.failing_tests)
    for suite, tests in per_suite.items():
        if len(tests) > caps[suite]:
            return Decision(
                FAIL,
                _clip(f"{len(tests)} {suite} tests failed; too many to be flakes, so none was re-run."),
                reasons,
                blocking=[{"test": test} for test in sorted(tests)],
            )

    verified = {test.test_id: test for test in evidence.verified}
    forgiven, blocking = [], []
    for test_id in failing_tests:
        record = verified.get(test_id)
        test_class = classify_test(record) if record else NOT_VERIFIED
        fingerprint = record.fingerprint if record else ""
        entry = {"test": test_id, "class": test_class, "fingerprint": fingerprint}
        if record:
            entry["entry"] = f"{record.entry_failed}/{record.entry_runs} failed"
            if record.parent_runs:
                entry["parent"] = f"{record.parent_failed}/{record.parent_runs} failed"
        has_history = fingerprint in evidence.independent_history
        related = test_id in evidence.impact_related
        if forgivable(test_class, has_history, related):
            forgiven.append(entry)
        else:
            blocking.append(entry)

    infra = [name for name, (kind, _) in kinds.items() if kind == "infra"]
    unknown = [name for name, (kind, _) in kinds.items() if kind == "unknown"]
    transient = [name for name, (kind, _) in kinds.items() if kind == "transient"]
    retryable = infra + unknown + transient
    verify_failed = [
        name
        for name in retryable
        if any(fnmatch.fnmatchcase(name, glob) for glob in policy.verify_jobs)
    ]
    can_rerun = _can_rerun(evidence, policy, policy.max_attempts)

    # A test the verify job never got to is the verify job's failure, not the
    # entry's: give the verify job its re-run before blaming the entry.
    unverified_by_failure = verify_failed and can_rerun
    hard_blocking = [
        entry
        for entry in blocking
        if not (entry["class"] == NOT_VERIFIED and unverified_by_failure)
    ]
    if hard_blocking:
        first = hard_blocking[0]
        detail = {
            INTRODUCED: "reproduces on the entry, never on its parent",
            AMBIGUOUS: "failed on the entry, never on its parent, with no independent history",
            NOT_VERIFIED: "could not be verified",
        }.get(first["class"], first["class"])
        more = f" (+{len(hard_blocking) - 1} more)" if len(hard_blocking) > 1 else ""
        return Decision(
            FAIL, _clip(f"{first['test']} {detail}{more}."), reasons, forgiven, hard_blocking
        )

    if retryable:
        retry = _retry(evidence, policy, kinds, reasons, forgiven)
        if retry:
            return retry
        # A job read as a blip that failed through its extra run is as unexplained as
        # one never read at all.
        stuck = unknown + transient
        if stuck:
            return Decision(
                FAIL,
                _clip(f"{', '.join(stuck)} failed again without a known cause."),
                reasons,
                forgiven,
                blocking=[{"job": name} for name in stuck],
            )
        introduced = [name for name in infra if name in evidence.parent_passed_jobs]
        if introduced:
            return Decision(
                FAIL,
                _clip(f"{', '.join(introduced)} failed again here but passed on the parent commit."),
                reasons,
                forgiven,
                blocking=[{"job": name} for name in introduced],
            )
        return Decision(
            PENDING,
            _clip(f"Holding: infrastructure failure persists in {', '.join(infra)}."),
            reasons,
            forgiven,
            alert=True,
        )

    noun = "test" if len(forgiven) == 1 else "tests"
    return Decision(
        PASS,
        _clip(f"{len(forgiven)} failing {noun} proven not caused by this entry."),
        reasons,
        forgiven,
    )


def decide_pr(evidence: Evidence, policy: Policy) -> Decision:
    """A PR head's run decides itself, except that jobs which failed on infrastructure
    (a known signature, or a log read as a transient blip) are re-run instead of failing
    the PR. Test, static and unexplained failures stay the author's to read; a cancelled
    job was stopped by someone, by fail-fast, or by a newer push."""
    jobs = [
        job
        for job in evidence.failed_jobs
        if job.name != policy.summary_job and job.conclusion in FAILED_CONCLUSIONS
    ]
    if not jobs:
        return Decision(PASS, "PR checks passed.")
    kinds = {job.name: job_kind(job, policy) for job in jobs}
    reasons = [f"{name}: {kind} ({why})" for name, (kind, why) in kinds.items()]
    rerunnable = [
        job.name for job in jobs if job.conclusion != "cancelled" and kinds[job.name][0] in ("infra", "transient")
    ]
    settled = [job.name for job in jobs if job.name not in rerunnable]
    attempts = (
        policy.transient_max_attempts
        if any(kinds[name][0] == "transient" for name in rerunnable)
        else policy.max_attempts
    )
    if rerunnable and not settled and evidence.attempt < attempts and evidence.reruns_left:
        return Decision(
            RERUN,
            _clip(f"Re-running {', '.join(rerunnable)}: infrastructure, not this PR (attempt {evidence.attempt} of {attempts})."),
            reasons,
            rerun_jobs=rerunnable,
        )
    failed = settled or rerunnable
    return Decision(
        FAIL,
        _clip(f"PR checks failed: {', '.join(failed)}."),
        reasons,
        blocking=[{"job": name} for name in failed],
    )
