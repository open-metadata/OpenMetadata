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

"""Synchronize and execute the repository's locked Python profiles."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ingestion"
PROFILES = ("runtime", "all", "api", "style", "generation", "dev", "test", "coverage")


def run(command, environment, **kwargs):
    """Run a command from the checkout root, propagating failure."""
    kwargs.setdefault("cwd", ROOT)
    return subprocess.run(command, env=environment, check=True, **kwargs)


def default_environment(profile):
    """Return the configured application environment or named tool cache."""
    if profile in ("runtime", "all", "dev", "test", "api"):
        if os.environ.get("OM_PYTHON_ENVIRONMENT"):
            return Path(os.environ["OM_PYTHON_ENVIRONMENT"]).expanduser().resolve()
        return (ROOT / os.environ.get("OM_VENV_DIR", "env")).resolve()
    return PROJECT / ".nox" / profile


def uv_version():
    """Read the exact bootstrap pin without third-party TOML dependencies."""
    matches = re.findall(
        r"^required-version\s*=\s*[\"\']==([^\"\']+)[\"\']\s*$", (PROJECT / "pyproject.toml").read_text(), re.MULTILINE
    )
    if len(matches) != 1:
        raise ValueError("Expected one exact tool.uv.required-version pin")
    return matches[0]


def bootstrap(path, interpreter):
    """Create the selected venv and locate the pinned uv executable."""
    python = path / "bin/python"
    if path.exists() and any(path.iterdir()) and not (path / "pyvenv.cfg").is_file():
        raise ValueError(f"Refusing to synchronize a non-venv path: {path}")
    if not python.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        run([interpreter, "-m", "venv", str(path)], os.environ.copy())
    if not (path / "pyvenv.cfg").is_file():
        raise ValueError(f"Refusing to synchronize a non-venv path: {path}")
    version = uv_version()
    for candidate in (str(path / "bin/uv"), shutil.which("uv")):
        if candidate and Path(candidate).exists():
            result = subprocess.run([candidate, "--version"], capture_output=True, text=True, check=True)
            if result.stdout.split()[1] == version:
                return python, candidate
    run([str(python), "-m", "ensurepip", "--upgrade"], os.environ.copy())
    run([str(python), "-m", "pip", "install", f"uv=={version}"], os.environ.copy())
    return python, str(path / "bin/uv")


def read_policy(python, environment):
    """Read profile metadata using the selected interpreter's TOML parser."""
    script = """
import json, sys
try:
    import tomllib
except ImportError:
    import tomli as tomllib
with open(sys.argv[1], 'rb') as stream:
    print(json.dumps(tomllib.load(stream)['tool']['openmetadata']['python-environments']))
"""
    return json.loads(
        run(
            [str(python), "-c", script, str(PROJECT / "pyproject.toml")], environment, capture_output=True, text=True
        ).stdout
    )


def identity(profile, path):
    """Bind nested command preparation to the lock, runner and environment."""
    inputs = (PROJECT / "uv.lock", PROJECT / "pyproject.toml", PROJECT / "setup.py", Path(__file__))
    digest = hashlib.sha256(b"".join(p.read_bytes() for p in inputs if p.exists())).hexdigest()
    return json.dumps([profile, str(path), digest])


def sync(profile, path, interpreter, reinstall_packages=()):
    """Prepare generation, synchronize one profile and validate its metadata."""
    python, uv = bootstrap(path, interpreter)
    environment = dict(
        os.environ,
        VIRTUAL_ENV=str(path),
        UV_PROJECT_ENVIRONMENT=str(path),
        PATH=str(path / "bin") + os.pathsep + os.environ["PATH"],
    )
    command = [uv, "sync", "--locked", "--project", str(PROJECT), "--python", str(python)]
    ready = not reinstall_packages and os.environ.get("OM_PYTHON_SYNCED") == identity(profile, path)
    parser_check = "import packaging\ntry:\n import tomllib\nexcept ImportError:\n import tomli"
    if subprocess.run([str(python), "-c", parser_check], capture_output=True, check=False).returncode:
        run([*command, "--only-group", "environment-check", "--inexact"], environment)
    policy = read_policy(python, environment)
    selected = policy["profiles"][profile]
    if not ready:
        if selected["install-project"]:
            generator = sync("generation", PROJECT / ".nox/generation", interpreter)
            checker = subprocess.run(
                [str(generator[0]), str(ROOT / "scripts/check_generated_models.py"), "--check"],
                cwd=ROOT,
                env=generator[1],
                check=False,
            )
            if checker.returncode == 1:
                run(
                    [str(generator[0]), str(ROOT / "scripts/generate_ingestion_models.py"), "--python-only"],
                    generator[1],
                )
            elif checker.returncode:
                checker.check_returncode()
        flags = []
        for group in selected["groups"]:
            flags.extend(["--group" if selected["install-project"] else "--only-group", group])
        for extra in selected["extras"]:
            flags.extend(["--extra", extra])
        for name in reinstall_packages:
            flags.extend(["--reinstall-package", name])
        if reinstall_packages:
            flags.append("--no-cache")
        run([*command, *flags], environment)
        if profile in ("test", "api") and policy.get("classification-models"):
            install_verified_model(python, environment)
            languages = ",".join(policy["classification-models"]["languages"])
            run([str(path / "bin/metadata"), "install-classification-models", "--languages", languages], environment)
    checker = [str(python), "-I", str(PROJECT / "scripts/check_python_environment.py"), "--profile", profile]
    if profile in ("test", "api") and policy.get("classification-models"):
        checker.append("--check-models")
    run(checker, environment)
    environment["OM_PYTHON_SYNCED"] = identity(profile, path)
    if profile == "generation":
        environment["OM_GENERATION_PREPARED"] = str(path.resolve())
    else:
        environment.pop("OM_GENERATION_PREPARED", None)
    return python, environment


def install_verified_model(python, environment):
    """Install the CI-provided English wheel after verifying its expected hash."""
    directory = os.environ.get("OM_CLASSIFICATION_MODEL_DIRECTORY")
    if not directory:
        return
    wheels = list(Path(directory).glob("en_core_web_md-*-py3-none-any.whl"))
    if len(wheels) != 1:
        raise ValueError("Expected exactly one verified English model wheel")
    digest = hashlib.sha256()
    with wheels[0].open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    if digest.hexdigest() != os.environ.get("OM_CLASSIFICATION_MODEL_SHA256"):
        raise ValueError("English model wheel checksum mismatch")
    run([str(python), "-m", "pip", "install", "--no-deps", str(wheels[0])], environment)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, choices=PROFILES)
    parser.add_argument("--environment", type=Path)
    parser.add_argument("--python", default=sys.executable)
    parser.add_argument("--cwd", type=Path, default=ROOT)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    path = (args.environment or default_environment(args.profile)).expanduser().resolve()
    python, environment = sync(args.profile, path, args.python)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if command:
        if command[0] in ("python", "python3"):
            command[0] = str(python)
        run(command, environment, cwd=args.cwd)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.returncode) from exc
