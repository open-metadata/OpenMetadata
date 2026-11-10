"""Resolve model metadata revisions and their distinct cache records."""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


def revisions(requested, heads, retained):
    if requested:
        selected = [requested]
    else:
        selected = list(retained)
        for head in heads:
            result = subprocess.run(
                ["git", "ls-remote", "--exit-code", "--refs", "origin", f"refs/heads/{head}"],
                check=True,
                capture_output=True,
                text=True,
                timeout=30,
            )
            selected.append(result.stdout.split()[0])
    if not selected or any(not re.fullmatch(r"[a-f0-9]{40}", sha) for sha in selected):
        raise ValueError("Expected exact commit SHAs for model metadata revisions")
    return sorted(set(selected))


def discover_models(repository, selected):
    """Read revision metadata with the checked-out discovery helper."""
    models = {}
    with tempfile.TemporaryDirectory(prefix="classification-metadata-") as scratch:
        project = Path(scratch)
        for revision in selected:
            if subprocess.run(
                ["git", "cat-file", "-e", f"{revision}:ingestion/pyproject.toml"],
                cwd=repository,
                capture_output=True,
                check=False,
                timeout=30,
            ).returncode:
                subprocess.run(
                    ["git", "fetch", "--no-tags", "--depth=1", "origin", revision],
                    cwd=repository,
                    check=True,
                    timeout=60,
                )
            metadata = subprocess.run(
                ["git", "show", f"{revision}:ingestion/pyproject.toml"],
                cwd=repository,
                capture_output=True,
                check=True,
                timeout=30,
            ).stdout
            (project / "pyproject.toml").write_bytes(metadata)
            result = subprocess.run(
                [
                    sys.executable,
                    str(repository / "scripts/prepare_classification_models.py"),
                    "discover",
                    "--project",
                    str(project),
                ],
                capture_output=True,
                text=True,
                check=False,
                timeout=60,
            )
            if result.returncode:
                raise ValueError(f"Unsupported model metadata at {revision}: {result.stderr.strip()}")
            for record in json.loads(result.stdout)["include"]:
                models[record["key"]] = record
    return list(models.values())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--discover-models", action="store_true")
    args = parser.parse_args()
    selected = revisions(
        os.environ.get("REQUESTED_REVISION", ""),
        json.loads(os.environ["SUPPORTED_HEADS"]),
        json.loads(os.environ["RETAINED_REVISIONS"]),
    )
    if args.discover_models:
        sys.stdout.write("models=" + json.dumps(discover_models(Path.cwd(), selected)) + "\n")
    else:
        sys.stdout.write("revisions=" + json.dumps(selected) + "\n")
