"""Compare a dequeued merge group's failures with runs that do not contain its PRs.

Controls are earlier main pushes and merge-group runs of the same workflow whose queue chain
shares no PR with the failed run. Tests are matched by name across each run's report
artifacts, and jobs without reports by name and failed step. A run's dependency revisions
are the ones its first submodule checkout resolved, which pin the build it tested.

ADR:2026-11-13-dequeue-alerts-compare-runs-without-the-pr
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime
from functools import cached_property, lru_cache
from pathlib import PurePosixPath

MAX_ARCHIVE_BYTES = 16 * 1024 * 1024
MAX_LOG_BYTES = 2 * 1024 * 1024
MAX_CHAIN = 10
MAX_CONTROLS = 40
MAX_EXECUTED = 12
BUDGET_SECONDS = 150
REQUEST_SECONDS = 30
SERVER = "https://github.com"
EVENTS = ("merge_group", "push", "schedule", "workflow_dispatch")
REPORT = re.compile(r"playwright-results-json|junit|surefire|test-results", re.I)
ATTEMPT = re.compile(r"-a\d+(?:-retry)?$")
QUEUE = re.compile(r"gh-readonly-queue/.+/pr-(\d+)-([0-9a-f]{40})")
SHA = re.compile(r"[0-9a-f]{40}")
ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
LOCATION = re.compile(r"([\w.-]+\.(?:[cm]?[jt]sx?|py|java)):(\d+)")
# Collate builds against these submodules' branch tips; OpenMetadata has no submodule.
DEPENDENCIES = ("OpenMetadata", "ai-platform")
# Steps that run open-metadata/actions/collate-submodules, which logs the revisions.
CHECKOUT = re.compile(
    r"^Checkout (?:submodules|dependencies)$|collate-submodules", re.I
)
PLAYWRIGHT = {"expected": "passed", "unexpected": "failed", "flaky": "flaky"}
VERDICTS = {
    "main": "Main",
    "pr": "Likely PR/merge-group error",
    "infra": "Infrastructure",
    "unknown": "Unknown",
}
# Outcome kinds in display order, with the tag shown when a run's failures disagree.
TAGS = {
    "main": "same failure without this PR",
    "pr": "passed without this PR",
    "absent": "new in this merge group",
    "infra": "infrastructure error",
    "flaky": "flaky without this PR",
    "other": "different failure without this PR",
    "none": "no comparable run without this PR",
}


class BudgetExceeded(TimeoutError):
    """Diagnosis must leave time to publish the alert."""


@dataclass(frozen=True)
class Result:
    status: str  # passed, failed, flaky, skipped or absent
    error: str = ""
    symptom: str = ""
    where: str = ""


@dataclass(frozen=True)
class Verdict:
    kind: str  # main, pr, infra, unknown, or gate when only a summary gate failed
    text: tuple = ()  # parts: str or (label, url)
    failures: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    rca: tuple = ()  # rows of parts


def warn(message: str, exc: Exception) -> None:
    print(f"::warning::{message}: {type(exc).__name__}", file=sys.stderr)


def symptom(message: str) -> str:
    """Use fixed descriptions; never copy error text or URLs into an alert."""
    message = " ".join(ANSI.sub("", message).split())
    if "toHaveScreenshot" in message:
        return "A screenshot differs from its baseline."
    if "toBeGreaterThan" in message and "Timeout" in message:
        return "The expected count did not increase before the timeout."
    if "toBeVisible" in message or "locator.waitFor" in message:
        return "An expected page element did not become visible before the timeout."
    if re.search(r"timeout|timed out", message, re.IGNORECASE):
        return "The test timed out."
    return "Test assertion failed; see the linked test report."


def failure(message: str, location: dict | None = None) -> tuple[str, str]:
    """A comparable failure signature, without the numbers that vary, and its place."""
    text = ANSI.sub("", message)
    first = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if location and location.get("file"):
        where = f"{PurePosixPath(location['file']).name}:{location.get('line')}"
    else:
        match = LOCATION.search(text)
        where = f"{match[1]}:{match[2]}" if match else ""
    return f"{where.split(':')[0]} {re.sub(r'[0-9]+', '#', first)}".strip(), where


def merge(old: Result | None, new: Result) -> Result:
    return new if old is None or old == new else Result("flaky")


def playwright_results(report: dict) -> dict[str, Result]:
    results = {}

    def walk(suites: list, path: tuple[str, ...]) -> None:
        for suite in suites:
            here = (*path, suite.get("title", ""))
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    project = test.get("projectName", "")
                    name = " › ".join((project, *here, spec.get("title", "")))
                    status = PLAYWRIGHT.get(test.get("status"), "skipped")
                    error = ((test.get("results") or [{}])[-1]).get("error") or {}
                    message = (
                        f"{error.get('message') or ''}\n{error.get('stack') or ''}"
                    )
                    result = Result(status)
                    if status == "failed":
                        signature, where = failure(message, error.get("location"))
                        result = Result(status, signature, symptom(message), where)
                    results[name] = merge(results.get(name), result)
            walk(suite.get("suites", []), here)

    walk(report.get("suites", []), ())
    return results


def junit_results(data: bytes) -> dict[str, Result]:
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("JUnit report declares entities")
    results = {}
    for case in ET.fromstring(data).iter("testcase"):
        children = {child.tag: child for child in case}
        failed = next(
            (children[tag] for tag in ("failure", "error") if tag in children), None
        )
        result = Result("passed")
        if failed is not None:
            message = (
                f"{failed.get('type', '')} {failed.get('message') or failed.text or ''}"
            )
            signature, where = failure(message)
            result = Result("failed", signature, symptom(message), where)
        elif "flakyFailure" in children or "flakyError" in children:
            result = Result("flaky")
        elif "skipped" in children:
            result = Result("skipped")
        name = f"{case.get('classname', '')}#{case.get('name', '')}"
        results[name] = merge(results.get(name), result)
    return results


def report_results(archive: bytes) -> dict[str, Result]:
    results = {}
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        members = [
            item
            for item in bundle.infolist()
            if item.filename.endswith(("results.json", ".xml"))
        ]
        if sum(item.file_size for item in members) > MAX_ARCHIVE_BYTES:
            raise ValueError("Uncompressed CI reports are too large")
        for item in members:
            data = bundle.read(item)
            try:
                parsed = (
                    playwright_results(json.loads(data))
                    if item.filename.endswith(".json")
                    else junit_results(data)
                )
            except (ET.ParseError, ValueError, KeyError, TypeError, AttributeError):
                continue  # Not a test report.
            for name, result in parsed.items():
                results[name] = merge(results.get(name), result)
    return results


def job_result(job: dict) -> Result | None:
    if job.get("conclusion") == "success":
        return Result("passed")
    if job.get("conclusion") not in {"failure", "timed_out"}:
        return None  # Skipped, cancelled or unfinished jobs are not executed evidence.
    steps = [
        s["name"] for s in job.get("steps", []) if s.get("conclusion") == "failure"
    ]
    error = ", ".join(steps) or "an unrecorded step"
    return Result("failed", error, f"failed at {error}")


def checkout_revisions(logs: str, repository: str) -> dict[str, str]:
    """Dependency revisions from actions/checkout output, skipping the repository itself."""
    revisions, synced, pending = {}, "", False
    for raw in logs.splitlines():
        line = re.sub(r"^\S+Z\s", "", raw).strip()
        if "Syncing repository: " in line:
            synced, pending = line.rsplit("/", 1)[-1], False
        elif "[command]" in line and "git log -1 --format=%H" in line:
            pending = True
        elif pending and SHA.fullmatch(line):
            if synced in DEPENDENCIES and synced != repository:
                revisions.setdefault(synced, line)
            pending = False
    return revisions


def download(path: str, limit: int, token: str, timeout: float, partial: bool) -> bytes:
    request = urllib.request.Request(f"https://api.github.com/{path}")
    # Artifact and log endpoints redirect to storage; never forward the GitHub token.
    request.add_unredirected_header("Authorization", f"Bearer {token}")
    deadline = time.monotonic() + timeout
    data = bytearray()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        while len(data) <= limit:
            if time.monotonic() >= deadline:
                raise TimeoutError("CI evidence download timed out")
            chunk = response.read1(min(65536, limit + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
    if len(data) > limit and not partial:
        raise ValueError("CI evidence exceeds its size limit")
    return bytes(data[:limit])


def same(result: Result, mine: Result) -> bool:
    return result.status == "failed" and result.error == mine.error


def decided(seen: list, mine: Result) -> bool:
    """The newest observation decides; a shared failure also needs the run before it."""
    return any(not same(result, mine) for _, result in seen)


def summarize(kinds: set[str]) -> str:
    """One shared failure makes the run Main; only passes or new tests make it a PR's."""
    if "main" in kinds:
        return "main"
    if kinds <= {"pr", "absent"}:
        return "pr"
    return "infra" if kinds == {"infra"} else "unknown"


