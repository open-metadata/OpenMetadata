#!/usr/bin/env python3
"""Replay the merge gate's first stage over harvested merge-queue failures.

ci_evidence_harvest.py archives every failed merge-group run attempt of the current
workflows. This maps each one onto the gate's inputs, with the legacy job names
translated to ci.yml's stages, and reports what the gate would have done before any
verification ran:

  infra          re-run only the failed jobs (by signature)
  deterministic  eject at once (static checks, compile errors, build)
  too-many       eject at once (more failing tests than verify.maxFailingTests)
  unit           eject at once (unit suites are not verified)
  verify         run the same-run verification for N tests

It also measures what history can say without the gate: failing tests recurring
across different PRs, and attempts that failed and then passed on a re-run with no
code change, the one direct flake label the queue already produces.

History cannot show verification results, which do not exist yet; the shadow phase
measures those. This report sizes the work and checks the classification.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import merge_gate_evidence as evidence_mod
import merge_gate_policy as gate

POLICY_PATH = Path(__file__).resolve().parents[1] / "merge-gate" / "policy.json"
# Legacy jobs that only aggregate others: they fail whenever anything upstream does.
SUMMARY_JOBS = re.compile(
    r"^(playwright-summary|integration-tests-[a-z-]+|py-tests-status|python / Verify Expected Jobs|"
    r"(Integration )?Test Report.*|Verify .*)$"
)
LANE_JOB = re.compile(r"^Integration Test Lane \((?P<lane>[^)]+)\)$")
PW_SHARD_JOB = re.compile(r"playwright-ci \((?P<shard>[^,)]+)")
PY_IT_JOB = re.compile(r"Integration Tests \((?P<shard>shard-\d+), (?P<python>[\d.]+)\)")
PY_UNIT_JOB = re.compile(r"Unit Tests[^(]*\((?P<python>[\d.]+)\)")


def legacy_stage(job: dict) -> str:
    """ci.yml's stage for a legacy job, so the gate's job-name rules apply."""
    name, step = job["name"], job.get("failedStep") or ""
    if "Static Checks" in name and step == "Run Static Checks":
        return f"static / {name}"
    if "Checkstyle" in name or name in ("java-checkstyle", "ui-checkstyle", "py-checkstyle"):
        return f"static / {name}"
    if name.startswith("Build ") or "plan-playwright" in name:
        return f"build / {name}"
    if "Unit Tests" in name:
        return f"unit / {name}"
    if match := LANE_JOB.match(name):
        return f"it / {match['lane']}"
    if match := PW_SHARD_JOB.search(name):
        return f"playwright / {match['shard']}"
    if match := PY_IT_JOB.search(name):
        return f"py-it / {match['shard']}-{match['python']}"
    return name


def outcome_lane(name: str) -> str | None:
    """The outcome.json `context.lane` a legacy Java or Python job writes."""
    if match := LANE_JOB.match(name):
        return match["lane"]
    if match := PY_IT_JOB.search(name):
        return f"{match['shard']}-python-{match['python']}"
    if match := PY_UNIT_JOB.search(name):
        return f"python-{match['python']}"
    return None


def outcome_for_job(record: dict, job: dict) -> dict | None:
    lane = outcome_lane(job["name"])
    return next(
        (o for o in record["outcomes"] if lane and (o.get("context") or {}).get("lane") == lane),
        None,
    )


def tests_for_job(record: dict, job: dict) -> list[tuple[str, str]]:
    """(test id, message) of the failing tests a legacy job's evidence names."""
    if match := PW_SHARD_JOB.search(job["name"]):
        return [
            (f"{t.get('project')} :: {t['file']} :: {t['title']}", t.get("error") or "")
            for t in (record.get("playwright") or {}).get("failed") or []
            if t.get("shard") == match["shard"]
        ]
    outcome = outcome_for_job(record, job) or {}
    return [(t["id"], t.get("message") or "") for t in outcome.get("failedTests") or []]


def first_stage(record: dict, policy: gate.Policy) -> tuple[str, str, list[tuple[str, str]]]:
    """(category, detail, failing tests) for one harvested attempt."""
    jobs = [j for j in record["jobs"] if not SUMMARY_JOBS.match(j["name"])]
    if not jobs:
        return "summary-only", "only aggregate jobs failed", []
    failing: list[tuple[str, str]] = []
    kinds = []
    per_suite: dict[str, set[str]] = defaultdict(set)
    caps: dict[str, int] = {}
    for job in jobs:
        tests = tests_for_job(record, job)
        failing += tests
        suite, caps[suite] = policy.suite_for_job(legacy_stage(job))
        per_suite[suite].update(t for t, _ in tests)
        failed_job = gate.FailedJob(
            name=legacy_stage(job),
            conclusion=job.get("conclusion") or "failure",
            failed_step=job.get("failedStep"),
            reason=job.get("reason") or "",
            outcome=(outcome_for_job(record, job) or {}).get("classification"),
            failing_tests=tuple(t for t, _ in tests),
        )
        kinds.append((failed_job.name, *gate.job_kind(failed_job, policy)))
    if any(kind == "deterministic" for _, kind, _ in kinds):
        detail = next(why for _, kind, why in kinds if kind == "deterministic")
        return "deterministic", detail, failing
    test_ids = list(dict.fromkeys(t for t, _ in failing))
    if any(name.startswith("unit / ") and kind == "test" for name, kind, _ in kinds):
        return "unit", "unit-suite failure", failing
    over = [(suite, len(tests)) for suite, tests in per_suite.items() if len(tests) > caps[suite]]
    if over:
        return "too-many", ", ".join(f"{n} {suite} tests" for suite, n in over), failing
    if test_ids:
        return "verify", f"{len(test_ids)} tests", failing
    infra = [why for _, kind, why in kinds if kind == "infra"]
    if infra:
        return "infra", infra[0], failing
    return "unknown", "; ".join(f"{name}: {why}" for name, _, why in kinds)[:200], failing


