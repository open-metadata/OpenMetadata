#!/usr/bin/env python3
"""Require an actual reduction across all native and companion production changes."""

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

JAVA_TOKENS = re.compile(
    r'"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''
    r"|//[^\n]*|/\*[\s\S]*?\*/|\s+|[\w$]+|.",
    re.DOTALL,
)
COUNTS = ("physical", "nonblank", "tokens")


def git(repository, *args):
    return subprocess.check_output(
        ["git", "-C", str(repository), *args], text=True, stderr=subprocess.PIPE
    )


def measure(source):
    lines = source.splitlines()
    return {
        "physical": len(lines),
        "nonblank": sum(bool(line.strip()) for line in lines),
        "tokens": sum(
            not token.isspace() and not token.startswith(("//", "/*"))
            for token in JAVA_TOKENS.findall(source)
        ),
    }


def production(path):
    return "/src/main/java/" in f"/{path}" and path.endswith(".java")


def inspect(repository, base):
    revision = git(repository, "rev-parse", "--verify", f"{base}^{{commit}}").strip()
    originals = set(
        git(repository, "ls-tree", "-r", "--name-only", "-z", revision).split("\0")
    )
    changes = set(
        git(repository, "diff", "--name-only", "--no-renames", "-z", revision).split(
            "\0"
        )
    )
    changes.update(
        git(repository, "ls-files", "--others", "--exclude-standard", "-z").split("\0")
    )
    files = []
    for relative in sorted(filter(production, changes)):
        path = repository / relative
        if path.is_symlink():
            raise ValueError(f"Production source is a symlink: {path}")
        before = (
            git(repository, "show", f"{revision}:{relative}")
            if relative in originals
            else ""
        )
        after = path.read_text() if path.exists() else ""
        files.append(
            {
                "path": relative,
                "before": measure(before),
                "after": measure(after),
                "source_sha256": hashlib.sha256(after.encode()).hexdigest()
                if path.exists()
                else None,
            }
        )
    return {"repository": str(repository), "base": revision, "files": files}


def evaluate(scopes):
    repositories = []
    seen = set()
    for path, base in scopes:
        root = Path(
            git(Path(path).resolve(), "rev-parse", "--show-toplevel").strip()
        ).resolve()
        if root in seen:
            raise ValueError(f"Duplicate repository: {root}")
        seen.add(root)
        repositories.append(inspect(root, base))
    if not repositories:
        raise ValueError("At least one repository is required")
    delta = {key: 0 for key in COUNTS}
    for repository in repositories:
        for entry in repository["files"]:
            for key in COUNTS:
                delta[key] += entry["after"][key] - entry["before"][key]
    return {
        "passed": all(value < 0 for value in delta.values()),
        "delta": delta,
        "repositories": repositories,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--scope",
        nargs=2,
        action="append",
        required=True,
        metavar=("REPOSITORY", "BASE"),
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = evaluate(args.scope)
    with args.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"passed": result["passed"], "delta": result["delta"]}))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
