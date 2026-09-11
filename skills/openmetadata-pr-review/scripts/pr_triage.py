#!/usr/bin/env python3
"""Fetch PR metadata + current open/closed state for a list of PRs, sorted by creation date.

Usage:
    python3 pr_triage.py 26965,26977,27020            # default repo
    python3 pr_triage.py -R owner/repo 26965 26977    # explicit repo, space or comma separated

Prints two sections: STILL OPEN (review these) and CLOSED/MERGED (drop these), so a batch
review never wastes an agent on a PR that was closed since the list was drawn up.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

DEFAULT_REPO = "open-metadata/OpenMetadata"
FIELDS = "number,title,author,createdAt,state,isDraft,additions,deletions,changedFiles,mergedAt,closedAt,url"


def parse_numbers(tokens: list[str]) -> list[int]:
    numbers: list[int] = []
    for token in tokens:
        for part in token.split(","):
            part = part.strip().lstrip("#")
            if part:
                numbers.append(int(part))
    return numbers


def fetch(number: int, repo: str) -> dict:
    result = subprocess.run(
        ["gh", "pr", "view", str(number), "-R", repo, "--json", FIELDS],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return {"number": number, "state": "ERROR", "error": result.stderr.strip()[:120]}
    data = json.loads(result.stdout)
    data["author"] = (data.get("author") or {}).get("login", "?")
    return data


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("-R", "--repo", default=DEFAULT_REPO)
    parser.add_argument("numbers", nargs="+")
    args = parser.parse_args(argv)

    numbers = parse_numbers(args.numbers)
    with ThreadPoolExecutor(max_workers=12) as pool:
        rows = list(pool.map(lambda n: fetch(n, args.repo), numbers))
    rows.sort(key=lambda d: d.get("createdAt", ""))

    open_rows = [r for r in rows if r.get("state") == "OPEN"]
    closed_rows = [r for r in rows if r.get("state") not in ("OPEN", None)]

    print(f"STILL OPEN ({len(open_rows)}) — review these")
    for r in open_rows:
        draft = " [draft]" if r.get("isDraft") else ""
        print(
            f"  {r['createdAt'][:10]}  #{r['number']:<6d} +{r['additions']}/-{r['deletions']} "
            f"{r['changedFiles']}f @{r['author']}{draft}: {r['title'][:70]}"
        )

    print(f"\nCLOSED/MERGED/ERROR ({len(closed_rows)}) — drop these")
    for r in closed_rows:
        when = (r.get("mergedAt") or r.get("closedAt") or "")[:10]
        detail = r.get("error", "")
        print(f"  #{r['number']:<6d} {r['state']:6s} {when} {detail}")

    print(f"\nopen_csv: {','.join(str(r['number']) for r in open_rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
