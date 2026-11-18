#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Select Python CI workloads and verify their aggregate job results."""

import argparse
import json
import os
import sys
from pathlib import Path

from prepare_classification_models import test_matrix

DEFAULT_CONNECTORS = (
    "bigquery",
    "dbt_redshift",
    "metabase",
    "mssql",
    "mysql",
    "redash",
    "snowflake",
    "tableau",
    "redshift",
    "quicksight",
    "datalake_s3",
    "postgres",
    "oracle",
    "athena",
    "bigquery_multiple_project",
    "exasol",
    "powerbi",
)
EVENTS = {"pr": "pull_request", "merge-queue": "merge_group", "nightly": "schedule"}


def plan(
    project: Path,
    flow: str,
    python_changed: bool,
    static_changed: bool,
    connectors: str,
) -> dict:
    """Resolve the selected workload and interpreter matrix."""
    selection = test_matrix(project, EVENTS[flow])
    selected = list(DEFAULT_CONNECTORS) if not connectors else json.loads(connectors)
    if (
        not isinstance(selected, list)
        or not selected
        or any(not isinstance(name, str) or name not in DEFAULT_CONNECTORS for name in selected)
        or len(selected) != len(set(selected))
    ):
        raise ValueError("Connectors must be a nonempty, distinct subset of the nightly connector list")
    return {
        **selection,
        "python": python_changed,
        "static": python_changed or static_changed,
        "connectors": selected if flow == "nightly" else [],
    }


def verify(flow: str, needs: dict) -> None:
    """Require successful selected work and explicit skips for unselected work."""
    if needs.get("plan", {}).get("result") != "success":
        raise ValueError("Python workload selection did not succeed")
    outputs = needs["plan"]["outputs"]
    if outputs.get("python") not in ("true", "false") or outputs.get("static") not in (
        "true",
        "false",
    ):
        raise ValueError("Python workload selection produced invalid outputs")
    selected = outputs["python"] == "true"
    expected = {"models": selected, "unit": selected}
    if flow != "pr":
        expected.update(backend=selected, integration=selected)
    if flow == "nightly":
        expected["cli-e2e"] = selected
    expected["py-checkstyle"] = True
    for job, required in expected.items():
        result = needs.get(job, {}).get("result")
        wanted = "success" if required else "skipped"
        if result != wanted:
            raise ValueError(f"Expected {job}={wanted}, received {result}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    planning = commands.add_parser("plan")
    planning.add_argument("--flow", choices=EVENTS, required=True)
    planning.add_argument("--project", type=Path, default=Path("ingestion"))
    planning.add_argument("--python-changed", choices=("true", "false"), required=True)
    planning.add_argument("--static-changed", choices=("true", "false"), required=True)
    planning.add_argument("--connectors", default="")
    planning.add_argument("--output", type=Path)
    verification = commands.add_parser("verify")
    verification.add_argument("--flow", choices=EVENTS, required=True)
    args = parser.parse_args()
    try:
        if args.command == "verify":
            verify(args.flow, json.loads(os.environ["NEEDS_JSON"]))
        else:
            selected = plan(
                args.project,
                args.flow,
                args.python_changed == "true",
                args.static_changed == "true",
                args.connectors,
            )
            if args.output:
                with args.output.open("a") as stream:
                    for key, value in selected.items():
                        rendered = value if isinstance(value, str) else json.dumps(value, separators=(",", ":"))
                        stream.write(f"{key}={rendered}\n")
            else:
                sys.stdout.write(json.dumps(selected) + "\n")
    except (ValueError, KeyError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
