#!/usr/bin/env python3
"""Copies the stored alerting shapes of a previous release into the service's test resources.

StoredShapeCompatibilityTest validates everything this release writes for a server of the previous
release against these files, so they have to be the schemas of the release being followed.

Usage: scripts/alerting/refresh_compat_schemas.py <git ref of the previous release, e.g. origin/2.0>
"""
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path

SCHEMA_ROOT = "openmetadata-spec/src/main/resources/json/schema/"
TARGET = Path("openmetadata-service/src/test/resources/compat/json/schema")
STORED_SHAPES = [
    "events/eventSubscription.json",
    "events/eventSubscriptionOffset.json",
    "events/alertMetrics.json",
    "events/failedEvent.json",
    "events/subscriptionStatus.json",
]


def show(ref: str, path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"{ref}:{SCHEMA_ROOT}{path}"], capture_output=True, text=True, check=True
    )
    return result.stdout


def closure(ref: str) -> dict[str, str]:
    found: dict[str, str] = {}
    pending = list(STORED_SHAPES)
    while pending:
        path = pending.pop()
        if path in found:
            continue
        found[path] = show(ref, path)
        for target in re.findall(r'"\$ref"\s*:\s*"([^"#]+)', found[path]):
            pending.append(posixpath.normpath(posixpath.join(posixpath.dirname(path), target)))
    return found


def main() -> None:
    ref = sys.argv[1]
    for path, text in closure(ref).items():
        schema = json.loads(text)
        # Without its $id a schema resolves relative references from where the file is.
        schema.pop("$id", None)
        destination = TARGET / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(schema, indent=2) + "\n")
    (TARGET.parent.parent / "SOURCE").write_text(f"{ref}\n")


if __name__ == "__main__":
    main()
