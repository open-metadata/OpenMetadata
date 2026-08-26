#!/usr/bin/env python3
"""Build duration-aware Playwright shard manifests from test discovery and history."""

from __future__ import annotations

import argparse
import json
import sys
import math
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable


FULL_PROJECTS = {
    "chromium",
    "Basic",
    "Data Insight",
    "Ingestion",
    "ImportExport",
    "DataAssetRulesEnabled",
    "DataAssetRulesDisabled",
    "SearchRBAC",
    "DomainIsolation",
    "search-nightly",
    "Reindex",
    "GlobalSettings",
    "SystemCertificationTags",
    "IntakeForm",
}
PROJECT_LANES = {
    "chromium": "chromium",
    "Basic": "chromium",
    "Data Insight": "chromium",
    "Ingestion": "ingestion",
    "ImportExport": "import-export",
    "DataAssetRulesEnabled": "data-asset-rules",
    "DataAssetRulesDisabled": "data-asset-rules",
    "SearchRBAC": "search-rbac",
    "DomainIsolation": "domain-isolation",
    "search-nightly": "search",
    "Reindex": "reindex",
    "GlobalSettings": "global-state",
    "SystemCertificationTags": "global-state",
    "IntakeForm": "global-state",
}
PROJECT_DEPENDENCIES = {
    "DataAssetRulesDisabled": {"DataAssetRulesEnabled"},
}
LANE_WORKERS = {
    "domain-isolation": 1,
    "global-state": 1,
    "import-export": 2,
    "ingestion": 1,
    "reindex": 1,
    "search": 1,
    "search-rbac": 1,
}
TARGET_MS = 20 * 60 * 1000
# Chromium shard budget, derived from the predicted→actual execution tail
# rather than from the average. Measured on merge_group run 32219260486
# (23 chromium shards, fresh auto-refreshed baseline): actual/predicted
# execution ratio has median 0.96 — predictions are well calibrated — but
# the tail reaches 1.08 on a healthy run and 1.23 on a noisy one
# (chromium-01 in run 32209040146 was SIGTERM'd by the 25-minute wrapper
# with 162/164 tests already passed). The binding constraint is that
# budget × worst-tail-ratio must stay under the 1500-second wrapper:
#   21 min × 1.23 = 1550 s  → dead shard, all tests green (the outage)
#   19 min × 1.23 = 1402 s  → 98 s of margin
#   19 min × 1.32 = 1500 s  → break-even; tolerated tail is 1.32
# 21 min was a stop-gap (#30784) to fit the lane under the old 24-shard
# ceiling; the ceiling is now 28 (below), which is what actually makes a
# 19-minute budget feasible again.
COMMON_SHARD_BUDGET_MS = 19 * 60 * 1000
EFFICIENCY = 0.85
# Raised 24 → 28 together with the budget revert above. Current chromium
# content (~71,700 predicted worker-seconds) needs 25 shards at a
# 19-minute budget — over the old cap, which is exactly why #30784 had to
# raise the budget instead. 28 leaves ~12% content-growth headroom before
# planning aborts; if the lane grows past that, split heavy suites (see
# AUDITED_PARALLEL_SUITES) before considering another cap raise.
COMMON_MAX_SHARDS = 28
# Weight assigned to a test that has no timing evidence in `timing-baseline.json`
# (or in any additional history payloads). Bumped from 20 s → 30 s alongside the
# all-zero-history fix in `load_history`: a suite re-enabled after being
# `test.skip`'d at baseline capture (e.g. Pages/Domains.spec.ts in #30451) now
# falls through to this fallback until the next full-run baseline refresh, and
# 20 s was noticeably below the observed per-test average of ~25 s on that
# suite. 30 s preserves a reasonable margin so the first plan after re-enable
# does not silently over-pack the shard.
FALLBACK_TEST_MS = 30_000
AUDITED_PARALLEL_SUITES = {
    ("Features/AdvancedSearch.spec.ts", "Advanced Search"),
    # Six long-running tests (each 5-10 min per test.setTimeout) inside one
    # top-level describe. Left as a single atomic unit, its total weight
    # exceeds the 20-minute per-unit ceiling — merge-queue plan step for
    # PR #30697 failed with "chromium|Features/BulkImport.spec.ts|Bulk Import
    # Export (25.8m)" once the suite was re-enabled by #30458. Split it into
    # per-spec parallel units. beforeAll setup is per-test-instance
    # (module-scoped entity constructors generate unique names), so each
    # parallel unit brings its own state without cross-worker collision.
    ("Features/BulkImport.spec.ts", "Bulk Import Export"),
    ("Pages/DataContracts.spec.ts", "Data Contracts"),
    ("Pages/ExplorePageRightPanel.spec.ts", "Right Panel Test Suite"),
    ("Pages/Glossary.spec.ts", "Glossary tests"),
    ("Pages/Lineage/DataAssetLineage.spec.ts", "Column Level Lineage"),
    ("Pages/Lineage/DataAssetLineage.spec.ts", "Data asset lineage"),
}
ATOMIC_PARALLEL_SCOPES = {
    (
        "Pages/ExplorePageRightPanel.spec.ts",
        "Right Panel Test Suite",
        "Explore page right panel tests",
        "Overview panel - Deleted entity verification",
    ): 120_000,
}

