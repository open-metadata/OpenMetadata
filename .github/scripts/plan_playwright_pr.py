#!/usr/bin/env python3
"""Route every added or modified Playwright spec to its PR environment."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

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
    args = parser.parse_args()
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
    plan = {
        "routes": routes,
        "changedSpecs": sorted(spec for specs in routes.values() for spec in specs),
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
