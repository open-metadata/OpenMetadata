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

"""Resolve and validate a dependency-update candidate before optional lock acceptance."""

import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
from contextlib import suppress
from pathlib import Path

from python_environment import uv_version

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

ROOT = Path(__file__).resolve().parents[1]
COMPONENTS = ("ingestion", "openmetadata-airflow-apis", "openmetadata-spec", "scripts", ".github", "Makefile")
IGNORED = shutil.ignore_patterns(
    ".git",
    "env",
    ".venv",
    ".nox",
    "node_modules",
    "target",
    "__pycache__",
    "*.pyc",
    "*.egg-info",
    ".coverage*",
    "junit",
    ".ruff_cache",
    ".pytest_cache",
    "ci-coverage.xml",
    "coverage.xml",
)


def digest(path):
    """Return a file's SHA256 identity."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def packages(path):
    """Read package versions from a uv lock."""
    data = tomllib.loads(path.read_text())
    return {(p["name"], p["version"]) for p in data["package"]}


def stage(output):
    """Copy Python sources and tooling without environments or build artifacts."""
    candidate = output / "candidate"
    candidate.mkdir()
    inputs = {}
    for name in COMPONENTS:
        source = ROOT / name
        destination = candidate / name
        if source.is_dir():
            shutil.copytree(source, destination, ignore=IGNORED)
            for path in destination.rglob("*"):
                if path.is_file():
                    relative = path.relative_to(candidate)
                    inputs[str(relative)] = digest(path)
        elif source.is_file():
            shutil.copy2(source, destination)
            inputs[name] = digest(source)
    return candidate, inputs


def execute(command, cwd, environment, output, phase, timeout):
    """Run a bounded candidate operation and retain its complete output."""
    log_path = output / (phase + ".log")
    with log_path.open("w") as stream:
        process = subprocess.Popen(
            command, cwd=cwd, env=environment, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True
        )
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            with suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise
    if code:
        sys.stderr.write(log_path.read_text()[-65536:])
        raise subprocess.CalledProcessError(code, command)


def refresh(args, command):
    """Resolve, validate and optionally accept one isolated lock candidate."""
    output = args.output_dir.expanduser().resolve()
    if output.is_relative_to(ROOT) or ROOT.is_relative_to(output):
        raise ValueError("output-dir must be outside the checkout")
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError("output-dir must be empty")
    accepted = ROOT / "ingestion/uv.lock"
    before = digest(accepted)
    shutil.copy2(accepted, output / "accepted.uv.lock")
    report = {
        "accepted_before": before,
        "accepted": False,
        "packages": args.package,
        "all": args.all,
        "validation_command": command,
        "phase": "staging",
        "exit": 1,
    }
    try:
        uv = shutil.which("uv")
        if not uv or subprocess.check_output([uv, "--version"], text=True).split()[1] != uv_version():
            raise ValueError("Run repository environment setup to install the pinned uv first")
        candidate, inputs = stage(output)
        environment = dict(
            os.environ,
            OM_PYTHON_ENVIRONMENT=str(output / "environment"),
            UV_PROJECT_ENVIRONMENT=str(output / "environment"),
            AIRFLOW_HOME=str(output / "airflow"),
            PYTHONDONTWRITEBYTECODE="1",
            PYTHONPATH=os.pathsep.join((str(candidate / "ingestion/src"), str(candidate))),
        )
        for name in (
            "VIRTUAL_ENV",
            "OM_PYTHON_SYNCED",
            "OM_GENERATION_PREPARED",
            "COVERAGE_FILE",
            "COVERAGE_PROCESS_START",
        ):
            environment.pop(name, None)
        lock_command = [uv, "lock", "--project", str(candidate / "ingestion"), "--python", sys.executable]
        if args.all:
            lock_command.append("--upgrade")
        for package in args.package:
            lock_command.extend(["--upgrade-package", package])
        report["resolve_command"] = lock_command
        report["phase"] = "resolution"
        execute(lock_command, candidate, environment, output, "resolution", args.timeout)
        candidate_lock = candidate / "ingestion/uv.lock"
        shutil.copy2(candidate_lock, output / "candidate.uv.lock")
        report["candidate_sha256"] = digest(candidate_lock)
        previous, current = packages(output / "accepted.uv.lock"), packages(candidate_lock)
        report["added"] = sorted(current - previous)
        report["removed"] = sorted(previous - current)
        execute(
            [uv, "lock", "--check", "--project", str(candidate / "ingestion")],
            candidate,
            environment,
            output,
            "lock-check",
            args.timeout,
        )
        report["phase"] = "validation"
        execute(command, candidate, environment, output, "validation", args.timeout)
        if digest(candidate_lock) != report["candidate_sha256"]:
            raise ValueError("Validation changed the candidate lock; refusing acceptance")
        modified = [
            name
            for name, identity in inputs.items()
            if name != "ingestion/uv.lock"
            and not name.startswith("ingestion/src/metadata/generated/")
            and (not (candidate / name).is_file() or digest(candidate / name) != identity)
        ]
        if modified:
            raise ValueError("Validation changed candidate sources: " + ", ".join(modified[:10]))
        if args.accept:
            report["phase"] = "acceptance"
            if digest(accepted) != before:
                raise ValueError("Accepted lock changed during validation; refusing acceptance")
            changed = [
                name
                for name, identity in inputs.items()
                if not (ROOT / name).is_file() or digest(ROOT / name) != identity
            ]
            if changed:
                raise ValueError("Checkout changed during validation; refusing acceptance: " + ", ".join(changed[:10]))
            with tempfile.NamedTemporaryFile(dir=accepted.parent, prefix=".uv.lock.", delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(candidate_lock.read_bytes())
            try:
                shutil.copymode(accepted, temporary)
                temporary.replace(accepted)
            finally:
                temporary.unlink(missing_ok=True)
            report["accepted"] = True
        report.update(phase="complete", exit=0)
    except subprocess.CalledProcessError as error:
        report["exit"] = error.returncode
        raise
    finally:
        report["accepted_after"] = digest(accepted)
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        sys.stdout.write(json.dumps(report) + "\n")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--all", action="store_true", help="Refresh every package allowed by the manifests")
    selection.add_argument(
        "--package", action="append", default=[], help="Refresh one package; repeat for coupled dependencies"
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--accept", action="store_true", help="Replace only the lock after successful validation")
    parser.add_argument("--timeout", type=int, default=3600, help="Deadline in seconds for each candidate operation")
    parser.add_argument(
        "command", nargs=argparse.REMAINDER, help="Validation command following --, run in the candidate checkout"
    )
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command or args.timeout <= 0:
        parser.error("a validation command and positive timeout are required")
    if command[0] in ("python", "python3"):
        command[0] = sys.executable
    return refresh(args, command)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, subprocess.SubprocessError) as error:
        sys.stderr.write(str(error) + "\n")
        raise SystemExit(error.returncode if isinstance(error, subprocess.CalledProcessError) else 1) from error