def short(name: str) -> str:
    return re.sub(r" \(([^,)]*)[^)]*\)", r" (\1)", name)


def commits(count: int | None) -> str:
    return "unknown commits" if count is None else f"{count} commit{'s' * (count != 1)}"


def when(run: dict) -> str:
    created = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
    return f"{created:%b %d %H:%M} UTC"


class Evidence:
    def __init__(self, repo: str, branch: str, pr: int, created: str, token: str):
        self.repo, self.branch, self.pr, self.token = repo, branch, pr, token
        self.owner = repo.split("/")[0]
        # History is read as of the dequeue, so a late or repeated report sees the same.
        self.created = urllib.parse.quote(created)
        self.deadline = time.monotonic() + BUDGET_SECONDS

    def read(self, path: str, limit: int, partial: bool = False) -> bytes:
        seconds = self.deadline - time.monotonic()
        if seconds <= 0:
            raise BudgetExceeded("Diagnosis time budget exhausted")
        return download(path, limit, self.token, min(REQUEST_SECONDS, seconds), partial)

    @lru_cache(maxsize=512)
    def api(self, path: str, repo: str = ""):
        data = self.read(f"repos/{repo or self.repo}/{path}", MAX_ARCHIVE_BYTES)
        return json.loads(data)

    def items(self, path: str, key: str) -> list[dict]:
        items = []
        separator = "&" if "?" in path else "?"
        for page in range(1, 11):
            payload = self.api(f"{path}{separator}per_page=100&page={page}")
            items += payload[key]
            if len(payload[key]) < 100 or len(items) >= payload.get("total_count", 1e9):
                return items
        raise ValueError("CI evidence pagination exceeded its limit")

    @cached_property
    def main(self) -> dict[str, int]:
        """Recent main commits, newest first, by position."""
        path = f"commits?sha={self.branch}&until={self.created}&per_page=100"
        return {commit["sha"]: index for index, commit in enumerate(self.api(path))}

    @lru_cache(maxsize=8)
    def runs(self, workflow: int) -> tuple[dict, ...]:
        runs = []
        for event in EVENTS:
            scope = "" if event == "merge_group" else f"&branch={self.branch}"
            path = f"actions/workflows/{workflow}/runs?event={event}{scope}"
            path += f"&created=%3C%3D{self.created}&per_page=100"
            runs += self.api(path)["workflow_runs"]
        return tuple(sorted(runs, key=lambda run: run["created_at"], reverse=True))

    @lru_cache(maxsize=8)
    def heads(self, workflow: int) -> dict[str, str]:
        return {run["head_sha"]: run["head_branch"] for run in self.runs(workflow)}

    def chain(self, run: dict) -> tuple[frozenset[int], str] | None:
        """The queued PRs a run tested on top of main, and the main commit beneath them."""
        if run["event"] != "merge_group":
            on_main = run["head_branch"] == self.branch
            return (frozenset(), run["head_sha"]) if on_main else None
        prs, branch = set(), run["head_branch"]
        for _ in range(MAX_CHAIN):
            match = QUEUE.fullmatch(branch or "")
            if not match:
                return None
            prs.add(int(match[1]))
            if match[2] in self.main:
                return frozenset(prs), match[2]
            branch = self.heads(run["workflow_id"]).get(match[2])
        return None

    def controls(self, failed: dict):
        """Completed earlier runs that share no queued PR with the failed run, newest first."""
        mine = (self.chain(failed) or (frozenset(),))[0] | {self.pr}
        scanned = 0
        for run in self.runs(failed["workflow_id"]):
            if (
                run["created_at"] >= failed["created_at"]
                or run["status"] != "completed"
            ):
                continue
            chain = self.chain(run)
            if chain is None or chain[0] & mine:
                continue
            scanned += 1
            if scanned > MAX_CONTROLS:
                return
            yield run

    @lru_cache(maxsize=64)
    def jobs(self, run_id: int) -> dict[str, dict]:
        jobs = self.items(f"actions/runs/{run_id}/jobs?filter=latest", "jobs")
        return {job["name"]: job for job in jobs}

    @lru_cache(maxsize=64)
    def reports(self, run_id: int) -> tuple[frozenset[str], dict[str, Result]] | None:
        """Every test result in the run's report artifacts, and the artifacts read."""
        latest = {}
        for artifact in self.items(f"actions/runs/{run_id}/artifacts", "artifacts"):
            name = ATTEMPT.sub("", artifact["name"])
            newer = artifact["id"] > latest.get(name, {}).get("id", 0)
            if REPORT.search(name) and not artifact["expired"] and newer:
                latest[name] = artifact
        names, results = set(), {}
        for name, artifact in latest.items():
            if artifact["size_in_bytes"] > MAX_ARCHIVE_BYTES:
                continue
            path = f"repos/{self.repo}/actions/artifacts/{artifact['id']}/zip"
            try:
                parsed = report_results(self.read(path, MAX_ARCHIVE_BYTES))
            except BudgetExceeded:
                raise
            except Exception as exc:
                warn(f"Could not read report artifact {artifact['id']}", exc)
                continue
            names.add(name)
            for test, result in parsed.items():
                results[test] = merge(results.get(test), result)
        return (frozenset(names), results) if names else None

    @lru_cache(maxsize=32)
    def dependencies(self, run_id: int) -> tuple[tuple[str, str], ...] | None:
        """Submodule revisions the run built against; None when they cannot be read."""
        checkouts = [
            job
            for job in self.jobs(run_id).values()
            if job.get("started_at")
            and any(CHECKOUT.search(step["name"]) for step in job.get("steps", []))
        ]
        if not checkouts:
            return ()
        job = min(checkouts, key=lambda job: job["started_at"])
        path = f"repos/{self.repo}/actions/jobs/{job['id']}/logs"
        logs = self.read(path, MAX_LOG_BYTES, partial=True).decode("utf-8", "replace")
        revisions = checkout_revisions(logs, self.repo.split("/")[1])
        return tuple(sorted(revisions.items())) or None

    def drift(self, before: dict, after: dict) -> list[tuple[str, str, str]] | None:
        """Dependency revisions that differ between two runs; None when unreadable."""
        try:
            old, new = self.dependencies(before["id"]), self.dependencies(after["id"])
        except Exception as exc:
            warn("Could not read dependency revisions", exc)
            return None
        if old is None or new is None:
            return None
        old, new = dict(old), dict(new)
        return [
            (repo, old.get(repo, ""), new.get(repo, ""))
            for repo in sorted(old.keys() | new.keys())
            if old.get(repo) != new.get(repo)
        ]

    def ahead(self, repo: str, old: str, new: str) -> tuple[int | None, list]:
        """Commits from old to new, or None when the comparison is not readable."""
        if old == new:
            return 0, []
        if not old or not new:
            return None, []
        try:
            compare = self.api(f"compare/{old}...{new}", repo)
        except Exception as exc:
            warn(f"Could not compare {repo} revisions", exc)
            return None, []
        if compare["status"] not in {"ahead", "identical"}:
            return None, []
        return compare["ahead_by"], compare["commits"]

    def observe(
        self, run: dict, keys: list[str], names: frozenset, tests: bool
    ) -> dict:
        if not tests:
            jobs = self.jobs(run["id"])
            observed = {key: job_result(jobs[key]) for key in keys if key in jobs}
        elif (reports := self.reports(run["id"])) is None:
            return {}
        else:
            # A test missing from a run that has every report the failed run has is new.
            absent = Result("absent") if reports[0] >= names else None
            observed = {key: reports[1].get(key, absent) for key in keys}
        return {
            key: result
            for key, result in observed.items()
            if result is not None and result.status != "skipped"
        }

    def diagnose(
        self, run_id: int, causes: list[dict], infra: dict[str, str]
    ) -> Verdict:
        """Compare a failed run; ``infra`` maps a failed job to an infrastructure symptom."""
        try:
            return self.compare(self.api(f"actions/runs/{run_id}"), causes, infra)
        except Exception as exc:
            warn("Could not compare the failed run", exc)
            reason = (
                "ran out of time" if isinstance(exc, TimeoutError) else "is unreadable"
            )
            return Verdict("unknown", (f"Unknown — the comparison evidence {reason}.",))

    def compare(self, run: dict, causes: list[dict], infra: dict[str, str]) -> Verdict:
        names, results = self.reports(run["id"]) or (frozenset(), {})
        mine = {
            test: result
            for test, result in results.items()
            if result.status == "failed"
        }
        tests = bool(mine)
        if not tests:
            failed = ((job["name"], job_result(job)) for job in causes)
            mine = {name: result for name, result in failed if result and result.error}
        if not mine:
            # Its upstream jobs were cancelled or skipped: nothing to attribute.
            reason = "no test or job failed besides the summary gate"
            return Verdict("gate", (f"Unknown — {reason}.",))
        # A download or network error is not a code change, so history cannot explain it.
        outcomes = {
            key: ("infra", None, infra[key])
            for key in mine
            if not tests and key in infra
        }
        seen = {key: [] for key in mine if key not in outcomes}
        executed, exhausted = 0, False
        try:
            for control in self.controls(run) if seen else ():
                pending = [key for key in seen if not decided(seen[key], mine[key])]
                observed = self.observe(control, pending, names, tests)
                for key, result in observed.items():
                    seen[key].append((control, result))
                executed += bool(observed)
                done = all(decided(seen[key], mine[key]) for key in seen)
                if done or executed >= MAX_EXECUTED:
                    break
        except BudgetExceeded:
            exhausted = True
        outcomes |= {key: self.outcome(run, mine[key], seen[key]) for key in seen}
        return self.verdict(mine, outcomes, tests, exhausted)

    def superseded(self, seen: list) -> list:
        """Drop merge-group results at or before a main commit whose own run passed.

        Main passed there, so a merge group on that base failing is its own PR's doing.
        """
        passes = [
            self.main.get(control["head_sha"], len(self.main))
            for control, result in seen
            if control["event"] != "merge_group" and result.status == "passed"
        ]
        newest = min(passes, default=len(self.main))
        return [
            (control, result)
            for control, result in seen
            if control["event"] != "merge_group"
            or self.main[self.chain(control)[1]] < newest
        ]

    def outcome(self, run: dict, mine: Result, seen: list) -> tuple:
        """(kind, newest evidence run, detail) for one failed test or job."""
        seen = self.superseded(seen)
        if not seen:
            return "none", None, None
        control, result = seen[0]
        if result.status == "absent":
            return "absent", control, None
        if result.status == "passed":
            # Dependency changes since the pass are shown, not weighed: they rarely cause it.
            return "pr", control, self.drift(control, run)
        if not same(result, mine):
            return "flaky" if result.status == "flaky" else "other", control, None
        streak = next(
            (i for i, (_, r) in enumerate(seen) if not same(r, mine)), len(seen)
        )
        before = seen[streak] if streak < len(seen) else None
        return "main", control, (seen[streak - 1][0], before)

    def verdict(
        self, mine: dict, outcomes: dict, tests: bool, exhausted: bool
    ) -> Verdict:
        groups = {}
        for key, (kind, control, detail) in outcomes.items():
            evidence = control["id"] if control else detail if kind == "infra" else None
            groups.setdefault((kind, evidence), []).append(key)
        overall = summarize({kind for kind, _ in groups})
        text = [f"{VERDICTS[overall]} — "]
        order = sorted(groups.items(), key=lambda group: list(TAGS).index(group[0][0]))
        for index, ((kind, _), keys) in enumerate(order):
            _, control, detail = outcomes[keys[0]]
            text += ["; "] if index else []
            text += [self.count(keys, len(mine), tests), ": "]
            text += self.phrase(kind, control, detail, exhausted)
        rca, explained = [], set()
        for key in mine:
            kind, _, detail = outcomes[key]
            if kind != "main":
                continue
            first, before = detail
            boundary = (first["id"], before and before[0]["id"])
            if boundary in explained:
                continue
            explained.add(boundary)
            result = mine[key]
            cause = (
                result.symptom.rstrip(".")
                if tests
                else f"{short(key)} {result.symptom}"
            )
            where = f" ({result.where})" if result.where else ""
            rca += [[f"RCA: {cause}{where}."], self.introduction(first, before)]
        failures = tuple(mine) if tests else ()
        tags = (
            tuple(TAGS[outcomes[key][0]] for key in failures) if len(groups) > 1 else ()
        )
        return Verdict(overall, (*text, "."), failures, tags, tuple(rca))

    @staticmethod
    def count(keys: list[str], total: int, tests: bool) -> str:
        if not tests:
            return ", ".join(short(key) for key in keys)
        if total == 1:
            return "the failed test"
        if len(keys) == total:
            return "both failed tests" if total == 2 else f"all {total} failed tests"
        return f"{len(keys)} of {total} failed tests"

    def link(self, run: dict) -> tuple[str, str]:
        match = QUEUE.fullmatch(run["head_branch"] or "")
        label = (
            f"#{match[1]}'s queue run"
            if match
            else f"{self.branch} {run['head_sha'][:7]}"
        )
        return f"{label} ({when(run)})", run["html_url"]

    def phrase(self, kind: str, control: dict | None, detail, exhausted: bool) -> list:
        if kind == "infra":
            return [detail]
        if kind == "none":
            limit = "before the time limit" if exhausted else "in the recent history"
            return [f"no comparable run without this PR {limit}"]
        evidence = self.link(control)
        if kind == "main":
            return ["same failure without this PR in ", evidence]
        if kind == "absent":
            return ["new in this merge group, absent from ", evidence]
        if kind == "flaky":
            return ["flaky without this PR in ", evidence]
        if kind == "other":
            return ["a different failure without this PR in ", evidence]
        parts = ["passed without this PR in ", evidence]
        if detail is None:
            return [*parts, "; its dependency revisions could not be compared"]
        changes = [self.dependency(repo, old, new) for repo, old, new in detail]
        for index, change in enumerate(changes):
            parts += ["; since then "] if index == 0 else [" and "]
            parts.append(change)
        return [*parts, " changed"] if changes else parts

    def dependency(self, repo: str, old: str, new: str) -> tuple[str, str]:
        count = self.ahead(f"{self.owner}/{repo}", old, new)[0]
        label = f"{repo} ({commits(count)})" if count is not None else repo
        return label, f"{SERVER}/{self.owner}/{repo}/compare/{old}...{new}"

    def introduction(self, failed: dict, before: tuple | None) -> list:
        """The changes between the last run that passed and the first that failed."""
        if before is None:
            return [
                "Introducing change: not found — every compared run without this PR fails the same way."
            ]
        passed, result = before
        if result.status not in {"passed", "absent"}:
            return [
                "Introducing change: not established — the run before ",
                self.link(failed),
                " did not pass cleanly.",
            ]
        start = (
            passed["head_sha"]
            if passed["head_sha"] in self.main
            else self.chain(passed)[1]
        )
        changes = [(self.repo, start, self.chain(failed)[1])]
        drift = self.drift(passed, failed)
        changes += [
            (f"{self.owner}/{repo}", old, new) for repo, old, new in drift or []
        ]
        found = [
            (repo, *self.ahead(repo, old, new), old, new) for repo, old, new in changes
        ]
        between = [
            " between ",
            self.link(passed),
            " (passed) and ",
            self.link(failed),
            " (first failure)",
        ]
        known = drift is not None and all(count is not None for _, count, *_ in found)
        changed = [commit for _, _, listed, *_ in found for commit in listed]
        if known and sum(count for _, count, *_ in found) == 1 and len(changed) == 1:
            title = changed[0]["commit"]["message"].splitlines()[0][:100]
            commit = (changed[0]["sha"][:7], changed[0]["html_url"])
            return [
                "Introduced by: ",
                commit,
                f" {title} — the only change",
                *between,
                ".",
            ]
        if known and not changed:
            return [
                "No repository changed",
                *between,
                "; check the CI environment and external services.",
            ]
        ranges = [
            (
                f"{repo.split('/')[1]} ({commits(count)})",
                f"{SERVER}/{repo}/compare/{old}...{new}",
            )
            for repo, count, _, old, new in found
            if count != 0
        ]
        if drift is None:
            ranges.append("dependency revisions could not be compared")
        parts = ["Introduced", *between, ": "]
        for index, change in enumerate(ranges):
            parts += [", "] if index else []
            parts.append(change)
        return [*parts, "."]