# Filename convention → the tag-routed project each file MUST land on. When a
# planned unit's file matches a hint pattern but its project doesn't match the
# expected one, the plan step hard-fails with a clear message. This catches
# the tag-drop failure mode from PR #30834 (a re-enable rewrote
# `test.describe.fixme('...', { tag: '@import-export' }, ...)` as
# `test.describe('...', ...)`, silently dropping the tag → suite landed on
# chromium instead of the dedicated import-export lane).
#
# Today `BulkImport*.spec.ts` and `*ImportExport*.spec.ts` uniformly carry
# `@import-export` (12 of 13 matching files as of writing; the 13th is the
# bug this guard catches). Add other conventions as they emerge — the entry
# shape is (filename regex, expected project name, expected tag literal).
FILE_LANE_HINTS: list[tuple[re.Pattern[str], str, str]] = [
    (
        re.compile(r"(?:^|/)(?:BulkImport|[^/]*ImportExport)[^/]*\.spec\.ts$"),
        "ImportExport",
        "@import-export",
    ),
]


@dataclass
class Unit:
    project: str
    file: str
    title: str
    grep_titles: set[tuple[str, ...]] = field(default_factory=set)
    test_ids: set[str] = field(default_factory=set)
    test_names: dict[str, str] = field(default_factory=dict)
    weight_ms: int = 0
    weight_reserve_ms: int = 0

    @property
    def key(self) -> str:
        return f"{self.project}|{self.file}|{self.title}"

    @property
    def pattern(self) -> str:
        patterns = []
        for title in sorted(self.grep_titles):
            separator = r"(?:\s+@\S+)*\s+"
            patterns.append(
                "^"
                + separator.join(re.escape(value) for value in title)
                + r"(?:\s+@\S+)*$"
            )
        return "(?:" + "|".join(patterns) + ")"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-list", type=Path, required=True)
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--history", type=Path, action="append", default=[])
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--github-output", type=Path)
    return parser.parse_args()


