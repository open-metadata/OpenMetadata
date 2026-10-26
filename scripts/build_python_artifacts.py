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

"""Build, hash, and clean-install the Python release artifacts."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from python_environment import uv_version

ROOT = Path(__file__).resolve().parents[1]
BUILD_CONSTRAINTS = ROOT / "ingestion/build-constraints.txt"


def run(command, **kwargs):
    """Run a bounded command and preserve failures."""
    return subprocess.run(command, check=True, timeout=3600, **kwargs)


def uv():
    executable = shutil.which("uv")
    if (
        not executable
        or run([executable, "--version"], capture_output=True, text=True).stdout.split()[1] != uv_version()
    ):
        raise ValueError("Prepare a repository Python profile to install its pinned uv first")
    return executable


def hashes(directory):
    """Return hashes for exactly the two projects' wheel and sdist pairs."""
    files = sorted([*directory.glob("*.whl"), *directory.glob("*.tar.gz")])
    if len(files) != 4 or sum(path.suffix == ".whl" for path in files) != 2:
        raise ValueError("Expected exactly two wheels and two source distributions")
    return {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in files}


def verify_hashes(directory):
    """Reject changed, missing, or additional release artifacts."""
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest["sha256"] != hashes(directory):
        raise ValueError("Release artifact checksums differ from the build manifest")
    if (
        manifest["build-constraints-sha256"]
        != hashlib.sha256((directory / "build-constraints.txt").read_bytes()).hexdigest()
    ):
        raise ValueError("Build constraints differ from the build manifest")
    return manifest


def ignore_build_files(directory, names):
    """Exclude environment/build state and project-root test suites."""
    ignored = set(
        shutil.ignore_patterns(
            "env", ".venv", ".nox", ".git", "__pycache__", "*.egg-info", "build", "dist", ".pytest_cache", ".ruff_cache"
        )(directory, names)
    )
    if Path(directory) in (ROOT / "ingestion", ROOT / "openmetadata-airflow-apis"):
        ignored.add("tests")
    return ignored


def build(directory, expected_version):
    """Generate Python models and build wheel-from-sdist for both projects."""
    if directory.exists() and any(directory.iterdir()):
        raise ValueError("Build output directory must be empty")
    directory.mkdir(parents=True, exist_ok=True)
    executable = uv()
    run(
        [
            sys.executable,
            str(ROOT / "scripts/python_environment.py"),
            "--profile",
            "generation",
            "--",
            "python",
            str(ROOT / "scripts/generate_ingestion_models.py"),
            "--python-only",
        ],
        cwd=ROOT,
    )
    run([executable, "lock", "--check", "--project", str(ROOT / "ingestion")], cwd=ROOT)
    with tempfile.TemporaryDirectory(prefix="om-package-build-") as temporary:
        staging = Path(temporary)
        for name in ("ingestion", "openmetadata-airflow-apis"):
            source = staging / name
            shutil.copytree(ROOT / name, source, ignore=ignore_build_files)
            run(
                [
                    executable,
                    "build",
                    str(source),
                    "--no-sources",
                    "--build-constraint",
                    str(BUILD_CONSTRAINTS),
                    "--require-hashes",
                    "--out-dir",
                    str(directory),
                ],
                cwd=staging,
            )
    versions = {path.name.split("-")[1] for path in directory.glob("*.whl")}
    if len(versions) != 1 or (expected_version and versions != {expected_version}):
        raise ValueError(f"Artifact version mismatch: {sorted(versions)}; expected {expected_version}")
    manifest = {
        "version": versions.pop(),
        "uv": uv_version(),
        "sha256": hashes(directory),
        "build-constraints-sha256": hashlib.sha256(BUILD_CONSTRAINTS.read_bytes()).hexdigest(),
    }
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (directory / "SHA256SUMS").write_text("".join(f"{digest}  {name}\n" for name, digest in manifest["sha256"].items()))
    shutil.copyfile(BUILD_CONSTRAINTS, directory / "build-constraints.txt")


def validate(directory):
    """Install each artifact pair into fresh environments away from the checkout."""
    manifest = verify_hashes(directory)
    executable = uv()
    with tempfile.TemporaryDirectory(prefix="om-package-validation-") as temporary:
        staging = Path(temporary)
        constraints = staging / "runtime-constraints.txt"
        with constraints.open("w") as output:
            run(
                [
                    executable,
                    "export",
                    "--locked",
                    "--project",
                    str(ROOT / "ingestion"),
                    "--group",
                    "api",
                    "--no-emit-local",
                    "--no-hashes",
                    "--no-annotate",
                    "--no-header",
                ],
                stdout=output,
                cwd=ROOT,
            )
        environment = {
            key: value
            for key, value in os.environ.items()
            if key not in {"PYTHONPATH", "VIRTUAL_ENV", "UV_PROJECT_ENVIRONMENT", "OM_PYTHON_SYNCED"}
            and not key.startswith("AIRFLOW_")
        }
        environment["AIRFLOW_HOME"] = str(staging / "airflow")
        environment["AIRFLOW__CORE__LOAD_EXAMPLES"] = "False"
        for label, pattern in (("wheel", "*.whl"), ("sdist", "*.tar.gz")):
            venv = staging / label
            run([executable, "venv", "--python", sys.executable, str(venv)], cwd=staging, env=environment)
            python = str(venv / "bin/python")
            run(
                [
                    executable,
                    "pip",
                    "install",
                    "--python",
                    python,
                    "--constraint",
                    str(constraints),
                    "--build-constraint",
                    str(directory / "build-constraints.txt"),
                    *[str(path) for path in sorted(directory.glob(pattern))],
                ],
                cwd=staging,
                env=environment,
            )
            run(
                [
                    python,
                    "-I",
                    str(ROOT / "scripts/python_artifact_smoke.py"),
                    "--version",
                    manifest["version"],
                    "--managed-api",
                    "--output",
                    str(directory / (label + "-validation.json")),
                ],
                cwd=staging,
                env=environment,
            )
            run([str(venv / "bin/metadata"), "--help"], cwd=staging, env=environment)
            run([executable, "pip", "check", "--python", python], cwd=staging, env=environment)
    verify_hashes(directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["build", "validate", "check"])
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--expected-version")
    args = parser.parse_args()
    directory = args.output_dir.resolve()
    if (
        args.command != "build"
        and args.expected_version
        and verify_hashes(directory)["version"] != args.expected_version
    ):
        raise ValueError(f"Artifact version differs from expected {args.expected_version}")
    if args.command == "build":
        build(directory, args.expected_version)
    elif args.command == "validate":
        validate(directory)
    else:
        verify_hashes(directory)


if __name__ == "__main__":
    main()
