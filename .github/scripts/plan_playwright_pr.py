#!/usr/bin/env python3
"""Route every added or modified Playwright spec to its PR environment."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

from playwright_test_requirements import collect_requirements, requirements

UI_ROOT = "openmetadata-ui/src/main/resources/ui/"
LANES = ("normal", "auth", "rdf", "visual", "http2", "nightly", "helpers")


def route_spec(spec: str) -> str:
    for directory, lane in (
        ("Auth", "auth"),
        ("VisualRegression", "visual"),
        ("Http2", "http2"),
        ("nightly", "nightly"),
    ):
        if spec.startswith(f"playwright/e2e/{directory}/"):
            return lane
    name = Path(spec).name
    if name == "KnowledgeGraph.spec.ts" or (
        name.startswith("Ontology") and name.endswith("Rdf.spec.ts")
    ):
        return "rdf"
    if spec.startswith("playwright/e2e/"):
        return "normal"
    if spec.startswith(("playwright/helper-tests/", "playwright/browser-tests/")):
        return "helpers"
    raise ValueError(f"No PR environment is configured for {spec}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--changed-files", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--collect", action="store_true")
    parser.add_argument("--collection-report", type=Path, action="append")
    parser.add_argument(
        "--event-name", choices=("pull_request", "merge_group"), default="pull_request"
    )
    parser.add_argument("--queue-selection", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    routes: dict[str, list[str]] = {lane: [] for lane in LANES}
    for path in sorted(set(args.changed_files.read_text().splitlines())):
        if not path.startswith(f"{UI_ROOT}playwright/") or not path.endswith(
            (".spec.ts", ".test.ts")
        ):
            continue
        if not Path(path).is_file():
            continue
        spec = path.removeprefix(UI_ROOT)
        try:
            routes[route_spec(spec)].append(spec)
        except ValueError as error:
            raise SystemExit(str(error)) from error
    changed_specs = sorted(spec for specs in routes.values() for spec in specs)
    direct_specs = set(changed_specs)
    selection = None
    if args.event_name == "merge_group":
        selection_file = args.queue_selection or args.output.with_suffix(
            ".selection.json"
        )
        if not args.queue_selection:
            subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).with_name("select_playwright_tests.py")),
                    "--event-name",
                    "merge_group",
                    "--changed-files",
                    str(args.changed_files),
                    "--impact-map",
                    ".github/playwright/impact-map.json",
                    "--include-delegated",
                    "--output",
                    str(selection_file),
                ],
                check=True,
            )
        selection = json.loads(selection_file.read_text())
        all_specs = sorted(
            str(path.relative_to(Path(UI_ROOT)))
            for path in Path(UI_ROOT, "playwright/e2e").rglob("*.spec.ts")
        )
        changed_specs = (
            all_specs
            if selection["mode"] == "full"
            else [
                spec
                for spec in all_specs
                if any(
                    fnmatch.fnmatchcase(spec, entry["spec"])
                    for entry in selection["selectors"]
                )
            ]
        )
        routes = {lane: [] for lane in LANES}
    deferred = []
    if args.collect or args.collection_report:
        reports = (
            [json.loads(path.read_text()) for path in args.collection_report]
            if args.collection_report
            else collect_requirements(changed_specs, Path.cwd())
        )
        public, secret = requirements(reports)
        missing = set(changed_specs) - public - secret
        if args.event_name == "merge_group":
            missing &= direct_specs
        if missing:
            raise SystemExit(
                "Changed specs have no collected tests: " + ", ".join(sorted(missing))
            )
        deferred = sorted(set(changed_specs) & secret)
        for lane in routes:
            routes[lane] = [spec for spec in routes[lane] if spec in public]
        if args.event_name == "merge_group":
            for spec in deferred:
                lane = route_spec(spec)
                if lane not in {"normal", "http2", "nightly", "auth"}:
                    raise SystemExit(
                        f"No credential-enabled queue runner is configured for {spec}"
                    )
                routes[lane].append(spec)
    plan = {
        "routes": routes,
        "changedSpecs": sorted(spec for specs in routes.values() for spec in specs),
        "deferredSpecs": deferred,
        "selectionMode": selection["mode"] if selection else "changed-specs",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, indent=2) + "\n")
    if args.github_output:
        with args.github_output.open("a") as output:
            for lane, specs in routes.items():
                if lane == "normal":
                    specs = sorted(specs + routes["http2"] + routes["nightly"])
                output.write(f"{lane}={json.dumps(specs, separators=(',', ':'))}\n")
                output.write(f"{lane}_count={len(specs)}\n")
            output.write(f"changed_specs={json.dumps(plan['changedSpecs'])}\n")
            output.write(f"spec_count={len(plan['changedSpecs'])}\n")
            output.write(f"deferred_specs={json.dumps(deferred)}\n")
            special = {
                "include": [
                    {"lane": lane, "specs": routes[lane]}
                    for lane in ("helpers",)
                    if routes[lane]
                ]
            }
            output.write(f"special_matrix={json.dumps(special)}\n")
            output.write(f"special_count={len(special['include'])}\n")


if __name__ == "__main__":
    main()
