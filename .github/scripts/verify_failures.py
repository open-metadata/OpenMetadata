#!/usr/bin/env python3
"""Same-run verification of failing tests, for the merge gate.

The merge-queue tier of ci.yml runs this in one `verify / <suite>` job per suite that
failed, after the test jobs, with the run's own builds already downloaded. It answers
one question per failing test: is this failure the entry's?

  select    read this run's evidence; pick the suite's failing tests (at most
            verify.maxFailingTests from .github/merge-gate/policy.json, else none:
            that many failures are not flakes, and the gate ejects without re-runs)
  run       re-run them in the current checkout and environment:
              --side entry   up to verify.entryRuns runs, stopping at the first pass
              --side parent  up to verify.parentRuns runs, stopping at the first
                             failure (checkout and builds of merge_group.base_sha)
  document  merge both sides into verify.json, the file the gate reads

The job exits non-zero only when it could not verify (environment, missing
reports): the gate re-runs a failed verify job instead of blaming the entry. A test
that reproduces is a verdict, not an error.

A run counts only when its report names the test. A Maven lane run without its
engine profile runs nothing and still prints BUILD SUCCESS; that must read as "not
run", never as a pass.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from xml.etree import ElementTree

import merge_gate_evidence as evidence_mod

SCRIPTS = Path(__file__).resolve().parent
REPO = SCRIPTS.parents[1]
POLICY_PATH = REPO / ".github" / "merge-gate" / "policy.json"
IMPACT_MAP_PATH = REPO / ".github" / "java-tests" / "impact-map.json"
SUITES = ("java-it", "playwright", "python")
IT_MODULE = "openmetadata-integration-tests"
IT_REPORTS = REPO / IT_MODULE / "target" / "failsafe-reports"
UI_DIR = REPO / "openmetadata-ui" / "src" / "main" / "resources" / "ui"
INGESTION_DIR = REPO / "ingestion"
PARAMS = re.compile(r"(\(.*\)|\[.*\])$")
IT_ENGINE = re.compile(r"(elasticsearch|opensearch)(-redis)?$")
FAILED_STATUSES = {"failed", "timedOut", "interrupted"}


def use_checkout(root: Path) -> None:
    """Run tests from another checkout: the parent side runs in a worktree of the
    parent commit, while this script and the policy stay the entry's."""
    global REPO, IT_REPORTS, UI_DIR, INGESTION_DIR
    REPO = root.resolve()
    IT_REPORTS = REPO / IT_MODULE / "target" / "failsafe-reports"
    UI_DIR = REPO / "openmetadata-ui" / "src" / "main" / "resources" / "ui"
    INGESTION_DIR = REPO / "ingestion"


@dataclass
class Target:
    suite: str
    test_id: str
    fingerprint: str
    # java-it
    profile: str = ""
    lane: str = ""
    class_name: str = ""
    method: str = ""
    # playwright
    project: str = ""
    file: str = ""
    title: str = ""
    # python
    nodeid: str = ""


@dataclass
class SideResult:
    failed: int = 0
    runs: int = 0
    problems: list[str] = field(default_factory=list)


# ------------------------------------------------------------------- selecting


def suite_of_outcome(outcome: dict) -> str:
    """Only suites with a targeted re-run are verified. Unit suites are not: their
    failures are near-deterministic and rare in the queue, so they eject as before."""
    if "failures" in outcome:
        return "playwright"
    context = outcome.get("context") or {}
    profile = str(context.get("profile") or "")
    if profile.startswith("python-integration"):
        return "python"
    if context.get("lane") and IT_ENGINE.search(profile):
        return "java-it"
    return "other"


def java_target(test_id: str, fingerprint: str, context: dict) -> Target:
    class_name, _, method = test_id.partition("#")
    return Target(
        "java-it",
        test_id,
        fingerprint,
        profile=str(context.get("profile") or ""),
        lane=str(context.get("lane") or ""),
        class_name=class_name,
        method=PARAMS.sub("", method),
    )


