"""Resolve the operational set of model metadata revisions for the daily warmer."""

import json
import os
import re
import subprocess
import sys


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


if __name__ == "__main__":
    sys.stdout.write(
        "revisions="
        + json.dumps(
            revisions(
                os.environ.get("REQUESTED_REVISION", ""),
                json.loads(os.environ["SUPPORTED_HEADS"]),
                json.loads(os.environ["RETAINED_REVISIONS"]),
            )
        )
        + "\n"
    )
