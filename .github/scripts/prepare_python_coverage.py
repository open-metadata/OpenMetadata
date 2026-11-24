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

"""Combine downloaded Python coverage and stage JUnit reports for Sonar."""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def prepare_reports(coverage_dir: Path, results_dir: Path, project_dir: Path) -> None:
    coverage_files = sorted(path for path in coverage_dir.rglob(".coverage*") if path.is_file())
    if not coverage_files:
        raise SystemExit("No Python coverage artifacts were downloaded")

    for index, path in enumerate(coverage_files):
        shutil.copyfile(path, project_dir / f".coverage.download-{index}")

    junit_dir = project_dir / "junit"
    junit_dir.mkdir(exist_ok=True)
    for index, path in enumerate(sorted(results_dir.rglob("test-results*.xml"))):
        shutil.copyfile(path, junit_dir / f"test-results-{index}.xml")

    subprocess.run(
        [sys.executable, "-m", "coverage", "combine", "--rcfile=pyproject.toml", "--keep"],
        cwd=project_dir,
        check=True,
    )
    subprocess.run(
        [sys.executable, "-m", "coverage", "xml", "--rcfile=pyproject.toml"],
        cwd=project_dir,
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--coverage-dir", type=Path, default=Path("artifacts"))
    parser.add_argument("--results-dir", type=Path, default=Path("test-artifacts"))
    parser.add_argument("--project-dir", type=Path, default=Path("ingestion"))
    args = parser.parse_args()
    prepare_reports(args.coverage_dir, args.results_dir, args.project_dir)


if __name__ == "__main__":
    main()