def playwright_target(test_id: str, fingerprint: str) -> Target:
    project, file, title = (test_id.split(" :: ", 2) + ["", ""])[:3]
    return Target("playwright", test_id, fingerprint, project=project, file=file, title=title)


def python_nodeid(test_id: str, root: Path) -> str:
    """`tests.integration.x.test_y.TestZ#test_a` → `tests/integration/x/test_y.py::TestZ::test_a`,
    found by walking the dotted path until a module file exists."""
    dotted, _, name = test_id.partition("#")
    parts = dotted.split(".")
    for cut in range(len(parts), 0, -1):
        module = Path(*parts[:cut]).with_suffix(".py")
        if (root / module).is_file():
            return "::".join([module.as_posix(), *parts[cut:], PARAMS.sub("", name)])
    return ""


def select(evidence_dir: Path, suite: str, max_tests: int) -> tuple[list[Target], str]:
    """The suite's failing tests from every outcome.json under evidence_dir, or an empty
    list and why none will be verified."""
    targets: dict[str, Target] = {}
    for path in sorted(evidence_dir.rglob("outcome.json")):
        outcome = json.loads(path.read_text())
        if suite_of_outcome(outcome) != suite:
            continue
        context = outcome.get("context") or {}
        for test_id, message in evidence_mod.failing_tests(outcome):
            fp = evidence_mod.fingerprint(test_id, message)
            if suite == "java-it":
                targets.setdefault(test_id, java_target(test_id, fp, context))
            elif suite == "playwright":
                targets.setdefault(test_id, playwright_target(test_id, fp))
            else:
                target = Target("python", test_id, fp, nodeid=python_nodeid(test_id, INGESTION_DIR))
                targets.setdefault(test_id, target)
    if len(targets) > max_tests:
        return [], f"{len(targets)} failing tests exceed verify.maxFailingTests ({max_tests})"
    if not targets:
        return [], "no failing tests with evidence"
    return list(targets.values()), ""


# ------------------------------------------------------------------- commands


def lane_args(lane: str) -> list[str]:
    """CI lanes map to `-DintegrationTests.lane=<lane>`; the impact map is the one place
    that knows extra arguments, the same table the local planner reads."""
    lanes = json.loads(IMPACT_MAP_PATH.read_text())["maven"]["lanes"] if IMPACT_MAP_PATH.exists() else {}
    if lane in lanes:
        return list(lanes[lane]["args"])
    return [f"-DintegrationTests.lane={lane}"]


def java_command(targets: list[Target]) -> list[str]:
    profile = targets[0].profile
    selection = ",".join(
        f"{t.class_name}#{t.method}" if t.method else t.class_name for t in targets
    )
    return [
        "mvn",
        "-B",
        "-ntp",
        "verify",
        "-pl",
        f":{IT_MODULE}",
        f"-P{profile}",
        *lane_args(targets[0].lane),
        f"-Dit.test={selection}",
        "-Dfailsafe.failIfNoSpecifiedTests=false",
        # No in-JVM re-runs: failsafe re-runs a failing test after the IT harness has shut
        # the server and its pool down, so a re-run there always errors.
        "-Dfailsafe.rerunFailingTestsCount=0",
        "--no-snapshot-updates",
        "-Dtest=NoUnitTestsInThisRun",
        "-Dsurefire.failIfNoSpecifiedTests=false",
    ]


def playwright_command(target: Target, repeats: int, report: Path) -> list[str]:
    return [
        "npx",
        "playwright",
        "test",
        target.file,
        f"--project={target.project}",
        "-g",
        re.escape(target.title.split(" › ")[-1]),
        f"--repeat-each={repeats}",
        "--retries=0",
        "--reporter=json",
        f"--output={report.parent / 'pw-output'}",
    ]


def python_command(target: Target, report: Path) -> list[str]:
    # The shard's pytest flags (nox passes `-c pyproject.toml`); without the same
    # config a targeted re-run would not collect the test the same way.
    extra = shlex.split(os.environ.get("VERIFY_PYTEST_ARGS", ""))
    return [sys.executable, "-m", "pytest", target.nodeid, "-p", "no:randomly", "-q", *extra, f"--junitxml={report}"]


