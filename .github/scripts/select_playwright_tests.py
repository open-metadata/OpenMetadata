#!/usr/bin/env python3
"""Select Playwright coverage for a pull request or a full-suite event."""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
from pathlib import Path
from typing import Any


UI_ROOT = "openmetadata-ui/src/main/resources/ui/"
RUNNABLE_SPEC_PREFIX = f"{UI_ROOT}playwright/e2e/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event-name", required=True)
    parser.add_argument("--changed-files", type=Path)
    parser.add_argument("--impact-map", type=Path, required=True)
    parser.add_argument("--full-suite", choices=("true", "false"), default="false")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--github-output", type=Path)
    return parser.parse_args()


def matches(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def add_selection(
    selected: dict[str, set[str]], entry: dict[str, Any], repo_root: Path
) -> None:
    projects = set(entry.get("projects", ["auto"]))
    for pattern in entry.get("specs", []):
        absolute_pattern = repo_root / UI_ROOT / pattern
        matches_for_pattern = sorted(
            repo_root.glob(str(absolute_pattern.relative_to(repo_root)))
        )
        if matches_for_pattern:
            specs = [
                str(path.relative_to(repo_root / UI_ROOT))
                for path in matches_for_pattern
            ]
        else:
            specs = [pattern]
        for spec in specs:
            selected.setdefault(spec, set()).update(projects)


def is_mapped_file(path: str, impact_map: dict[str, Any]) -> bool:
    return (
        matches(path, impact_map["sharedInfrastructure"])
        or (path.startswith(RUNNABLE_SPEC_PREFIX) and path.endswith(".spec.ts"))
        or any(matches(path, mapping["sources"]) for mapping in impact_map["mappings"])
    )


def write_github_output(path: Path, plan: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as output:
        output.write(f"mode={plan['mode']}\n")
        output.write(f"selection={json.dumps(plan, separators=(',', ':'))}\n")
        output.write(f"selected_count={len(plan['selectors'])}\n")


def main() -> None:
    args = parse_args()
    repo_root = Path.cwd()
    impact_map = json.loads(args.impact_map.read_text(encoding="utf-8"))
    full_event = args.event_name in {"merge_group", "schedule"}
    full_requested = (
        args.event_name == "workflow_dispatch" and args.full_suite == "true"
    )

    if full_event or full_requested:
        plan = {
            "version": 1,
            "mode": "full",
            "reason": f"{args.event_name} requires the complete suite",
            "selectors": [],
        }
    else:
        changed_files = []
        if args.changed_files and args.changed_files.exists():
            changed_files = [
                line.strip()
                for line in args.changed_files.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]

        selected: dict[str, set[str]] = {}
        for entry in impact_map["smoke"]:
            add_selection(selected, entry, repo_root)

        shared_infrastructure_changed = any(
            matches(path, impact_map["sharedInfrastructure"]) for path in changed_files
        )
        if shared_infrastructure_changed:
            for entry in impact_map["canary"]:
                add_selection(selected, entry, repo_root)

        delegated_changed_specs: list[str] = []
        deleted_changed_specs: list[str] = []
        unmapped_files: list[str] = []
        for changed_file in changed_files:
            file_mapped = is_mapped_file(changed_file, impact_map)
            if changed_file.startswith(RUNNABLE_SPEC_PREFIX) and changed_file.endswith(
                ".spec.ts"
            ):
                relative_spec = changed_file.removeprefix(UI_ROOT)
                if not (repo_root / changed_file).is_file():
                    deleted_changed_specs.append(relative_spec)
                elif matches(relative_spec, impact_map.get("delegatedSpecs", [])):
                    delegated_changed_specs.append(relative_spec)
                else:
                    selected.setdefault(relative_spec, set()).add("auto")
                file_mapped = True
            for mapping in impact_map["mappings"]:
                if matches(changed_file, mapping["sources"]):
                    add_selection(selected, mapping, repo_root)
                    file_mapped = True
            if not file_mapped:
                unmapped_files.append(changed_file)

        unmapped_change = bool(unmapped_files)
        if unmapped_change:
            for entry in impact_map["canary"]:
                add_selection(selected, entry, repo_root)

        plan = {
            "version": 1,
            "mode": "targeted",
            "reason": "pull requests run smoke, changed specs, and impact-mapped coverage",
            "sharedInfrastructureChanged": shared_infrastructure_changed,
            "unmappedChange": unmapped_change,
            "unmappedFiles": unmapped_files,
            "delegatedChangedSpecs": sorted(delegated_changed_specs),
            "deletedChangedSpecs": sorted(deleted_changed_specs),
            "changedFiles": changed_files,
            "selectors": [
                {"spec": spec, "projects": sorted(projects)}
                for spec, projects in sorted(selected.items())
            ],
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    github_output = args.github_output or (
        Path(os.environ["GITHUB_OUTPUT"]) if os.environ.get("GITHUB_OUTPUT") else None
    )
    if github_output:
        write_github_output(github_output, plan)


if __name__ == "__main__":
    main()
