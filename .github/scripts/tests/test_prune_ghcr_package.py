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
"""Tests for .github/scripts/prune_ghcr_package.py."""

from __future__ import annotations

import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
_SPEC = importlib.util.spec_from_file_location(
    "prune_ghcr_package", ROOT / ".github/scripts/prune_ghcr_package.py"
)
pruner = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = pruner
_SPEC.loader.exec_module(pruner)


def _ver(vid: int, tags: list[str], age_minutes: int, now: datetime) -> dict:
    created = (now - timedelta(minutes=age_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "id": vid,
        "created_at": created,
        "metadata": {"container": {"tags": tags}},
    }


def test_m2_cache_keeps_only_main_and_deletes_untagged_and_stray_tags() -> None:
    now = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
    versions = [
        _ver(1, ["main"], 5, now),
        _ver(2, [], 10, now),
        _ver(3, ["deadbeef1234"], 15, now),
        _ver(4, [], 1440, now),
    ]
    victims = pruner.select_versions_to_delete(
        versions,
        keep_tags={"main"},
        keep_newest_tagged=1,
        grace_hours=0,
        delete_untagged=True,
        now=now,
    )
    assert [v["id"] for v in victims] == [2, 3, 4]


def test_playwright_ingestion_keeps_latest_plus_recent_grace_and_prunes_older() -> None:
    now = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
    versions = [
        _ver(10, ["fp-newest"], 10, now),
        _ver(11, ["fp-recent"], 45, now),  # within 2h grace window -> kept
        _ver(12, ["fp-third-recent"], 60, now),  # 2nd in grace window -> pruned
        _ver(13, ["fp-old"], 180, now),  # older than 2h -> pruned
        _ver(14, [], 5, now),  # untagged -> pruned
    ]
    victims = pruner.select_versions_to_delete(
        versions,
        keep_tags=set(),
        keep_newest_tagged=1,
        grace_hours=2.0,
        delete_untagged=True,
        now=now,
    )
    assert [v["id"] for v in victims] == [14, 12, 13]


def test_playwright_ingestion_prunes_previous_tag_after_grace_expires() -> None:
    now = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
    versions = [
        _ver(20, ["fp-newest"], 10, now),
        _ver(21, ["fp-expired"], 125, now),
    ]
    victims = pruner.select_versions_to_delete(
        versions,
        keep_tags=set(),
        keep_newest_tagged=1,
        grace_hours=2.0,
        delete_untagged=True,
        now=now,
    )
    assert [v["id"] for v in victims] == [21]


def test_never_deletes_sole_remaining_version() -> None:
    now = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
    assert (
        pruner.select_versions_to_delete(
            [_ver(1, [], 10, now)],
            keep_tags=set(),
            keep_newest_tagged=1,
            grace_hours=0,
            delete_untagged=True,
            now=now,
        )
        == []
    )


def test_ci_m2_cache_disables_attestations_so_untagged_prune_is_safe() -> None:
    import yaml

    workflow = yaml.load(
        (ROOT / ".github/workflows/ci-builder-images.yml").read_text(),
        Loader=yaml.BaseLoader,
    )
    steps = workflow["jobs"]["build-and-prune"]["steps"]
    push_step = next(
        s for s in steps if s.get("uses", "").startswith("docker/build-push-action@")
    )
    with_args = push_step["with"]
    assert with_args.get("provenance") == "false"
    assert with_args.get("sbom") == "false"
