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

One version per engine, the newest the connectors support. They are independent of the
database OpenMetadata ships as its own metadata store, which TestDatabaseImages in
openmetadata-service holds. Bump them here by hand; tests/unit/test_database_source_image_guard.py
lists every other line that must change. The MYSQL_SOURCE_IMAGE and POSTGRES_SOURCE_IMAGE
environment variables replace them for a one-off run.

ADR:2026-11-19-test-database-images-have-a-store-and-a-source-version
"""

import os

MYSQL_SOURCE_IMAGE = "mysql:8.4.13"
POSTGRES_SOURCE_IMAGE = "postgres:16.15"


def mysql_source_image() -> str:
    return _resolve("MYSQL_SOURCE_IMAGE", MYSQL_SOURCE_IMAGE)


def postgres_source_image() -> str:
    return _resolve("POSTGRES_SOURCE_IMAGE", POSTGRES_SOURCE_IMAGE)


def _resolve(override_variable: str, image: str) -> str:
    return os.environ.get(override_variable, "").strip() or image