# ------------------------------------------------------------------- reports


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def junit_counts(report: Path, class_name: str, method: str) -> SideResult | None:
    """Attempts of one test case in a JUnit report, counting failsafe's rerun records:
    `flaky*` are failed attempts before a pass, `rerun*` failed re-runs of a failure."""
    try:
        root = ElementTree.parse(report).getroot()
    except (ElementTree.ParseError, OSError):
        return None
    result = None
    for case in root.iter():
        if _local(case.tag) != "testcase":
            continue
        if case.attrib.get("classname") != class_name:
            continue
        if PARAMS.sub("", case.attrib.get("name", "")) != method:
            continue
        children = [_local(child.tag) for child in case]
        if "skipped" in children:
            continue
        failed = sum(c in ("flakyFailure", "flakyError", "rerunFailure", "rerunError") for c in children)
        final_failed = any(c in ("failure", "error") for c in children)
        result = result or SideResult()
        result.failed += failed + int(final_failed)
        result.runs += failed + 1
    return result


def playwright_counts(results: dict, target: Target) -> SideResult | None:
    wanted = target.title
    side = None

    def walk(suite: dict, titles: tuple[str, ...]) -> None:
        nonlocal side
        title = str(suite.get("title") or "").strip()
        file = str(suite.get("file") or "")
        prefix = titles + ((title,) if title and title not in (file, file.rsplit("/", 1)[-1]) else ())
        for spec in suite.get("specs") or []:
            full = " › ".join((*prefix, str(spec.get("title") or "").strip()))
            if full != wanted:
                continue
            for test in spec.get("tests") or []:
                if str(test.get("projectName") or "") != target.project:
                    continue
                for attempt in test.get("results") or []:
                    status = attempt.get("status")
                    if status == "skipped":
                        continue
                    side = side or SideResult()
                    side.runs += 1
                    side.failed += int(status in FAILED_STATUSES)
        for child in suite.get("suites") or []:
            walk(child, prefix)

    for suite in results.get("suites") or []:
        walk(suite, ())
    return side


# ------------------------------------------------------------------- running


def execute(argv: list[str], cwd: Path, log: Path) -> int:
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as handle:
        handle.write(f"$ {shlex.join(argv)}\n")
        handle.flush()
        return subprocess.run(argv, cwd=cwd, stdout=handle, stderr=subprocess.STDOUT, check=False).returncode


def java_reports(class_name: str) -> list[Path]:
    outer = class_name.split("$", 1)[0]
    return sorted(IT_REPORTS.glob(f"TEST-{outer}*.xml"))


def run_java(targets: list[Target], side: str, runs: int, work: Path) -> dict[str, SideResult]:
    results = {t.test_id: SideResult() for t in targets}
    groups: dict[tuple[str, str], list[Target]] = {}
    for target in targets:
        groups.setdefault((target.profile, target.lane), []).append(target)
    for (profile, lane), group in groups.items():
        if not profile or not lane:
            for target in group:
                results[target.test_id].problems.append("outcome has no engine profile or lane")
            continue
        # Every attempt is a fresh JVM: the entry side stops at a test's first pass, the
        # parent side at its first failure.
        pending = list(group)
        for _ in range(runs):
            if not pending:
                break
            for stale in IT_REPORTS.glob("TEST-*.xml"):
                stale.unlink()
            execute(java_command(pending), REPO, work / f"{side}-java.log")
            still = []
            for target in pending:
                counts = [junit_counts(r, target.class_name, target.method) for r in java_reports(target.class_name)]
                counts = [c for c in counts if c]
                if not counts:
                    results[target.test_id].problems.append(f"no report named {target.test_id}")
                    continue
                result = results[target.test_id]
                failed = sum(c.failed for c in counts)
                result.failed += failed
                result.runs += sum(c.runs for c in counts)
                if (side == "entry" and failed) or (side == "parent" and not failed):
                    still.append(target)
            pending = still
    return results


