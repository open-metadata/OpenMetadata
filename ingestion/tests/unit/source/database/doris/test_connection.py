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
"""Unit tests for Doris connection handling."""

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, select

from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
    DorisScheme,
)
from metadata.ingestion.source.database.doris.connection import get_connection


@pytest.fixture
def doris_connection_config() -> DorisConnection:
    return DorisConnection(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:9030",
        databaseSchema="openmetadata_db",
        scheme=DorisScheme.doris,
    )


@pytest.mark.parametrize(
    "column_name",
    ["install", "uninstall", "account_lock", "tablet", "ordinary_column"],
)
def test_doris_identifiers_are_always_quoted(
    column_name: str, doris_connection_config: DorisConnection
):
    table = Table(
        "events",
        MetaData(),
        Column("id", Integer),
        Column(column_name, Integer),
    )

    engine = get_connection(doris_connection_config)
    try:
        query = str(
            select(table.c.id, table.c[column_name]).compile(dialect=engine.dialect)
        )
    finally:
        engine.dispose()

    assert "`events`.`id`" in query
    assert f"`events`.`{column_name}`" in query
    assert "FROM `events`" in query
