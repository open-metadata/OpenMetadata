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

"""Read Python CI inputs and verify the job results declared by the caller."""

import argparse
import json
import os
import sys
from pathlib import Path

from prepare_classification_models import python_matrix


def versions(project: Path) -> dict:
    """Read supported interpreters and their numeric boundaries."""
    matrix = python_matrix(project)
    supported = matrix["python-versions"]
    return {
        "versions": supported,
        "lowest": min(supported, key=lambda v: tuple(map(int, v.split(".")))),
        "highest": matrix["discovery-python"],
    }


def connectors(defaults: str, selected: str) -> dict:
    """Validate a distinct subset of the caller's connector list."""
    available = json.loads(defaults)
    chosen = json.loads(selected) if selected else available
    for names in (available, chosen):
        if (
            not isinstance(names, list)
            or not names
            or any(not isinstance(name, str) or not name for name in names)
            or len(names) != len(set(names))
        ):
            raise ValueError("Connectors must be a nonempty list of distinct names")
    if not set(chosen).issubset(available):
        raise ValueError("Selected connectors must be a subset of the default list")
    return {"connectors": chosen}


def verify(needs: dict, expected: dict) -> None:
    """Require exactly the job results declared by the caller."""
    if not expected or set(needs) != set(expected):
        raise ValueError("Expected results must cover every dependency exactly")
    for job, wanted in expected.items():
        if wanted not in ("success", "skipped"):
            raise ValueError(f"Invalid expected result for {job}: {wanted}")
        result = needs[job].get("result")
        if result != wanted:
            raise ValueError(f"Expected {job}={wanted}, received {result}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    interpreters = commands.add_parser("versions")
    interpreters.add_argument("--project", type=Path, default=Path("ingestion"))
    interpreters.add_argument("--output", type=Path)
    selection = commands.add_parser("connectors")
    selection.add_argument("--output", type=Path)
    commands.add_parser("verify")
    args = parser.parse_args()
    try:
        if args.command == "verify":
            verify(json.loads(os.environ["NEEDS_JSON"]), json.loads(os.environ["EXPECTED_RESULTS"]))
            return
        selected = (
            versions(args.project)
            if args.command == "versions"
            else connectors(os.environ["DEFAULT_CONNECTORS"], os.environ.get("SELECTED_CONNECTORS", ""))
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
