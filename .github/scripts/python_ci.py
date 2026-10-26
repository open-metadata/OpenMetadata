"""Prepare locked CI environments, require coverage inputs and retain startup attempts."""

import argparse
import hashlib
import importlib.util
import json
import os
import platform
import re
import signal
import subprocess
import sys
import time
from contextlib import suppress
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("python_environment", ROOT / "scripts/python_environment.py")
ENVIRONMENT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ENVIRONMENT)


def metadata(profile, output):
    """Write the interpreter, profile and dependency identity for cache actions."""
    paths = [
        "ingestion/uv.lock",
        "ingestion/pyproject.toml",
        "ingestion/setup.py",
        "openmetadata-airflow-apis/pyproject.toml",
        "scripts/python_environment.py",
        ".github/scripts/python_ci.py",
        ".github/actions/setup-python-environment/action.yml",
        "ingestion/src/metadata/pii/model_registry.py",
        "ingestion/src/metadata/pii/model_provisioning.py",
    ]
    data = {
        "profile": profile,
        "python": sys.version,
        "base": str(Path(sys.base_prefix).resolve()),
        "os": platform.system(),
        "arch": platform.machine(),
        "inputs": {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in paths},
    }
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    values = {
        "cache-key": f"om-python-v1-{data['os']}-{data['arch']}-{platform.python_version()}-{profile}-{digest}",
        "environment": str(ENVIRONMENT.default_environment(profile)),
        "uv-version": ENVIRONMENT.uv_version(),
    }
    if output:
        with output.open("a") as stream:
            stream.writelines(f"{key}={value}\n" for key, value in values.items())
    sys.stdout.write(json.dumps({**values, "identity": data}, sort_keys=True) + "\n")


def sync(profile):
    """Synchronize the profile and repair the known Airflow cache-file collision."""
    path = ENVIRONMENT.default_environment(profile)
    probe_code = "import airflow; from airflow.models import Connection"
    reinstall = ()
    if profile in ("test", "api") and (path / "bin/python").exists():
        restored = subprocess.run([str(path / "bin/python"), "-I", "-c", probe_code], cwd=ROOT, check=False)
        if restored.returncode:
            reinstall = ("apache-airflow-core",)
    python, environment = ENVIRONMENT.sync(profile, path, sys.executable, reinstall_packages=reinstall)
    if profile not in ("test", "api"):
        return
    probe = [str(python), "-I", "-c", probe_code]
    result = subprocess.run(probe, cwd=ROOT, env=environment, check=False)
    if result.returncode:
        ENVIRONMENT.sync(profile, path, sys.executable, reinstall_packages=("apache-airflow-core",))
        subprocess.run(probe, cwd=ROOT, env=environment, check=True)


def combine_coverage(artifact_dir, output_dir, shards, cli_suites=None):
    """Require and combine every expected nonempty coverage artifact."""
    from coverage import CoverageData

    names = ["coverage-unit", *(f"coverage-integration-{name}" for name in shards)]
    if cli_suites is not None:
        names = [f"coverage-{name}" for name in cli_suites]
    sources = []
    for name in names:
        filename = f".coverage.{name.removeprefix('coverage-')}" if cli_suites is not None else ".coverage"
        candidates = [artifact_dir / name / filename]
        if len(names) == 1 and cli_suites is None:
            candidates.append(artifact_dir / ".coverage")
        present = [p for p in candidates if p.is_file()]
        if len(present) != 1:
            raise ValueError(f"Expected exactly one {name}/.coverage artifact; found {len(present)}")
        data = CoverageData(basename=str(present[0]))
        data.read()
        if not data.measured_files():
            raise ValueError(f"Coverage artifact has no measured files: {name}")
        sources.append(str(present[0].resolve()))
    output_dir.mkdir(parents=True, exist_ok=True)
    command = [sys.executable, "-m", "coverage"]
    subprocess.run([*command, "combine", "--keep", *sources], cwd=output_dir, check=True)
    config = str(ROOT / "ingestion/pyproject.toml")
    subprocess.run([*command, "report", "--rcfile", config], cwd=output_dir, check=True)
    subprocess.run([*command, "xml", "--rcfile", config, "-o", "ci-coverage.xml"], cwd=output_dir, check=True)
    sys.stdout.write(
        json.dumps({"expected": names, "combined": len(sources), "output": str(output_dir / "ci-coverage.xml")}) + "\n"
    )