def run_playwright(targets: list[Target], side: str, runs: int, work: Path) -> dict[str, SideResult]:
    results = {}
    for index, target in enumerate(targets):
        report = work / f"{side}-pw-{index}.json"
        with report.open("w", encoding="utf-8") as out, (work / f"{side}-playwright.log").open("a", encoding="utf-8") as log:
            subprocess.run(
                playwright_command(target, runs, report), cwd=UI_DIR, stdout=out, stderr=log, check=False
            )
        try:
            counts = playwright_counts(json.loads(report.read_text() or "{}"), target)
        except json.JSONDecodeError:
            counts = None
        results[target.test_id] = counts or SideResult(problems=[f"no report named {target.test_id}"])
    return results


def run_python(targets: list[Target], side: str, runs: int, work: Path) -> dict[str, SideResult]:
    results = {}
    for index, target in enumerate(targets):
        result = SideResult()
        if not target.nodeid:
            result.problems.append(f"no test module found for {target.test_id}")
            results[target.test_id] = result
            continue
        class_name, method = target.test_id.split("#", 1)
        for attempt in range(runs):
            report = work / f"{side}-py-{index}-{attempt}.xml"
            execute(python_command(target, report), INGESTION_DIR, work / f"{side}-python.log")
            counts = junit_counts(report, class_name, PARAMS.sub("", method))
            if not counts:
                result.problems.append(f"no report named {target.test_id}")
                break
            result.failed += counts.failed
            result.runs += counts.runs
            stop = counts.failed == 0 if side == "entry" else counts.failed > 0
            if stop:
                break
        results[target.test_id] = result
    return results


RUNNERS = {"java-it": run_java, "playwright": run_playwright, "python": run_python}


def playwright_shard_targets(results: dict) -> list[Target]:
    """The failed tests of a shard's own results.json, as targets."""
    failed, _ = evidence_mod.playwright_tests(results)
    targets: dict[str, Target] = {}
    for test in failed:
        test_id = evidence_mod.playwright_id(test)
        target = playwright_target(test_id, evidence_mod.fingerprint(test_id, test.get("error") or ""))
        target.file = f"playwright/e2e/{test['file']}:{test['line']}" if test.get("line") else f"playwright/e2e/{test['file']}"
        targets.setdefault(test_id, target)
    return list(targets.values())


def run_playwright_shard(results_path: Path, repeats: int, work: Path, max_tests: int) -> tuple[list[Target], dict[str, SideResult], str]:
    """Re-run a shard's failed tests in the shard's own, still-running environment.

    Each test is selected by its location, so only it runs; a test that leans on an
    earlier test of a serial describe block will fail here too and is counted as
    reproducing, which is the conservative answer."""
    results = json.loads(results_path.read_text())
    targets = playwright_shard_targets(results)
    if not targets:
        return [], {}, "no failed tests in the shard's results"
    if len(targets) > max_tests:
        return [], {}, f"{len(targets)} failing tests exceed verify.maxFailingTests ({max_tests})"
    work.mkdir(parents=True, exist_ok=True)
    by_project: dict[str, list[Target]] = {}
    for target in targets:
        by_project.setdefault(target.project, []).append(target)
    outcome: dict[str, SideResult] = {}
    for index, (project, group) in enumerate(sorted(by_project.items())):
        report = work / f"entry-pw-{index}.json"
        argv = [
            "npx", "playwright", "test", f"--project={project}",
            *sorted({t.file for t in group}),
            f"--repeat-each={repeats}", "--retries=0", "--reporter=json",
            f"--output={work / 'pw-verify-output'}",
        ]
        log = work / "entry-playwright.log"
        with log.open("a", encoding="utf-8") as handle:
            handle.write(f"$ {shlex.join(argv)}\n")
            handle.flush()
            subprocess.run(
                argv, cwd=UI_DIR, stdout=handle, stderr=subprocess.STDOUT, check=False,
                env={**os.environ, "PLAYWRIGHT_JSON_OUTPUT_NAME": str(report)},
            )
        try:
            rerun = json.loads(report.read_text()) if report.exists() else {}
        except json.JSONDecodeError:
            rerun = {}
        for target in group:
            counts = playwright_counts(rerun, target)
            outcome[target.test_id] = counts or SideResult(problems=[f"no report named {target.test_id}"])
    return targets, outcome, ""