def iter_specs(suite: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield from suite.get("specs", [])
    for child in suite.get("suites", []):
        yield from iter_specs(child)


def iter_specs_with_titles(
    suite: dict[str, Any], titles: tuple[str, ...] = ()
) -> Iterable[tuple[dict[str, Any], tuple[str, ...]]]:
    for spec in suite.get("specs", []):
        yield spec, titles + (spec.get("title", ""),)
    for child in suite.get("suites", []):
        child_titles = titles + (child.get("title", ""),)
        yield from iter_specs_with_titles(child, child_titles)


def projects_for_spec(spec: dict[str, Any]) -> set[str]:
    return {
        test.get("projectName", "")
        for test in spec.get("tests", [])
        if test.get("projectName") in FULL_PROJECTS
    }


def add_specs_to_units(
    units: dict[str, Unit],
    file: str,
    title: str,
    specs_with_titles: Iterable[tuple[dict[str, Any], tuple[str, ...]]],
    weight_reserve_ms: int = 0,
) -> None:
    specs_with_titles = list(specs_with_titles)
    specs = [spec for spec, _ in specs_with_titles]
    projects = (
        set().union(*(projects_for_spec(spec) for spec in specs)) if specs else set()
    )
    for project in projects:
        unit = Unit(
            project=project,
            file=file,
            title=title,
            weight_reserve_ms=weight_reserve_ms,
        )
        for spec, titles in specs_with_titles:
            if project in projects_for_spec(spec) and spec.get("id"):
                unit.test_ids.add(spec["id"])
                unit.test_names[spec["id"]] = spec.get("title", "")
                unit.grep_titles.add((project, file, *titles))
        units[unit.key] = unit


def add_specs_as_parallel_units(
    units: dict[str, Unit],
    file: str,
    specs_with_titles: Iterable[tuple[dict[str, Any], tuple[str, ...]]],
) -> None:
    for spec, titles in specs_with_titles:
        spec_id = spec.get("id")
        if not spec_id:
            continue
        add_specs_to_units(
            units,
            file,
            f"{' › '.join(titles)} [{spec_id}]",
            [(spec, titles)],
        )


def add_specs_as_audited_units(
    units: dict[str, Unit],
    file: str,
    specs_with_titles: Iterable[tuple[dict[str, Any], tuple[str, ...]]],
) -> None:
    atomic_groups: dict[
        tuple[str, ...], list[tuple[dict[str, Any], tuple[str, ...]]]
    ] = defaultdict(list)
    parallel_specs: list[tuple[dict[str, Any], tuple[str, ...]]] = []
    for spec, titles in specs_with_titles:
        scope = next(
            (
                candidate
                for candidate in ATOMIC_PARALLEL_SCOPES
                if candidate[0] == file
                and titles[: len(candidate) - 1] == candidate[1:]
            ),
            None,
        )
        if scope is None:
            parallel_specs.append((spec, titles))
            continue
        atomic_groups[scope].append((spec, titles))

    add_specs_as_parallel_units(units, file, parallel_specs)
    for scope, grouped_specs in sorted(atomic_groups.items()):
        add_specs_to_units(
            units,
            file,
            " › ".join(scope[1:]),
            grouped_specs,
            ATOMIC_PARALLEL_SCOPES[scope],
        )


def discover_units(report: dict[str, Any]) -> list[Unit]:
    units: dict[str, Unit] = {}
    for file_suite in report.get("suites", []):
        file = file_suite.get("file", "")
        if not file or file.endswith(".setup.ts") or file.endswith(".teardown.ts"):
            continue
        for child in file_suite.get("suites", []):
            specs_with_titles = iter_specs_with_titles(child, (child.get("title", ""),))
            if (file, child.get("title", "")) in AUDITED_PARALLEL_SUITES:
                add_specs_as_audited_units(
                    units,
                    file,
                    specs_with_titles,
                )
            else:
                add_specs_to_units(
                    units,
                    file,
                    child.get("title", ""),
                    specs_with_titles,
                )
        for spec in file_suite.get("specs", []):
            add_specs_to_units(
                units,
                file,
                spec.get("title", ""),
                [(spec, (spec.get("title", ""),))],
            )
    return sorted(units.values(), key=lambda unit: unit.key)


def percentile_75(values: list[int]) -> int:
    if len(values) == 1:
        return values[0]
    quartiles = statistics.quantiles(values, n=4, method="inclusive")
    return round(quartiles[2])


def load_history(
    paths: list[Path],
) -> tuple[dict[str, int], dict[tuple[str, str], int]]:
    durations: dict[str, list[int]] = defaultdict(list)
    identity_durations: dict[tuple[str, str], list[int]] = defaultdict(list)
    for path in paths:
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("mode") != "full":
            continue
        for test in payload.get("tests", []):
            test_id = test.get("id")
            duration = max(0, int(test.get("durationMs", 0)))
            if test_id and duration > 0:
                durations[test_id].append(duration)
                identity = (
                    test.get("file", ""),
                    test.get("leafTitle", test.get("title", "")),
                )
                identity_durations[identity].append(duration)
            elif test_id and test.get("outcome") == "skipped":
                durations[test_id].append(0)

    # If every recorded run for a test was `outcome: skipped` (all-zero) the
    # test has no actual timing evidence — treat it as missing so the planner
    # falls through to the identity match or FALLBACK_TEST_MS instead of
    # pinning the weight at 0 ms. Otherwise a suite that was `test.skip`'d at
    # baseline capture (see Pages/Domains.spec.ts before #30451 re-enabled it)
    # keeps a "zero-weight" record after re-enable, the planner packs the
    # newly-live suite as free content, and the shard blows past the wall
    # timeout at run time (chromium-12 in run 30716060441).
    weights = {
        test_id: percentile_75(values)
        for test_id, values in durations.items()
        if any(v > 0 for v in values)
    }
    identity_weights = {
        identity: percentile_75(values)
        for identity, values in identity_durations.items()
    }
    return weights, identity_weights


def apply_history_weights(
    units: list[Unit],
    test_weights: dict[str, int],
    identity_weights: dict[tuple[str, str], int],
) -> None:
    for unit in units:
        unit.weight_ms = unit.weight_reserve_ms + sum(
            test_weights.get(
                test_id,
                identity_weights.get(
                    (unit.file, unit.test_names[test_id]), FALLBACK_TEST_MS
                ),
            )
            for test_id in unit.test_ids
        )


# Emit a GitHub Actions ::warning:: for any file where enough tests fall through
# to FALLBACK_TEST_MS that the plan is at real risk of under-budgeting the shard
# holding them (see fix #30812 for the failure mode). The gate is intentionally
# quiet: files with a handful of new tests trip nothing; a re-enabled suite of
# 10+ tests, or a smaller suite whose fallback allocation crosses one minute,
# gets an annotation the re-enabling PR author will see on the plan step.
UNWEIGHTED_WARN_MIN_TESTS = 10
UNWEIGHTED_WARN_MIN_MS = 60_000
# Hard-fail threshold: a file whose every planned test falls through to
# FALLBACK_TEST_MS AND has at least this many tests is the exact pattern that
# killed chromium-12 in #30812 — a suite that was `test.skip`'d at baseline
# capture, re-enabled without a baseline refresh, then packed at zero apparent
# cost by LPT. Any real re-enable of an existing suite will trip this (Domains
# was 47 tests, DomainDataProductsWidgets was 6); a single new test being
# added to a well-covered file will not (the file's other tests carry
# history). Kept intentionally low so a new spec-file addition also fails
# fast — a wholly-new file's author has just written the tests and knows the
# durations.
STALE_BASELINE_MIN_TESTS = 5


def emit_unweighted_warnings(
    units: list[Unit],
    test_weights: dict[str, int],
    identity_weights: dict[tuple[str, str], int],
) -> None:
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0})
    for unit in units:
        for test_id in unit.test_ids:
            if test_id in test_weights:
                continue
            if (unit.file, unit.test_names[test_id]) in identity_weights:
                continue
            stats[unit.file]["count"] += 1
    for file, entry in sorted(stats.items()):
        reserved_ms = entry["count"] * FALLBACK_TEST_MS
        if entry["count"] < UNWEIGHTED_WARN_MIN_TESTS and reserved_ms < UNWEIGHTED_WARN_MIN_MS:
            continue
        message = (
            f"{entry['count']} test(s) in {file} have no timing history; "
            f"planner reserved {reserved_ms / 60_000:.1f} min via FALLBACK_TEST_MS. "
            "If this suite was recently re-enabled, refresh timing-baseline.json "
            "with real durations to avoid shard overruns on the first plan."
        )
        print(f"::warning file={file}::{message}", file=sys.stderr)


