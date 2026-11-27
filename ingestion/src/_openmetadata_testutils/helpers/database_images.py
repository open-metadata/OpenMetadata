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
database OpenMetadata ships as its own metadata store.
Tests run on the newest; SOURCE_DATABASE_VERSION=oldest runs them on the oldest, as the nightly
run does. MYSQL_SOURCE_IMAGE and POSTGRES_SOURCE_IMAGE replace the image for a one-off run.
Each image is pinned by digest so a rebuilt tag cannot change a run. Bump these by hand;
tests/unit/test_database_source_image_guard.py lists every other line that must change.

ADR:2026-11-24-connector-tests-cover-the-oldest-and-newest-source-versions
"""

import os

MYSQL_OLDEST_SOURCE_IMAGE = "mysql:8.0.46@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b"
MYSQL_NEWEST_SOURCE_IMAGE = "mysql:9.7.4@sha256:1f2ca53a9e94ff9f1f313099fa7dc7fb2f72e180ca5b2ef83574031e451bbbf1"
POSTGRES_OLDEST_SOURCE_IMAGE = "postgres:15.20@sha256:91b9edc40277faf94bc1e3d7ae621b185fa70f3099b94309c4731a8296114870"
POSTGRES_NEWEST_SOURCE_IMAGE = "postgres:18.7@sha256:c699303802144847d238196173655dbbecf7a96aeca1565f2b02eb671a1f0b6b"

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