# ------------------------------------------------------------------- document


def build_document(
    targets: list[Target],
    entry: dict[str, dict],
    parent: dict[str, dict] | None,
    run_id: str,
    run_attempt: str,
    parent_sha: str,
    skipped: str = "",
    suite: str = "",
) -> dict:
    tests = []
    for target in targets:
        entry_side = entry.get(target.test_id) or {}
        parent_side = (parent or {}).get(target.test_id)
        tests.append(
            {
                "id": target.test_id,
                "fingerprint": target.fingerprint,
                "entry": {"failed": entry_side.get("failed", 0), "runs": entry_side.get("runs", 0)},
                "parent": None
                if parent_side is None
                else {"failed": parent_side.get("failed", 0), "runs": parent_side.get("runs", 0)},
                "problems": entry_side.get("problems", []) + (parent_side or {}).get("problems", []),
            }
        )
    return {
        "schemaVersion": 1,
        "suite": suite or (targets[0].suite if targets else ""),
        "runId": run_id,
        "runAttempt": run_attempt,
        "parentSha": parent_sha,
        "skipped": skipped,
        "tests": tests,
    }


def unverifiable(document: dict) -> bool:
    """True when some test lacks a usable answer, which is the verify job's failure."""
    for test in document["tests"]:
        if test["problems"] or test["entry"]["runs"] == 0:
            return True
        reproduced = test["entry"]["failed"] > 0
        if reproduced and (test["parent"] is None or test["parent"]["runs"] == 0):
            return True
    return False


def ledger_results(targets: list[Target], parent_sha: str, min_runs: int) -> dict[str, SideResult]:
    """Parent results another entry on the same parent already verified. Every queue
    entry built on one commit asks the same question; the first one's answer, from the
    merge gate's ledger, saves the rest a rebuild and a re-run. Any error means no
    reuse: the control simply runs."""
    import merge_gate_registry as registry
    import merge_queue_metrics as mq

    try:
        owner, _, repo = os.environ["GITHUB_REPOSITORY"].partition("/")
        records = registry.ledger_read(owner, repo, mq.env_token())
    except (Exception, SystemExit) as exc:  # noqa: BLE001 - reuse is an optimisation only
        print(f"ledger not reused: {exc}")
        return {}
    reused = {}
    for target in targets:
        hit = registry.ledger_lookup(records, target.test_id, target.fingerprint, parent_sha, min_runs=min_runs)
        if hit:
            reused[target.test_id] = SideResult(failed=int(hit["failed"]), runs=int(hit["runs"]))
    return reused