def stale_baseline_files_in_plan(
    units: list[Unit],
    test_weights: dict[str, int],
    identity_weights: dict[tuple[str, str], int],
) -> list[tuple[str, int]]:
    """Return (file, planned_test_count) for each spec file where every test
    in the plan falls through to FALLBACK_TEST_MS — no test_weights hit and
    no identity_weights hit, for any test in the file's units. This is the
    stale-baseline signature that caused the chromium-12 SIGTERM (#30812)
    and shows up as a hard-fail here rather than the softer per-count
    warning above.
    """
    by_file_planned: dict[str, int] = defaultdict(int)
    by_file_unweighted: dict[str, int] = defaultdict(int)
    for unit in units:
        for test_id in unit.test_ids:
            by_file_planned[unit.file] += 1
            if test_id in test_weights:
                continue
            if (unit.file, unit.test_names[test_id]) in identity_weights:
                continue
            by_file_unweighted[unit.file] += 1
    return sorted(
        (file, by_file_planned[file])
        for file, planned in by_file_planned.items()
        if planned >= STALE_BASELINE_MIN_TESTS
        and by_file_unweighted[file] == planned
    )


def misrouted_lane_hint_violations(
    units: list[Unit],
) -> list[tuple[str, str, str, str]]:
    """Return (file, actual_project, expected_project, expected_tag) tuples
    for every planned unit whose file matches a FILE_LANE_HINTS pattern but
    whose project doesn't match the expected one. That's the tag-drop
    signature from PR #30834 — a describe was rewritten (`.fixme` removed,
    tag option accidentally dropped along with it) and the suite silently
    routed to the wrong lane.
    """
    violations: list[tuple[str, str, str, str]] = []
    for unit in units:
        for pattern, expected_project, expected_tag in FILE_LANE_HINTS:
            if not pattern.search(unit.file):
                continue
            if unit.project == expected_project:
                continue
            violations.append(
                (unit.file, unit.project, expected_project, expected_tag)
            )
            break  # one hint per file — first-match wins
    # Sort + dedupe: multiple units per file (audit-split) collapse to one line.
    return sorted(set(violations))