def replay(records: list[dict], policy: gate.Policy) -> dict:
    stages: Counter[str] = Counter()
    by_suite: dict[str, Counter] = defaultdict(Counter)
    infra_signatures: Counter[str] = Counter()
    verify_sizes: Counter[int] = Counter()
    test_prs: dict[str, set[int]] = defaultdict(set)
    test_names: dict[str, str] = {}
    rerun_green: Counter[str] = Counter()
    unknown_examples: list[str] = []
    for record in records:
        category, detail, failing = first_stage(record, policy)
        stages[category] += 1
        by_suite[record["suite"]][category] += 1
        if category == "infra":
            infra_signatures[detail] += 1
        if category == "verify":
            verify_sizes[len({t for t, _ in failing})] += 1
        if category == "unknown" and len(unknown_examples) < 10:
            unknown_examples.append(f"{record['url']}: {detail}")
        if record.get("laterAttemptConclusion") == "success":
            rerun_green[category] += 1
        for test_id, message in failing:
            fp = evidence_mod.fingerprint(test_id, message)
            test_names[fp] = test_id
            if record.get("prNumber"):
                test_prs[fp].add(record["prNumber"])
    recurring = sorted(
        ((len(prs), test_names[fp], fp) for fp, prs in test_prs.items() if len(prs) >= 2),
        reverse=True,
    )
    return {
        "attempts": len(records),
        "stages": dict(stages.most_common()),
        "bySuite": {suite: dict(c.most_common()) for suite, c in sorted(by_suite.items())},
        "infraSignatures": dict(infra_signatures.most_common()),
        "verifySizes": dict(sorted(verify_sizes.items())),
        "failedThenGreenOnRerun": dict(rerun_green.most_common()),
        "fingerprints": len(test_prs),
        "recurringAcrossPrs": [
            {"prs": count, "test": name, "fingerprint": fp} for count, name, fp in recurring[:25]
        ],
        "recurringFingerprints": len(recurring),
        "unknownExamples": unknown_examples,
    }


def render(report: dict, window: str) -> str:
    lines = [f"## Merge-gate replay, {window}", "", f"Failed merge-group run attempts: **{report['attempts']}**", ""]
    lines += ["| First stage | Attempts |", "|---|---:|"]
    lines += [f"| {k} | {v} |" for k, v in report["stages"].items()]
    lines += ["", "| Suite | " + " | ".join(report["stages"]) + " |", "|---|" + "---:|" * len(report["stages"])]
    for suite, counts in report["bySuite"].items():
        lines.append(f"| {suite} | " + " | ".join(str(counts.get(k, 0)) for k in report["stages"]) + " |")
    lines += ["", "Infra signatures: " + ", ".join(f"{k} ({v})" for k, v in report["infraSignatures"].items())]
    lines += ["", "Tests per verify job: " + ", ".join(f"{k}: {v}" for k, v in report["verifySizes"].items())]
    lines += [
        "",
        "Failed, then green on a re-run of the same commit: "
        + (", ".join(f"{k} {v}" for k, v in report["failedThenGreenOnRerun"].items()) or "none"),
        "",
        f"Failure fingerprints: {report['fingerprints']}; recurring across ≥2 PRs: {report['recurringFingerprints']}",
        "",
        "| PRs | Test |",
        "|---:|---|",
    ]
    lines += [f"| {r['prs']} | `{r['test'][:140]}` |" for r in report["recurringAcrossPrs"]]
    if report["unknownExamples"]:
        lines += ["", "Unclassified examples:"] + [f"- {e}" for e in report["unknownExamples"]]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--records", type=Path, default=Path("target/ci-replay"))
    parser.add_argument("--policy", type=Path, default=POLICY_PATH)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args(argv)
    policy = gate.Policy.load(args.policy)
    records = [json.loads(p.read_text()) for p in sorted(args.records.glob("runs/*/record.json"))]
    if not records:
        print(f"::error::No harvested records under {args.records}")
        return 1
    report = replay(records, policy)
    created = sorted(r["createdAt"] for r in records if r.get("createdAt"))
    window = f"{created[0][:16]} → {created[-1][:16]} UTC" if created else "unknown window"
    out = args.out or args.records
    out.mkdir(parents=True, exist_ok=True)
    (out / "replay-report.json").write_text(json.dumps(report, indent=1))
    (out / "replay-report.md").write_text(render(report, window))
    print(render(report, window))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
