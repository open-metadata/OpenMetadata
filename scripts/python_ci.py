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

"""Read Python CI interpreter and connector selections."""

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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    interpreters = commands.add_parser("versions")
    interpreters.add_argument("--project", type=Path, default=Path("ingestion"))
    version_format = interpreters.add_mutually_exclusive_group()
    version_format.add_argument("--output", type=Path)
    version_format.add_argument(
        "--csv", action="store_true", help="Print the supported versions as a comma-separated list."
    )
    selection = commands.add_parser("connectors")
    selection.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        selected = (
            versions(args.project)
            if args.command == "versions"
            else connectors(os.environ["DEFAULT_CONNECTORS"], os.environ.get("SELECTED_CONNECTORS", ""))
        )
        if args.command == "versions" and args.csv:
            sys.stdout.write(",".join(selected["versions"]) + "\n")
        elif args.output:
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