# ------------------------------------------------------------------- CLI


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--policy", type=Path, default=POLICY_PATH)
    commands = parser.add_subparsers(dest="command", required=True)
    sel = commands.add_parser("select")
    sel.add_argument("--suite", choices=SUITES, required=True)
    sel.add_argument("--evidence-dir", type=Path, required=True)
    sel.add_argument("--out", type=Path, required=True)
    run = commands.add_parser("run")
    run.add_argument("--targets", type=Path, required=True)
    run.add_argument("--side", choices=("entry", "parent"), required=True)
    run.add_argument("--only-reproduced", type=Path, help="entry results; parent runs only tests that failed there")
    run.add_argument("--work", type=Path, required=True)
    run.add_argument("--out", type=Path, required=True)
    run.add_argument("--checkout", type=Path, help="run the tests from this checkout (the parent commit)")
    run.add_argument("--parent-sha", default="", help="with --side parent: reuse ledger results for this commit")
    run.add_argument("--reuse-ledger", action="store_true", help="skip parent re-runs the merge-gate ledger already answers")
    run.add_argument("--skip", type=Path, help="results file whose tests are already answered")
    ledger = commands.add_parser("ledger", help="answer parent controls from the merge-gate ledger only")
    ledger.add_argument("--targets", type=Path, required=True)
    ledger.add_argument("--only-reproduced", type=Path, required=True)
    ledger.add_argument("--parent-sha", required=True)
    ledger.add_argument("--out", type=Path, required=True)
    shard = commands.add_parser("pw-shard", help="re-run a Playwright shard's failed tests in place")
    shard.add_argument("--results", type=Path, required=True)
    shard.add_argument("--work", type=Path, required=True)
    shard.add_argument("--run-id", required=True)
    shard.add_argument("--run-attempt", required=True)
    shard.add_argument("--out", type=Path, required=True)
    doc = commands.add_parser("document")
    doc.add_argument("--targets", type=Path, required=True)
    doc.add_argument("--entry", type=Path, required=True)
    doc.add_argument("--parent", type=Path, nargs="*", default=[])
    doc.add_argument("--run-id", required=True)
    doc.add_argument("--run-attempt", required=True)
    doc.add_argument("--parent-sha", required=True)
    doc.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def load_targets(path: Path) -> tuple[list[Target], str]:
    data = json.loads(path.read_text())
    return [Target(**item) for item in data["targets"]], data.get("skipped", "")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    verify = json.loads(args.policy.read_text())["verify"]
    if args.command == "select":
        cap = (verify.get("suites") or {}).get(args.suite, {}).get("maxFailingTests", verify["maxFailingTests"])
        targets, skipped = select(args.evidence_dir, args.suite, int(cap))
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({"targets": [asdict(t) for t in targets], "skipped": skipped}, indent=1))
        print(f"{len(targets)} test(s) to verify" + (f"; {skipped}" if skipped else ""))
        return 0
    if args.command == "pw-shard":
        cap = (verify.get("suites") or {}).get("playwright", {}).get("maxFailingTests", verify["maxFailingTests"])
        targets, entry, skipped = run_playwright_shard(args.results, int(verify["entryRuns"]), args.work, int(cap))
        document = build_document(
            targets, {k: asdict(v) for k, v in entry.items()}, None, args.run_id, args.run_attempt, "", skipped, "playwright"
        )
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(document, indent=1))
        print(f"{len(targets)} test(s) re-run in the shard" + (f"; {skipped}" if skipped else ""))
        # The shard has already failed; this step only adds evidence.
        return 0
    if args.command == "run":
        if args.checkout:
            use_checkout(args.checkout)
        targets, _ = load_targets(args.targets)
        if args.only_reproduced:
            entry = json.loads(args.only_reproduced.read_text())
            targets = [t for t in targets if (entry.get(t.test_id) or {}).get("failed", 0) > 0]
        if args.skip and args.skip.exists():
            answered = json.loads(args.skip.read_text())
            targets = [t for t in targets if t.test_id not in answered]
        runs = int(verify["entryRuns"] if args.side == "entry" else verify["parentRuns"])
        args.work.mkdir(parents=True, exist_ok=True)
        reused: dict[str, SideResult] = {}
        if args.side == "parent" and args.reuse_ledger and args.parent_sha:
            reused = ledger_results(targets, args.parent_sha, runs)
            targets = [t for t in targets if t.test_id not in reused]
        results = RUNNERS[targets[0].suite](targets, args.side, runs, args.work) if targets else {}
        results.update(reused)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({k: asdict(v) for k, v in results.items()}, indent=1))
        return 0
    if args.command == "ledger":
        targets, _ = load_targets(args.targets)
        entry = json.loads(args.only_reproduced.read_text())
        reproduced = [t for t in targets if (entry.get(t.test_id) or {}).get("failed", 0) > 0]
        answered = ledger_results(reproduced, args.parent_sha, int(verify["parentRuns"])) if reproduced else {}
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps({k: asdict(v) for k, v in answered.items()}, indent=1))
        print(f"remaining={len(reproduced) - len(answered)}")
        return 0
    targets, skipped = load_targets(args.targets)
    entry = json.loads(args.entry.read_text())
    parent: dict | None = None
    for path in args.parent:
        if path.exists():
            parent = {**(parent or {}), **json.loads(path.read_text())}
    document = build_document(targets, entry, parent, args.run_id, args.run_attempt, args.parent_sha, skipped)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, indent=1))
    return 1 if unverifiable(document) else 0


if __name__ == "__main__":
    raise SystemExit(main())
