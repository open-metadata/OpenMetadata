"""Keep only each shard's newest workflow-attempt results artifact.

The summary job downloads every attempt's `playwright-results-json-*` artifact.
A "Re-run failed jobs" attempt only re-uploads the shards it re-ran, so the
shards that passed earlier exist only under their original attempt suffix.
Filtering the download to the current attempt dropped those shards and the gate
reported them as missing (run 36268674020 attempt 2: 0 tests, 68 "CI/reporting"
failures). Keeping every attempt instead lets a stale earlier ci-status.json
count against a green re-run (run 35650435023), because the classifier does not
dedupe by attempt. So delete everything but the newest attempt per shard; the
primary/`-retry` pair of that attempt stays for the renderer to collapse.
"""

import re
import shutil
import sys
from pathlib import Path

ARTIFACT_DIR = re.compile(
    r"^playwright-results-json-(?P<shard>.+?)(?:-a(?P<attempt>\d+))?(?:-retry)?$"
)


def keep_latest_attempt(results_dir: Path) -> list[Path]:
    parsed = []
    for path in results_dir.iterdir() if results_dir.is_dir() else []:
        match = ARTIFACT_DIR.match(path.name)
        if path.is_dir() and match:
            parsed.append((path, match["shard"], int(match["attempt"] or 0)))

    latest: dict[str, int] = {}
    for _, shard, attempt in parsed:
        latest[shard] = max(latest.get(shard, attempt), attempt)

    removed = [path for path, shard, attempt in parsed if attempt < latest[shard]]
    for path in removed:
        shutil.rmtree(path)
    return removed


if __name__ == "__main__":
    for removed_dir in keep_latest_attempt(Path(sys.argv[1])):
        print(f"Superseded by a later attempt: {removed_dir.name}")
