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
"""Discover pinned models and transfer isolated, hash-verified uv cache archives."""

import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from urllib.parse import urlsplit


def model_record(requirement, uv_version):
    """Validate a wheel requirement and derive its immutable cache identity."""
    match = re.fullmatch(r"([a-zA-Z0-9_-]+) @ (\S+)#sha256=([a-f0-9]{64})", requirement)
    if not match:
        raise ValueError("Expected a named wheel URL with one exact SHA-256 fragment")
    name, url, digest = match.groups()
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("Expected an HTTP wheel URL without credentials or extra fragments")
    name = name.lower().replace("_", "-")
    wheel = re.fullmatch(r"([a-zA-Z0-9_]+)-([0-9][a-zA-Z0-9.]*)-py3-none-any.whl", parsed.path.rsplit("/", 1)[-1])
    if not wheel or wheel[1].lower().replace("_", "-") != name:
        raise ValueError("Model name must match a universal Python wheel filename")
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)+", uv_version):
        raise ValueError("Expected an exact uv version")
    lookup_url = url
    url_hash = hashlib.sha256(lookup_url.encode()).hexdigest()
    return {
        "name": name,
        "version": wheel[2],
        "requirement": requirement,
        "url": lookup_url,
        "sha256": digest,
        "uv-version": uv_version,
        "key": f"classification-model-v1-{uv_version}-{name}-{digest}-{url_hash}",
    }


def read_project(project):
    """Read project metadata without loading ingestion or Nox."""
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib

    with (project / "pyproject.toml").open("rb") as stream:
        return tomllib.load(stream)


def python_matrix(project):
    """Read the shared CI interpreter matrix without loading ingestion or Nox."""
    versions = read_project(project)["tool"]["openmetadata"]["python-environments"]["supported-python"]
    if not versions or any(not re.fullmatch(r"3\.[0-9]+", version) for version in versions):
        raise ValueError("Expected a nonempty Python version matrix")
    return {
        "python-versions": versions,
        "discovery-python": max(versions, key=lambda v: tuple(map(int, v.split(".")))),
    }


def test_matrix(project, full_suite):
    """Select unit, static-check and coverage interpreters from supported versions."""
    matrix = python_matrix(project)
    versions = matrix["python-versions"]
    lowest = min(versions, key=lambda v: tuple(map(int, v.split("."))))
    highest = matrix["discovery-python"]
    return {
        "versions": versions,
        "unit-versions": versions if full_suite else [highest],
        "static-version": lowest,
        "coverage-version": lowest if full_suite else highest,
    }


def discover(project):
    """Read model requirements and matching static metadata without application imports."""
    config = read_project(project)
    if "classification-models" not in config.get("dependency-groups", {}):
        raise ValueError("Requested revision lacks the classification-models layout and is unsupported")
    uv = config["tool"]["uv"]
    pin = uv["required-version"]
    if not pin.startswith("=="):
        raise ValueError("Expected an exact uv required-version")
    records = [model_record(req, pin[2:]) for req in config["dependency-groups"]["classification-models"]]
    if not records or len({r["name"] for r in records}) != len(records):
        raise ValueError("Expected a nonempty set of distinct model requirements")
    for record in records:
        metadata = [
            entry
            for entry in uv["dependency-metadata"]
            if entry["name"].replace("_", "-") == record["name"] and entry["version"] == record["version"]
        ]
        if len(metadata) != 1 or "requires-dist" not in metadata[0]:
            raise ValueError(f"Missing exact static dependency metadata for {record['name']} {record['version']}")
        record["metadata"] = metadata[0]
    return {"include": records, **python_matrix(project)}


def verify(project):
    """Load every declared model without invoking a provisioning fallback."""
    import importlib.metadata

    import spacy

    for record in discover(project)["include"]:
        name = record["name"].replace("-", "_")
        if importlib.metadata.version(name) != record["version"]:
            raise ValueError(f"Unexpected installed version of {name}")
        if not spacy.load(name)("Example text"):
            raise ValueError(f"Empty document from {name}")
        sys.stdout.write(f"Loaded {name} {record['version']}\n")


