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
"""The MySQL and Postgres images test containers run, the same images OpenMetadata ships.

Bump them by hand together with TestDatabaseImages in openmetadata-service; its guard test lists
every other line that must change. MYSQL_IMAGE and POSTGRES_IMAGE environment variables replace
them for a one-off run.

ADR:2026-11-19-test-database-images-are-one-constant
"""

import os

MYSQL_IMAGE = "mysql:8.4.13"
POSTGRES_IMAGE = "postgres:15"


def mysql_image() -> str:
    return _resolve("MYSQL_IMAGE", MYSQL_IMAGE)


def postgres_image() -> str:
    return _resolve("POSTGRES_IMAGE", POSTGRES_IMAGE)


def _resolve(override_variable: str, image: str) -> str:
    return os.environ.get(override_variable, "").strip() or image
