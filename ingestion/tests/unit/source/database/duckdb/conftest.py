#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""DuckDB is embedded, so these tests run the connector against real database files."""

from datetime import datetime, timedelta
from pathlib import Path

import duckdb
import pytest

from ingestion.tests.unit.source.database.duckdb._fixtures import (
    DUCKDB_TEST_CONFIG,
    LOGGED_QUERIES,
    OTHER_DDL,
    QUERY_LOG_DDL,
    SHOP_DDL,
    create_database,
)


@pytest.fixture
def shop_db(tmp_path: Path) -> Path:
    return create_database(tmp_path / "shop.duckdb", SHOP_DDL)


@pytest.fixture
def shop_db_with_query_log(shop_db: Path) -> Path:
    now = datetime.now()
    with duckdb.connect(str(shop_db), config=DUCKDB_TEST_CONFIG) as conn:
        conn.execute(QUERY_LOG_DDL)
        for minutes_ago, query, user, duration_ms in LOGGED_QUERIES:
            conn.execute(
                "INSERT INTO main.duckdb_query_log VALUES (?, ?, NULL, ?, ?, NULL)",
                [query, user, now - timedelta(minutes=minutes_ago), duration_ms],
            )
    return shop_db


@pytest.fixture
def other_db(tmp_path: Path) -> Path:
    return create_database(tmp_path / "other.duckdb", OTHER_DDL)