def normalize_spec(path: str) -> str:
    prefix = "playwright/e2e/"
    return path.removeprefix(prefix)


# Selector spec paths carry the "playwright/e2e/" prefix and live under the UI
# module. The planner runs from the repo root in CI, but tolerate a UI-dir CWD
# (e.g. a local run) by trying both roots.
SPEC_ROOT_CANDIDATES = (
    Path("."),
    Path("openmetadata-ui/src/main/resources/ui"),
)


def spec_file_exists(spec: str) -> bool:
    """True if the selector's spec resolves to a real file on disk.

    A spec may be an exact path or a glob pattern. Used to tell a spec that
    exists but has all of its tests tag-filtered out of this lane (safe to skip)
    from a stale/typo'd path that matches nothing anywhere (a real error).
    """
    is_glob = any(ch in spec for ch in "*?[")
    for root in SPEC_ROOT_CANDIDATES:
        if is_glob:
            if any(root.glob(spec)):
                return True
        elif (root / spec).is_file():
            return True
    return False


def selector_matches_unit(selector: dict[str, Any], unit: Unit) -> bool:
    pattern = normalize_spec(selector["spec"])
    if not Path(unit.file).match(pattern):
        return False
    projects = selector.get("projects", ["auto"])
    return "auto" in projects or unit.project in projects


def selected_projects(unit: Unit, selection: dict[str, Any]) -> bool:
    return selection["mode"] == "full" or any(
        selector_matches_unit(selector, unit)
        for selector in selection.get("selectors", [])
    )


def include_project_dependencies(
    units: list[Unit], discovered_units: list[Unit]
) -> list[Unit]:
    projects = {unit.project for unit in units}
    dependencies = set().union(
        *(PROJECT_DEPENDENCIES.get(project, set()) for project in projects)
    )
    if not dependencies:
        return units
    selected_keys = {unit.key for unit in units}
    return units + [
        unit
        for unit in discovered_units
        if unit.project in dependencies and unit.key not in selected_keys
    ]


def lane_bounds(lane: str, mode: str) -> tuple[int, int]:
    if lane == "chromium":
        return (5, COMMON_MAX_SHARDS) if mode == "full" else (1, COMMON_MAX_SHARDS)
    if lane in {
        "domain-isolation",
        "global-state",
        "import-export",
        "ingestion",
        "reindex",
        "search",
        "search-rbac",
    }:
        return (1, 8) if mode == "full" else (1, 2)
    return (1, 1)


def shard_budget_ms_for_lane(lane: str) -> int:
    return COMMON_SHARD_BUDGET_MS if lane == "chromium" else TARGET_MS


def shard_count(units: list[Unit], lane: str, mode: str) -> int:
    workers = LANE_WORKERS.get(lane, 3)
    minimum, maximum = lane_bounds(lane, mode)
    total_weight = sum(unit.weight_ms for unit in units)
    calculated = math.ceil(
        total_weight / (workers * shard_budget_ms_for_lane(lane) * EFFICIENCY)
    )
    return max(minimum, min(maximum, max(1, calculated)))


