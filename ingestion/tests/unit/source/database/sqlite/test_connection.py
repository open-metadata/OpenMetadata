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
"""Unit tests for SQLite connection handling."""

from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection as SQLiteConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteScheme,
)
from metadata.ingestion.source.database.sqlite.connection import SQLiteConnection


def test_in_memory_url_when_no_database_mode():
    connection = SQLiteConnectionConfig(scheme=SQLiteScheme.sqlite_pysqlite)
    engine = SQLiteConnection(connection).client
    assert engine.url.render_as_string(hide_password=False) == "sqlite+pysqlite:///:memory:"


def test_file_url_when_database_mode_set():
    connection = SQLiteConnectionConfig(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode="/tmp/openmetadata.db",
    )
    engine = SQLiteConnection(connection).client
    assert engine.url.render_as_string(hide_password=False) == "sqlite+pysqlite:////tmp/openmetadata.db"
