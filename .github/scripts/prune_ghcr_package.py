#!/usr/bin/env python3
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
"""Prune dangling and superseded GHCR container package versions.

GHCR has no native TTL or lifecycle policy, so publisher workflows invoke this
script right after pushing (and on a daily schedule) to keep CI cache packages
at a bounded steady-state footprint (ADR:2026-11-24-ci-caches-live-in-ghcr-with-actions-cache-fallback).
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any


API_ROOT = "https://api.github.com"


def _parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _tags_of(version: dict[str, Any]) -> list[str]:
    metadata = version.get("metadata") or {}
    container = metadata.get("container") or {}
    return list(container.get("tags") or [])


def select_versions_to_delete(
    versions: list[dict[str, Any]],
    *,
    keep_tags: set[str],
    keep_newest_tagged: int = 1,
    grace_hours: float = 2.0,
    delete_untagged: bool = True,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Return versions eligible for deletion while never removing the sole remaining version."""
    if len(versions) <= 1:
        return []

    reference_time = now or datetime.now(timezone.utc)
    grace_cutoff = reference_time - timedelta(hours=max(0.0, grace_hours))

    ordered = sorted(
        versions,
        key=lambda v: _parse_iso(v["created_at"]),
        reverse=True,
    )

    keep_ids: set[int] = set()
    tagged_kept = 0
    grace_kept = 0

    for version in ordered:
        vid = int(version["id"])
        tags = _tags_of(version)
        if not tags:
            if not delete_untagged:
                keep_ids.add(vid)
            continue

        if keep_tags and any(t in keep_tags for t in tags):
            keep_ids.add(vid)
            tagged_kept += 1
            continue

        if tagged_kept < keep_newest_tagged:
            keep_ids.add(vid)
            tagged_kept += 1
            continue

        if grace_hours > 0 and grace_kept < 1 and _parse_iso(version["created_at"]) >= grace_cutoff:
            keep_ids.add(vid)
            grace_kept += 1
            continue

    # GitHub Packages forbids deleting the last remaining version of a package.
    if not keep_ids:
        keep_ids.add(int(ordered[0]["id"]))

    return [v for v in ordered if int(v["id"]) not in keep_ids]


def _request(method: str, url: str, token: str) -> tuple[int, Any]:
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "openmetadata-ci-ghcr-pruner",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8", errors="replace")


def _resolve_package_base_url(owner: str, package: str, token: str) -> tuple[str | None, list[dict[str, Any]]]:
    encoded = urllib.parse.quote(package, safe="")
    for scope in ("orgs", "users"):
        base = f"{API_ROOT}/{scope}/{owner}/packages/container/{encoded}/versions"
        status, body = _request("GET", f"{base}?per_page=100&page=1", token)
        if status == 200 and isinstance(body, list):
            versions = list(body)
            page = 2
            while len(body) == 100 and page <= 20:
                p_status, p_body = _request("GET", f"{base}?per_page=100&page={page}", token)
                if p_status != 200 or not isinstance(p_body, list) or not p_body:
                    break
                versions.extend(p_body)
                body = p_body
                page += 1
            return base, versions
        if status != 404:
            print(f"GHCR listing via /{scope}/{owner} returned HTTP {status}; skipping prune.")
            return None, []
    return None, []


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--keep-tags", default="")
    parser.add_argument("--keep-newest-tagged", type=int, default=1)
    parser.add_argument("--grace-hours", type=float, default=2.0)
    parser.add_argument("--delete-untagged", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    if not token:
        print("No GH_TOKEN/GITHUB_TOKEN set; skipping GHCR prune.")
        return 0

    owner = args.owner.lower()
    base_url, versions = _resolve_package_base_url(owner, args.package, token)
    if base_url is None:
        print(f"Package ghcr.io/{owner}/{args.package} not found yet; nothing to prune.")
        return 0

    keep_tags = {t.strip() for t in args.keep_tags.split(",") if t.strip()}
    to_delete = select_versions_to_delete(
        versions,
        keep_tags=keep_tags,
        keep_newest_tagged=args.keep_newest_tagged,
        grace_hours=args.grace_hours,
        delete_untagged=args.delete_untagged,
    )
    print(
        f"ghcr.io/{owner}/{args.package}: {len(versions)} total version(s), "
        f"keeping {len(versions) - len(to_delete)}, pruning {len(to_delete)}."
    )
    if args.dry_run:
        for version in to_delete:
            print(f"  [dry-run] would delete id={version['id']} tags={_tags_of(version)} created={version['created_at']}")
        return 0

    deleted = 0
    for version in to_delete:
        vid = version["id"]
        status, body = _request("DELETE", f"{base_url}/{vid}", token)
        if status in (200, 204):
            deleted += 1
        elif status in (400, 404):
            print(f"  skipped id={vid} (HTTP {status})")
        else:
            print(f"  warning: failed to delete id={vid} (HTTP {status}): {body}")
    print(f"Pruned {deleted}/{len(to_delete)} version(s) from ghcr.io/{owner}/{args.package}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
