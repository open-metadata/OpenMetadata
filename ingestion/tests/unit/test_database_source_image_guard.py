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
"""Every MySQL and Postgres image tag a connector test reads must equal a source constant.

ADR:2026-11-19-test-database-images-have-a-store-and-a-source-version
"""

import re
from pathlib import Path

from _openmetadata_testutils.helpers.database_images import MYSQL_SOURCE_IMAGE, POSTGRES_SOURCE_IMAGE

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]

# Connector tests, their shared fixtures and the SDK examples start databases our connectors read,
# so they follow the connector source versions, not the metadata store OpenMetadata ships.
SOURCE_ROOTS = ("ingestion/tests", "ingestion/src/_openmetadata_testutils", "examples")

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
    lines = path.read_text(encoding="latin-1").splitlines()
    return [
        f"{relative}:{number}: {tag} (expected {_expected(tag)})"
        for number, line in enumerate(lines, start=1)
        for tag in (match.group() for match in IMAGE_TAG.finditer(line))
        if tag != _expected(tag)
    ]


def _expected(tag: str) -> str:
    return POSTGRES_SOURCE_IMAGE if tag.startswith("postgres:") else MYSQL_SOURCE_IMAGE


def test_every_connector_source_image_equals_the_constant():
    mismatches = find_mismatches(REPOSITORY_ROOT)

    assert not mismatches, (
        f"Connector tests read {MYSQL_SOURCE_IMAGE} and {POSTGRES_SOURCE_IMAGE}, the source constants in "
        "_openmetadata_testutils.helpers.database_images. To bump a version, change those constants and "
        "every line listed here. These lines name a different image:\n" + "\n".join(mismatches)
    )
