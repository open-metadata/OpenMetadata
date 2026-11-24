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
"""The MySQL and Postgres images connector tests read from, as a customer's source database.

Each engine has the oldest and the newest version the connectors support, independent of the
database OpenMetadata ships as its own metadata store (TestDatabaseImages in openmetadata-service).
Tests run on the newest; SOURCE_DATABASE_VERSION=oldest runs them on the oldest, as the nightly
run does. MYSQL_SOURCE_IMAGE and POSTGRES_SOURCE_IMAGE replace the image for a one-off run.
Bump these by hand; tests/unit/test_database_source_image_guard.py lists every other line that
must change.

ADR:2026-11-19-test-database-images-have-a-store-and-a-source-version
"""

import os

MYSQL_OLDEST_SOURCE_IMAGE = "mysql:8.0.46"
MYSQL_NEWEST_SOURCE_IMAGE = "mysql:9.7.4"
POSTGRES_OLDEST_SOURCE_IMAGE = "postgres:15.20"
POSTGRES_NEWEST_SOURCE_IMAGE = "postgres:18.7"

SOURCE_VERSION_VARIABLE = "SOURCE_DATABASE_VERSION"
OLDEST = "oldest"
NEWEST = "newest"


def mysql_source_image() -> str:
    return _resolve("MYSQL_SOURCE_IMAGE", MYSQL_OLDEST_SOURCE_IMAGE, MYSQL_NEWEST_SOURCE_IMAGE)


def postgres_source_image() -> str:
    return _resolve("POSTGRES_SOURCE_IMAGE", POSTGRES_OLDEST_SOURCE_IMAGE, POSTGRES_NEWEST_SOURCE_IMAGE)


def _resolve(override_variable: str, oldest: str, newest: str) -> str:
    override = os.environ.get(override_variable, "").strip()
    return override or (oldest if _selected_version() == OLDEST else newest)


def _selected_version() -> str:
    version = os.environ.get(SOURCE_VERSION_VARIABLE, "").strip().lower() or NEWEST
    if version not in (OLDEST, NEWEST):
        raise ValueError(f"{SOURCE_VERSION_VARIABLE} must be '{OLDEST}' or '{NEWEST}', not '{version}'")
    return version
