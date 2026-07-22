#!/usr/bin/env python3
"""Build duration-aware Playwright shard manifests from test discovery and history."""

from __future__ import annotations

import argparse
import json
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
    "Ingestion",
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
    "Ingestion": "ingestion",
    "DataAssetRulesEnabled": "data-asset-rules",
    "DataAssetRulesDisabled": "data-asset-rules",
    "SearchRBAC": "data-asset-rules",
    "DomainIsolation": "domain-isolation",
    "search-nightly": "search",
    "Reindex": "reindex",
    "GlobalSettings": "global-state",
    "SystemCertificationTags": "global-state",
    "IntakeForm": "global-state",
}
PROJECT_DEPENDENCIES = {
    "DataAssetRulesDisabled": {"DataAssetRulesEnabled"},
    "SearchRBAC": {"DataAssetRulesDisabled", "DataAssetRulesEnabled"},
}
LANE_WORKERS = {
    "domain-isolation": 1,
    "global-state": 1,
    "ingestion": 1,
    "reindex": 1,
    "search": 1,
}
TARGET_MS = 20 * 60 * 1000
COMMON_SHARD_BUDGET_MS = 15 * 60 * 1000
EFFICIENCY = 0.85
COMMON_MAX_SHARDS = 40
FALLBACK_TEST_MS = 20_000
AUDITED_PARALLEL_SUITES = {
    ("Features/AdvancedSearch.spec.ts", "Advanced Search"),
    ("Pages/DataContracts.spec.ts", "Data Contracts"),
    ("Pages/ExplorePageRightPanel.spec.ts", "Right Panel Test Suite"),
    ("Pages/Glossary.spec.ts", "Glossary tests"),
    ("Pages/Lineage/DataAssetLineage.spec.ts", "Column Level Lineage"),
    ("Pages/Lineage/DataAssetLineage.spec.ts", "Data asset lineage"),
}


@dataclass
class Unit:
    project: str
    file: str
    title: str
    grep_titles: set[tuple[str, ...]] = field(default_factory=set)
    test_ids: set[str] = field(default_factory=set)
    test_names: dict[str, str] = field(default_factory=dict)
    weight_ms: int = 0

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
) -> None:
    specs_with_titles = list(specs_with_titles)
    specs = [spec for spec, _ in specs_with_titles]
    projects = (
        set().union(*(projects_for_spec(spec) for spec in specs)) if specs else set()
    )
    for project in projects:
        unit = Unit(project=project, file=file, title=title)
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


def discover_units(report: dict[str, Any]) -> list[Unit]:
    units: dict[str, Unit] = {}
    for file_suite in report.get("suites", []):
        file = file_suite.get("file", "")
        if not file or file.endswith(".setup.ts") or file.endswith(".teardown.ts"):
            continue
        for child in file_suite.get("suites", []):
            specs_with_titles = iter_specs_with_titles(child, (child.get("title", ""),))
            if (file, child.get("title", "")) in AUDITED_PARALLEL_SUITES:
                add_specs_as_parallel_units(units, file, specs_with_titles)
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
            duration = int(test.get("durationMs", 0))
            if test_id and duration > 0:
                durations[test_id].append(duration)
                identity = (
                    test.get("file", ""),
                    test.get("leafTitle", test.get("title", "")),
                )
                identity_durations[identity].append(duration)

    weights = {test_id: percentile_75(values) for test_id, values in durations.items()}
    identity_weights = {
        identity: percentile_75(values)
        for identity, values in identity_durations.items()
    }
    return weights, identity_weights


def normalize_spec(path: str) -> str:
    prefix = "playwright/e2e/"
    return path.removeprefix(prefix)


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
        "ingestion",
        "reindex",
        "search",
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
    while True:
        shards = [shard for shard in assign_lpt(units, count) if shard]
        if all(predicted_execution_ms(shard, workers) <= TARGET_MS for shard in shards):
            return shards
        if count >= maximum:
            heaviest_ms = max(
                predicted_execution_ms(shard, workers) for shard in shards
            )
            raise SystemExit(
                f"Lane {lane} needs more than {maximum} shards to stay within the "
                f"20-minute plan budget; the heaviest shard is predicted at "
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
    if predicted_ms > TARGET_MS:
        raise SystemExit(
            f"Shard {shard_id} is predicted to take "
            f"{predicted_ms / 60_000:.1f}m, above the 20-minute plan budget"
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


def main() -> None:
    args = parse_args()
    report = json.loads(args.test_list.read_text(encoding="utf-8"))
    selection = json.loads(args.selection.read_text(encoding="utf-8"))
    test_weights, identity_weights = load_history(args.history)
    discovered_units = discover_units(report)
    unmatched_selectors = [
        selector["spec"]
        for selector in selection.get("selectors", [])
        if not any(selector_matches_unit(selector, unit) for unit in discovered_units)
    ]
    if unmatched_selectors:
        raise SystemExit(
            "Playwright selectors matched no runnable tests: "
            + ", ".join(unmatched_selectors)
        )
    units = [unit for unit in discovered_units if selected_projects(unit, selection)]
    units = include_project_dependencies(units, discovered_units)
    if not units:
        raise SystemExit("Playwright selection produced no runnable test units")

    for unit in units:
        unit.weight_ms = sum(
            test_weights.get(
                test_id,
                identity_weights.get(
                    (unit.file, unit.test_names[test_id]), FALLBACK_TEST_MS
                ),
            )
            for test_id in unit.test_ids
        )
        if unit.weight_ms == 0:
            unit.weight_ms = FALLBACK_TEST_MS

    oversized_units = [unit for unit in units if unit.weight_ms > TARGET_MS]
    if oversized_units:
        details = ", ".join(
            f"{unit.key} ({unit.weight_ms / 60_000:.1f}m)"
            for unit in sorted(
                oversized_units, key=lambda item: item.weight_ms, reverse=True
            )
        )
        raise SystemExit(
            "Atomic Playwright units exceed the 20-minute execution budget; "
            f"refactor or explicitly audit them for parallel splitting: {details}"
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
