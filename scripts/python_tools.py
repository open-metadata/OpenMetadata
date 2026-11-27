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

"""Select the pinned uv executable and bootstrap locked Nox tools."""

import argparse
import fcntl
import os
import re
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ingestion"
BOOTSTRAP = PROJECT / ".nox/bootstrap"


def required_version():
    """Read the project's single exact uv version requirement."""
    sections = re.split(r"(?m)(?=^\[)", (PROJECT / "pyproject.toml").read_text())
    pins = [
        pin
        for section in sections
        if section.startswith("[tool.uv]\n")
        for pin in re.findall(r'^required-version\s*=\s*"==([^"]+)"\s*$', section, re.MULTILINE)
    ]
    if len(pins) != 1:
        raise RuntimeError("Expected one exact tool.uv.required-version pin")
    return pins[0]


def matches_version(executable, version):
    """Return whether an executable reports the required uv version."""
    try:
        result = subprocess.run([str(executable), "--version"], capture_output=True, text=True, check=False)
    except OSError:
        return False
    fields = result.stdout.split()
    return result.returncode == 0 and fields[:2] == ["uv", version]


@contextmanager
def bootstrap_lock():
    """Serialize checkout-local tool installation."""
    BOOTSTRAP.parent.mkdir(parents=True, exist_ok=True)
    with (BOOTSTRAP.parent / "bootstrap.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def find_uv(version):
    """Find a matching uv outside environments synchronized by application profiles."""
    explicit = os.environ.get("OM_UV_EXECUTABLE")
    if explicit:
        executable = Path(explicit).expanduser().resolve()
        if not matches_version(executable, version):
            raise RuntimeError(f"OM_UV_EXECUTABLE must point to uv {version}: {executable}")
        return executable
    application = Path(os.environ.get("OM_PYTHON_ENVIRONMENT") or ROOT / (os.environ.get("OM_VENV_DIR") or "env"))
    application = application.expanduser().resolve()
    candidates = [Path(directory) / "uv" for directory in os.get_exec_path()] + [BOOTSTRAP / "bin/uv"]
    for candidate in candidates:
        executable = candidate.expanduser().resolve()
        if executable.is_relative_to(application) or (
            executable.is_relative_to(PROJECT / ".nox") and not executable.is_relative_to(BOOTSTRAP)
        ):
            continue
        if matches_version(executable, version):
            return executable
    return None


def ensure_uv():
    """Select pinned uv, installing a checkout-local fallback only outside CI."""
    version = required_version()
    executable = find_uv(version)
    if executable:
        return executable
    if os.environ.get("GITHUB_ACTIONS") == "true" or os.environ.get("CI", "").lower() == "true":
        raise RuntimeError(f"Expected uv {version}; configure setup-uv before Python tasks in CI")
    with bootstrap_lock():
        executable = find_uv(version)
        if executable:
            return executable
        python = BOOTSTRAP / "bin/python"
        if not python.exists():
            subprocess.run([sys.executable, "-m", "venv", str(BOOTSTRAP)], check=True, stdout=sys.stderr)
        subprocess.run([str(python), "-I", "-m", "ensurepip", "--upgrade"], check=True, stdout=sys.stderr)
        subprocess.run([str(python), "-I", "-m", "pip", "install", f"uv=={version}"], check=True, stdout=sys.stderr)
        executable = BOOTSTRAP / "bin/uv"
        if not matches_version(executable, version):
            raise RuntimeError(f"Failed to install uv {version} in {BOOTSTRAP}")
        return executable


def bootstrap_nox():
    """Prepare Nox from the project lockfile in the checkout bootstrap environment."""
    uv = ensure_uv()
    python = BOOTSTRAP / "bin/python"
    with bootstrap_lock():
        if not python.exists():
            subprocess.run([str(uv), "venv", "--python", sys.executable, str(BOOTSTRAP)], check=True)
        environment = {**os.environ, "VIRTUAL_ENV": str(BOOTSTRAP), "UV_PROJECT_ENVIRONMENT": str(BOOTSTRAP)}
        subprocess.run(
            [
                str(uv),
                "sync",
                "--locked",
                "--inexact",
                "--project",
                str(PROJECT),
                "--only-group",
                "nox",
                "--python",
                str(python),
            ],
            env=environment,
            check=True,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("bootstrap", "uv-path"))
    args = parser.parse_args()
    try:
        if args.command == "bootstrap":
            bootstrap_nox()
        else:
            sys.stdout.write(f"{ensure_uv()}\n")
    except (RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
