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
"""Every MySQL and Postgres image a connector test reads must come from the source constants.

ADR:2026-11-24-connector-tests-cover-the-oldest-and-newest-source-versions
"""

import re
from pathlib import Path

from _openmetadata_testutils.helpers.database_images import (
    MYSQL_NEWEST_SOURCE_IMAGE,
    MYSQL_OLDEST_SOURCE_IMAGE,
    POSTGRES_NEWEST_SOURCE_IMAGE,
    POSTGRES_OLDEST_SOURCE_IMAGE,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]

# Connector tests and their shared fixtures start databases our connectors read, so they follow
# the connector source versions, not the metadata store OpenMetadata ships.
SOURCE_ROOTS = ("ingestion/tests", "ingestion/src/_openmetadata_testutils")

# Python code names no image but this helper: a test that typed even an allowed tag would miss the
# oldest-version run.
HELPER = "ingestion/src/_openmetadata_testutils/helpers/database_images.py"

# IMAGE_TAG stops before a digest, so a file is compared on the tag the constants pin.
MYSQL_SOURCE_IMAGES = tuple(image.split("@")[0] for image in (MYSQL_OLDEST_SOURCE_IMAGE, MYSQL_NEWEST_SOURCE_IMAGE))
POSTGRES_SOURCE_IMAGES = tuple(
    image.split("@")[0] for image in (POSTGRES_OLDEST_SOURCE_IMAGE, POSTGRES_NEWEST_SOURCE_IMAGE)
)

# mysql: or postgres: with a one- or two-digit major (which keeps out ports such as 3306), a
# floating tag or a digest, and Oracle's legacy MySQL Server image. Connection strings such as
# mysql+pymysql:// and other products such as mariadb: or timescale/timescaledb: do not match.
# The escaped hyphen keeps this file from matching its own pattern.
IMAGE_TAG = re.compile(
    r"\b(?:mysql|postgres)(?::(?:\d{1,2}(?!\d)|latest|lts|alpine)(?:[.-]\w+)*|@sha256:\w+)"
    r"|mysql/mysql\-server(?::[\w.-]+)?"
)

PRUNED_DIRECTORIES = {"__pycache__", ".pytest_cache", ".ruff_cache", ".mypy_cache", "node_modules", ".venv", "venv"}

# Prose may name any version, and binary fixtures start no container.
SKIPPED_SUFFIXES = {".md", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".zip", ".gz", ".tgz", ".tar", ".pdf", ".parquet"}


def find_mismatches(repository_root: Path) -> list[str]:
    mismatches = []
    for root in SOURCE_ROOTS:
        for path in sorted((repository_root / root).rglob("*")):
            if _is_scanned(path):
                mismatches.extend(_mismatches_in(path, repository_root))
    return mismatches


def _is_scanned(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() not in SKIPPED_SUFFIXES and PRUNED_DIRECTORIES.isdisjoint(path.parts)


def _mismatches_in(path: Path, repository_root: Path) -> list[str]:
    relative = path.relative_to(repository_root).as_posix()
    python_code = path.suffix == ".py" and relative != HELPER
    lines = path.read_text(encoding="latin-1").splitlines()
    return [
        f"{relative}:{number}: {tag} ({_fix(python_code, tag)})"
        for number, line in enumerate(lines, start=1)
        for tag in (match.group() for match in IMAGE_TAG.finditer(line))
        if python_code or tag not in _allowed(tag)
    ]


def _fix(python_code: bool, tag: str) -> str:
    if python_code:
        return f"call {'postgres' if tag.startswith('postgres') else 'mysql'}_source_image()"
    return f"expected one of {', '.join(_allowed(tag))}"


def _allowed(tag: str) -> tuple[str, ...]:
    return POSTGRES_SOURCE_IMAGES if tag.startswith("postgres") else MYSQL_SOURCE_IMAGES


def test_every_connector_source_image_equals_the_constant():
    mismatches = find_mismatches(REPOSITORY_ROOT)

    assert not mismatches, (
        "Connector tests read the oldest and newest source versions in "
        "_openmetadata_testutils.helpers.database_images. Call mysql_source_image() or postgres_source_image(); "
        "to bump a version, change those constants and every line listed here. These lines name a "
        "different image:\n" + "\n".join(mismatches)
    )


def test_the_guard_reports_typed_and_unknown_tags(tmp_path):
    tests = tmp_path / "ingestion" / "tests"
    tests.mkdir(parents=True)
    newest_tag = MYSQL_SOURCE_IMAGES[1]
    # Split so this file does not match its own pattern.
    stale_tag = "postgres" + ":16-alpine"
    (tests / "conftest.py").write_text(f'MySqlContainer("{newest_tag}")\nengine = "mysql+pymysql://h:3306/db"\n')
    (tests / "compose.yml").write_text(f"image: {POSTGRES_SOURCE_IMAGES[0]}\nimage: {stale_tag}\n")

    assert find_mismatches(tmp_path) == [
        f"ingestion/tests/compose.yml:2: {stale_tag} (expected one of {', '.join(POSTGRES_SOURCE_IMAGES)})",
        f"ingestion/tests/conftest.py:1: {newest_tag} (call mysql_source_image())",
    ]