def startup(command, output_dir, timeout, attempts):
    """Run bounded startup attempts, preserving each attempt's log and status."""
    output_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for attempt in range(1, attempts + 1):
        log_path = output_dir / f"startup-attempt-{attempt}.log"
        started = time.monotonic()
        with log_path.open("wb") as log:
            process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            timed_out = False
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                code = 124
        records.append(
            {
                "attempt": attempt,
                "exit": code,
                "timed_out": timed_out,
                "seconds": time.monotonic() - started,
                "log": str(log_path),
            }
        )
        (output_dir / "startup-outcomes.json").write_text(json.dumps(records, indent=2) + "\n")
        if code and os.environ.get("GITHUB_ACTIONS") == "true":
            collect_service_logs(output_dir / f"startup-attempt-{attempt}-services.log")
        with log_path.open("rb") as log:
            log.seek(max(0, log_path.stat().st_size - 65536))
            sys.stdout.write(log.read().decode(errors="replace") + "\n")
        sys.stdout.write(json.dumps(records[-1]) + "\n")
        sys.stdout.flush()
        if code == 0:
            return 0
    return code


def collect_service_logs(path):
    """Capture this startup project's containers before another attempt."""
    project = os.environ.get("COMPOSE_PROJECT_NAME", "development")
    deadline = time.monotonic() + 60
    with path.open("wb") as log:
        try:
            result = subprocess.run(
                [
                    "docker",
                    "ps",
                    "--all",
                    "--filter",
                    f"label=com.docker.compose.project={project}",
                    "--format",
                    "{{.ID}}",
                ],
                capture_output=True,
                timeout=20,
                check=True,
            )
            for container in result.stdout.decode().splitlines()[:50]:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                if re.fullmatch(r"[0-9a-f]{12,64}", container):
                    subprocess.run(
                        ["docker", "logs", "--tail", "200", container],
                        stdout=log,
                        stderr=subprocess.STDOUT,
                        timeout=min(20, remaining),
                        check=False,
                    )
        except (OSError, subprocess.SubprocessError) as error:
            log.write(str(error).encode())


def positive(value):
    value = float(value)
    if value <= 0:
        raise argparse.ArgumentTypeError("must be positive")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    info = commands.add_parser("metadata")
    info.add_argument("--profile", choices=ENVIRONMENT.PROFILES, required=True)
    info.add_argument("--output", type=Path)
    prepare = commands.add_parser("sync")
    prepare.add_argument("--profile", choices=ENVIRONMENT.PROFILES, required=True)
    coverage = commands.add_parser("coverage")
    coverage.add_argument("--artifact-dir", type=Path, required=True)
    coverage.add_argument("--output-dir", type=Path, default=ROOT / "ingestion")
    selection = coverage.add_mutually_exclusive_group()
    selection.add_argument("--shards", default="")
    selection.add_argument("--cli-suites", help="JSON array of the existing CLI matrix suite names")
    start = commands.add_parser("startup")
    start.add_argument("--output-dir", type=Path, required=True)
    start.add_argument("--timeout", type=positive, default=3600)
    start.add_argument("--attempts", type=int, choices=(1, 2), default=2)
    start.add_argument("args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command == "metadata":
        metadata(args.profile, args.output)
    elif args.command == "sync":
        sync(args.profile)
    elif args.command == "coverage":
        shards = args.shards.split(",") if args.shards else []
        if len(shards) != len(set(shards)) or any(not s or not all(c.isalnum() or c == "-" for c in s) for s in shards):
            parser.error("invalid or duplicate coverage shard names")
        cli_suites = json.loads(args.cli_suites) if args.cli_suites is not None else None
        if args.cli_suites is not None and (
            not isinstance(cli_suites, list)
            or not cli_suites
            or any(not isinstance(s, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", s) for s in cli_suites)
            or len(cli_suites) != len(set(cli_suites))
        ):
            parser.error("invalid or duplicate CLI suite names")
        combine_coverage(args.artifact_dir.resolve(), args.output_dir.resolve(), shards, cli_suites)
    else:
        command = args.args[1:] if args.args[:1] == ["--"] else args.args
        if not command:
            parser.error("startup requires a command after --")
        return startup(command, args.output_dir.resolve(), args.timeout, args.attempts)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, subprocess.CalledProcessError) as error:
        sys.stderr.write(str(error) + "\n")
        raise SystemExit(error.returncode if isinstance(error, subprocess.CalledProcessError) else 1) from error