def prepare(requirement, uv_version, output):
    """Seed an isolated uv cache and atomically publish its uncompressed archive."""
    record = model_record(requirement, uv_version)
    version = subprocess.run(["uv", "--version"], check=True, capture_output=True, text=True).stdout.split()[1]
    if version != uv_version:
        raise ValueError(f"Expected uv {uv_version}, found {version}")
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="classification-model-") as scratch:
        root = Path(scratch).resolve()
        cache = root / "cache"
        requirements = root / "requirements.txt"
        requirements.write_text(f"{record['name']} @ {record['url']} --hash=sha256:{record['sha256']}\n")
        environment = dict(os.environ, UV_CACHE_DIR=str(cache), UV_HTTP_RETRIES="2", UV_HTTP_TIMEOUT="60")
        subprocess.run(["uv", "venv", str(root / "env"), "--python", sys.executable], check=True, env=environment)
        subprocess.run(
            [
                "uv",
                "pip",
                "install",
                "--python",
                str(root / "env/bin/python"),
                "--no-deps",
                "--require-hashes",
                "-r",
                str(requirements),
            ],
            check=True,
            env=environment,
            timeout=600,
        )
        with tempfile.TemporaryDirectory(dir=output.parent) as staging:
            pending = Path(staging) / "model.tar"
            with tarfile.open(pending, mode="w") as archive:
                archive.add(cache, arcname=".")
            pending.replace(output)


def import_archive(archive, cache_dir):
    """Merge independent model caches, preserving generic entries and relative links."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    with (cache_dir / ".classification-import.lock").open("a") as lock, tempfile.TemporaryDirectory() as scratch:
        fcntl.flock(lock, fcntl.LOCK_EX)
        root = Path(scratch).resolve()
        with tarfile.open(archive) as stream:
            members = stream.getmembers()
            for member in members:
                target = (root / member.name).resolve()
                if not target.is_relative_to(root) or not (member.isfile() or member.isdir() or member.issym()):
                    raise ValueError("Invalid model cache archive entry")
                if member.issym() and not (target.parent / member.linkname).resolve().is_relative_to(root):
                    raise ValueError("Model cache link escapes archive")
            stream.extractall(root, members=members)
        for source in root.rglob("*"):
            destination = cache_dir / source.relative_to(root)
            if source.is_symlink():
                if destination.is_symlink():
                    destination.unlink()
                destination.symlink_to(source.readlink())
            elif source.is_dir():
                destination.mkdir(exist_ok=True)
            else:
                shutil.copy2(source, destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    matrix = commands.add_parser("matrix")
    matrix.add_argument("--project", type=Path, required=True)
    tests = commands.add_parser("test-matrix")
    tests.add_argument("--project", type=Path, required=True)
    tests.add_argument("--full-suite", action="store_true")
    discovery = commands.add_parser("discover")
    discovery.add_argument("--project", type=Path, required=True)
    verification = commands.add_parser("verify")
    verification.add_argument("--project", type=Path, required=True)
    cleaning = commands.add_parser("clean")
    cleaning.add_argument("--project", type=Path, required=True)
    preparation = commands.add_parser("prepare")
    preparation.add_argument("--requirement", required=True)
    preparation.add_argument("--uv-version", required=True)
    preparation.add_argument("--output", type=Path, required=True)
    importing = commands.add_parser("import")
    importing.add_argument("--archive", type=Path, required=True)
    importing.add_argument("--cache-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "matrix":
        sys.stdout.write(json.dumps(python_matrix(args.project)) + "\n")
    elif args.command == "test-matrix":
        sys.stdout.write(json.dumps(test_matrix(args.project, args.full_suite)) + "\n")
    elif args.command == "discover":
        sys.stdout.write(json.dumps(discover(args.project)) + "\n")
    elif args.command == "prepare":
        prepare(args.requirement, args.uv_version, args.output)
    elif args.command == "verify":
        verify(args.project)
    elif args.command == "clean":
        subprocess.run(["uv", "cache", "clean", *[r["name"] for r in discover(args.project)["include"]]], check=True)
    else:
        import_archive(args.archive, args.cache_dir)


if __name__ == "__main__":
    main()
