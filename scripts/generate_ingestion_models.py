#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Generate ingestion models and parsers, then record their freshness manifest."""

from __future__ import annotations

import argparse
import glob
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED_ROOT = ROOT / "ingestion/src/metadata/generated"
ANTLR_GRAMMAR = ROOT / "openmetadata-spec/src/main/antlr4/org/openmetadata/schema"
JS_GENERATED_ROOT = ROOT / "openmetadata-ui/src/main/resources/ui/src/generated/antlr"


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate ingestion models and ANTLR parsers."
    )
    parser.add_argument(
        "--python-only",
        action="store_true",
        help="Skip generating the UI JavaScript ANTLR parser.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print("Running Datamodel Code Generator")
    print("Make sure the dev dependency group is installed first")

    shutil.rmtree(GENERATED_ROOT, ignore_errors=True)
    GENERATED_ROOT.mkdir(parents=True)

    run([sys.executable, "scripts/datamodel_generation.py"])

    grammar_files = sorted(glob.glob(str(ANTLR_GRAMMAR / "*.g4")))
    run(
        [
            "antlr4",
            "-Dlanguage=Python3",
            "-o",
            str(GENERATED_ROOT / "antlr"),
            *grammar_files,
        ]
    )
    if not args.python_only:
        run(
            [
                "antlr4",
                "-Dlanguage=JavaScript",
                "-o",
                str(JS_GENERATED_ROOT),
                *grammar_files,
            ]
        )

    run([sys.executable, "scripts/check_generated_models.py", "--write"])


if __name__ == "__main__":
    main()