def assign_lpt(units: list[Unit], count: int) -> list[list[Unit]]:
    shards: list[list[Unit]] = [[] for _ in range(count)]
    weights = [0] * count
    for unit in sorted(units, key=lambda item: (-item.weight_ms, item.key)):
        index = min(
            range(count), key=lambda shard_index: (weights[shard_index], shard_index)
        )
        shards[index].append(unit)
        weights[index] += unit.weight_ms
    return shards


def predicted_execution_ms(units: list[Unit], workers: int) -> int:
    return max(
        math.ceil(sum(unit.weight_ms for unit in units) / (workers * EFFICIENCY)),
        max((unit.weight_ms for unit in units), default=0),
    )


def assign_lane_within_budget(
    units: list[Unit], lane: str, mode: str
) -> list[list[Unit]]:
    count = shard_count(units, lane, mode)
    _, maximum = lane_bounds(lane, mode)
    workers = LANE_WORKERS.get(lane, 3)
    budget_ms = shard_budget_ms_for_lane(lane)
    while True:
        shards = [shard for shard in assign_lpt(units, count) if shard]
        if all(predicted_execution_ms(shard, workers) <= budget_ms for shard in shards):
            return shards
        if count >= maximum:
            heaviest_ms = max(
                predicted_execution_ms(shard, workers) for shard in shards
            )
            raise SystemExit(
                f"Lane {lane} needs more than {maximum} shards to stay within the "
                f"{budget_ms / 60_000:.0f}-minute plan budget; the heaviest "
                f"shard is predicted at "
                f"{heaviest_ms / 60_000:.1f}m"
            )
        count += 1


def write_plan(
    output_dir: Path, lane: str, index: int, units: list[Unit]
) -> dict[str, Any]:
    shard_id = f"{lane}-{index + 1:02d}"
    workers = LANE_WORKERS.get(lane, 3)
    total_weight_ms = sum(unit.weight_ms for unit in units)
    predicted_ms = predicted_execution_ms(units, workers)
    budget_ms = shard_budget_ms_for_lane(lane)
    if predicted_ms > budget_ms:
        raise SystemExit(
            f"Shard {shard_id} is predicted to take "
            f"{predicted_ms / 60_000:.1f}m, above the "
            f"{budget_ms / 60_000:.0f}-minute plan budget"
        )
    plan = {
        "version": 1,
        "shardId": shard_id,
        "lane": lane,
        "workers": workers,
        "requiresAirflow": lane == "ingestion",
        "projects": sorted({unit.project for unit in units}),
        "files": sorted({f"playwright/e2e/{unit.file}" for unit in units}),
        "grep": "(?:" + "|".join(unit.pattern for unit in units) + ")",
        "predictedWorkerMs": total_weight_ms,
        "predictedExecutionMs": predicted_ms,
        "planningReserveMs": sum(unit.weight_reserve_ms for unit in units),
        "testCount": sum(len(unit.test_ids) for unit in units),
        "testIds": sorted(test_id for unit in units for test_id in unit.test_ids),
        "units": [unit.key for unit in units],
    }
    filename = f"{shard_id}.json"
    (output_dir / filename).write_text(
        json.dumps(plan, indent=2) + "\n", encoding="utf-8"
    )
    return {
        "shardId": shard_id,
        "plan": filename,
        "workers": workers,
        "lane": lane,
        "requiresAirflow": lane == "ingestion",
    }


# The workflow passes one `--history` per downloaded full-run artifact and only
# falls back to the checked-in baseline when *no* artifact could be downloaded
# (see the `history_args` block in playwright-e2e-reusable.yml). A newly added
# spec file exists in the baseline -- its author seeds the durations there, as
# the stale-baseline gate below instructs -- but in no artifact yet, so a single
# successful download silently dropped those seeded timings and the gate fired
# on a file that *does* have history. Fold the baseline in at the lowest
# precedence instead: an artifact weight always wins where one exists, and the
# baseline only backfills tests no artifact has ever observed.
CHECKED_IN_BASELINE = Path(".github/playwright/timing-baseline.json")


