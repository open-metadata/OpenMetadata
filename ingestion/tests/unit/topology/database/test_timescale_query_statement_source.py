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

"""Tests for the Timescale query-history relation setting."""

from unittest.mock import MagicMock, Mock, patch

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool

from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConfig,
)
from metadata.generated.schema.entity.services.connections.database.timescaleConnection import (
    TimescaleConnection as TimescaleConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition as ConnectionDefinition,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import run_test_connection
from metadata.ingestion.source.database.postgres.connection import PostgresConnection
from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.timescale.connection import TimescaleConnection
from metadata.ingestion.source.database.timescale.query_parser import (
    PostgresQueryParserSource as TimescaleQueryParserSource,
)

RELATIONS = [
    (None, "pg_stat_statements"),
    ("", "pg_stat_statements"),
    ("audit.query_history", "audit.query_history"),
    ('"audit"."Query Log"', '"audit"."Query Log"'),
]


@pytest.fixture
def metadata(connection):
    client = Mock(spec=OpenMetadata)
    client.get_by_name.return_value = ConnectionDefinition.model_validate(
        {
            "name": connection.service_connection.type.value,
            "steps": [
                {"name": "CheckAccess", "description": "Connect to the database", "mandatory": True},
                {"name": "GetQueries", "description": "Read query history", "mandatory": False},
            ],
        }
    )
    return client


@pytest.fixture(
    params=[(PostgresConfig, PostgresConnection), (TimescaleConfig, TimescaleConnection)],
    ids=["postgres", "timescale"],
)
def connection(request):
    config_class, connection_class = request.param
    config = config_class.model_validate(
        {
            "username": "example",
            "hostPort": "localhost:5432",
            "database": "example",
        }
    )
    engine = create_engine("sqlite://", poolclass=QueuePool)
    with engine.begin() as db:
        db.execute(text("ATTACH DATABASE ':memory:' AS audit"))

    with (
        patch.object(connection_class, "_get_client", return_value=engine),
        patch(
            "metadata.ingestion.source.database.postgres.connection.get_postgres_time_column_name",
            return_value="total_exec_time",
        ),
        patch(
            "metadata.ingestion.source.database.postgres.connection.POSTGRES_TEST_GET_QUERIES",
            "SELECT query FROM {query_statement_source} s",
        ),
        connection_class(config) as connection,
    ):
        yield connection
    engine.dispose()


def test_invalid_relation_fails_only_the_optional_query_history_step(connection, metadata):
    relation = "audit..query_history"
    connection.service_connection.queryStatementSource = relation

    result = connection.test_connection(metadata, timeout_seconds=None)

    access, query_history = result.steps
    assert access.name == "CheckAccess"
    assert access.passed
    assert query_history.name == "GetQueries"
    assert not query_history.passed
    assert not query_history.mandatory
    assert query_history.errorLog
    assert "Invalid queryStatementSource" in query_history.errorLog
    assert relation not in query_history.errorLog

    run_test_connection(metadata, connection)


@pytest.mark.parametrize(("relation", "expected"), RELATIONS)
def test_query_history_check_reads_the_configured_relation(connection, metadata, relation, expected):
    connection.service_connection.queryStatementSource = relation
    with connection.client.begin() as db:
        db.execute(text(f"CREATE TABLE {expected} (query TEXT)"))

    result = connection.test_connection(metadata, timeout_seconds=None)

    assert [(step.name, step.passed) for step in result.steps] == [
        ("CheckAccess", True),
        ("GetQueries", True),
    ]


class _ConcreteTimescaleQueryParser(TimescaleQueryParserSource):
    def _iter(self, *_, **__):
        raise NotImplementedError


@pytest.fixture
def query_parser():
    parser = object.__new__(_ConcreteTimescaleQueryParser)
    parser.sql_stmt = POSTGRES_SQL_STATEMENT
    parser.engine = MagicMock()
    parser.config = MagicMock()
    parser.config.sourceConfig.config.resultLimit = 100
    parser.get_filters = MagicMock(return_value="")
    parser.service_connection = MagicMock()
    with patch(
        "metadata.ingestion.source.database.timescale.query_parser.get_postgres_time_column_name",
        return_value="total_exec_time",
    ):
        yield parser


def test_query_parser_rejects_invalid_relation(query_parser):
    query_parser.service_connection.queryStatementSource = "audit..query_history"

    with pytest.raises(ValueError, match="Invalid queryStatementSource"):
        query_parser.get_sql_statement()


@pytest.mark.parametrize(("relation", "expected"), RELATIONS)
def test_query_parser_uses_default_or_configured_relation(query_parser, relation, expected):
    query_parser.service_connection.queryStatementSource = relation

    assert f"{expected} s" in query_parser.get_sql_statement()