def backfill_from_checked_in_baseline(
    paths: list[Path],
    weights: dict[str, int],
    identity_weights: dict[tuple[str, str], int],
) -> None:
    baseline = next(
        (
            candidate
            for candidate in (root / CHECKED_IN_BASELINE for root in SPEC_ROOT_CANDIDATES)
            if candidate.is_file()
        ),
        None,
    )
    if baseline is None or any(path.resolve() == baseline.resolve() for path in paths):
        return
    fallback_weights, fallback_identity = load_history([baseline])
    for test_id, weight in fallback_weights.items():
        weights.setdefault(test_id, weight)
    for identity, weight in fallback_identity.items():
        identity_weights.setdefault(identity, weight)


def main() -> None:
    args = parse_args()
    report = json.loads(args.test_list.read_text(encoding="utf-8"))
    selection = json.loads(args.selection.read_text(encoding="utf-8"))
    test_weights, identity_weights = load_history(args.history)
    backfill_from_checked_in_baseline(args.history, test_weights, identity_weights)
    discovered_units = discover_units(report)
    unmatched_selectors = [
        selector["spec"]
        for selector in selection.get("selectors", [])
        if not any(selector_matches_unit(selector, unit) for unit in discovered_units)
    ]
    # An unmatched selector whose spec file exists on disk has simply had all of
    # its tests filtered out of this lane by the tag grep (e.g. an @ontology-rdf
    # spec picked up by change-detection but only runnable in the dedicated RDF
    # lane). Warn and skip it. A selector whose spec file does NOT exist is a
    # stale/typo'd path that matches nothing anywhere — keep failing on that.
    missing_selectors = []
    for spec in unmatched_selectors:
        if spec_file_exists(spec):
            print(
                f"::warning file={spec}::Playwright selector matched no runnable "
                "tests in this lane; skipping (it may run in a different lane).",
                file=sys.stderr,
            )
        else:
            missing_selectors.append(spec)
    if missing_selectors:
        raise SystemExit(
            "Playwright selectors reference specs that do not exist: "
            + ", ".join(missing_selectors)
        )
    units = [unit for unit in discovered_units if selected_projects(unit, selection)]
    units = include_project_dependencies(units, discovered_units)
    if not units:
        raise SystemExit("Playwright selection produced no runnable test units")

    apply_history_weights(units, test_weights, identity_weights)
    emit_unweighted_warnings(units, test_weights, identity_weights)

    # Only enforce the stale-baseline gate for targeted (PR-time) planning.
    # A full-mode run is what generates the new timing-history artifact in
    # the first place — the "wait for a nightly full-mode run" remediation
    # below requires that full-mode planning stay unblocked even when a
    # newly re-enabled suite has no baseline. In full mode, the softer
    # emit_unweighted_warnings above still surfaces the issue as a warning.
    stale_files = (
        stale_baseline_files_in_plan(units, test_weights, identity_weights)
        if selection["mode"] != "full"
        else []
    )
    if stale_files:
        # `::error file=...::` annotations resolve against the repo root, so
        # prefix the discovery-report file path (relative to `playwright/e2e/`)
        # with the full spec directory so the annotation attaches to the file
        # in the PR checks UI.
        spec_root = "openmetadata-ui/src/main/resources/ui/playwright/e2e"
        for file, count in stale_files:
            print(
                f"::error file={spec_root}/{file}::All {count} planned "
                f"test(s) in {file} have no timing history in "
                "timing-baseline.json. This is the stale-baseline pattern "
                "that caused the chromium-12 SIGTERM in run 30716060441 "
                "(see PR #30812).",
                file=sys.stderr,
            )
        details = "\n".join(
            f"  {file}: {count} planned test(s), 0 with baseline history"
            for file, count in stale_files
        )
        raise SystemExit(
            "Stale timing-baseline.json entries detected for spec file(s) in "
            "this plan. Every planned test in each file below falls through "
            "to FALLBACK_TEST_MS, so the planner will under-budget the shard "
            "containing them and the merge-queue wrapper will time out.\n\n"
            f"{details}\n\n"
            "To fix, either:\n"
            "  * Seed the observed durations for these files into "
            ".github/playwright/timing-baseline.json (see PR #30812 for the "
            "pattern — parse a passing job's log and write real durationMs "
            "with outcome: expected).\n"
            "  * Wait for a nightly full-mode run to organically refresh the "
            "baseline, then rebase.\n"
            "  * If this is a wholly-new spec file, run it locally and copy "
            "its durations into the baseline before merging.\n\n"
            "This gate catches the failure at PR time rather than on the "
            "merge queue — a wrapper timeout in the queue costs ~25 min per "
            "shard and blocks every downstream PR."
        )

    # (B) Check filename → expected-lane routing BEFORE the oversized-unit
    # gate below. This catches the tag-drop failure mode directly with an
    # actionable message; without it, the developer sees the generic
    # oversized-unit error (see A below) and has to guess whether they
    # need to split a suite or restore a tag.
    lane_violations = misrouted_lane_hint_violations(units)
    if lane_violations:
        for file, actual, expected, tag in lane_violations:
            print(
                f"::error file={file}::planned under `{actual}` project but its "
                f"filename convention expects `{expected}` (via `{tag}` tag). "
                "The describe likely lost its tag option — see PR #30834.",
                file=sys.stderr,
            )
        details = "\n".join(
            f"  {file}: on `{actual}` project, expected `{expected}` "
            f"(add `{{ tag: '{tag}' }}` to the top-level describe)"
            for file, actual, expected, tag in lane_violations
        )
        raise SystemExit(
            "Playwright spec files are routed to the wrong project. "
            "Each file below matches a FILE_LANE_HINTS pattern that expects a "
            "specific tag on its top-level describe, but the tag is missing "
            "so the suite falls through to another project.\n\n"
            f"{details}\n\n"
            "To fix, restore the expected `{ tag: '...' }` option on the "
            "describe. If this file was intentionally moved off its dedicated "
            "lane, update FILE_LANE_HINTS in .github/scripts/build_playwright_shards.py."
        )

    oversized_units = [unit for unit in units if unit.weight_ms > TARGET_MS]
    if oversized_units:
        details = ", ".join(
            f"{unit.key} ({unit.weight_ms / 60_000:.1f}m)"
            for unit in sorted(
                oversized_units, key=lambda item: item.weight_ms, reverse=True
            )
        )
        # (A) Common fixes list — the generic "refactor or audit" message
        # left developers guessing whether to split a suite or restore a
        # dropped lane tag. Point at both fixes concretely.
        raise SystemExit(
            "Atomic Playwright units exceed the 20-minute execution budget: "
            f"{details}\n\n"
            "Common fixes:\n"
            "  * If this suite belongs on a dedicated lane (import-export, "
            "domain-isolation, ingestion, reindex), verify the top-level "
            "describe still carries the correct `{ tag: '...' }` option — a "
            "recent edit (e.g. removing `.fixme` or `.skip`) may have dropped "
            "it, landing the suite on the wrong project. See FILE_LANE_HINTS "
            "and PR #30834 for the pattern.\n"
            "  * Otherwise add `(file, describe_title)` to "
            "AUDITED_PARALLEL_SUITES in "
            ".github/scripts/build_playwright_shards.py — the planner will "
            "then split the describe into per-spec parallel units so no "
            "single unit exceeds the ceiling."
        )

    lanes: dict[str, list[Unit]] = defaultdict(list)
    for unit in units:
        lanes[PROJECT_LANES[unit.project]].append(unit)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    matrix_entries: list[dict[str, Any]] = []
    for lane in sorted(lanes):
        lane_units = lanes[lane]
        shards = assign_lane_within_budget(lane_units, lane, selection["mode"])
        for index, shard_units in enumerate(shards):
            matrix_entries.append(write_plan(args.output_dir, lane, index, shard_units))

    matrix = {"include": matrix_entries}
    matrix_path = args.output_dir / "matrix.json"
    matrix_path.write_text(json.dumps(matrix, indent=2) + "\n", encoding="utf-8")
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as output:
            output.write(f"matrix={json.dumps(matrix, separators=(',', ':'))}\n")
            output.write(f"shard_count={len(matrix_entries)}\n")
            output.write(
                "requires_airflow="
                f"{str(any(entry['requiresAirflow'] for entry in matrix_entries)).lower()}\n"
            )


if __name__ == "__main__":
    main()
