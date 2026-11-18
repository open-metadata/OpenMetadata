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

"""
Validation of the Timescale queryStatementSource relation name.

queryStatementSource names a relation, so it is interpolated into the FROM
clause of the query-history SQL rather than bound as a parameter. The Postgres
module hardened both of its interpolation sites in f669f7d6a2 (#33477) by
routing the value through validate_query_statement_source; the Timescale
copies were left interpolating the raw, user-controlled value, which left the
rest of the statement open to being rewritten (e.g. via UNION SELECT).

These tests pin the same hardening for the Timescale copies so the raw
interpolation cannot be reintroduced: the live test-connection path in
timescale/connection.py and the (currently-unregistered) copy in
timescale/query_parser.py, which would silently regain effect if it were ever
registered again.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.postgres.utils import (
    DEFAULT_QUERY_STATEMENT_SOURCE,
)
from metadata.ingestion.source.database.timescale.connection import TimescaleConnection
from metadata.ingestion.source.database.timescale.query_parser import (
    PostgresQueryParserSource as TimescalePostgresQueryParserSource,
)

_CONNECTION_MODULE = "metadata.ingestion.source.database.timescale.connection"
_QUERY_PARSER_MODULE = "metadata.ingestion.source.database.timescale.query_parser"
# Payloads pulled from the bug report's exploit scenarios and the Postgres
# validator's existing regression set. Each must be rejected before the
# query-history SQL is built or executed, otherwise the FROM clause is open to
# being rewritten.
INJECTION_PAYLOADS = [
    # The exact exploit from the bug report - closes the relation and unions
    # in password hashes from pg_authid.
    "pg_stat_statements) UNION SELECT rolname, rolpassword FROM pg_authid --",
    # The file-read variant from the bug report.
    "pg_stat_statements) UNION SELECT current_user, pg_stat_file('/tmp/pwned') --",
    # The Postgres validator's regression set.
    "pg_stat_statements; DROP TABLE users--",
    "pg_stat_statements UNION SELECT 1,2,3,4--",
    "(SELECT 1)",
    "pg_stat_statements'",
    "pg_stat_statements WHERE 1=1",
    "a.b.c",
    "schema..relation",
    ".relation",
    "1relation",
    "pg_stat_statements\nUNION SELECT 1",
    "pg_stat_statements\n",
    '"x"; DROP TABLE y--',
    '"unterminated',
    '"a" OR 1=1',
    '"a"."b"."c"',
]


def _build_timescale_connection(query_statement_source):
    """Build a TimescaleConnection with a stubbed engine.

    The client (engine) is stubbed so _get_client / the auth strategy never
    runs; test_connection only reads service_connection.queryStatementSource
    and self.client, both of which a MagicMock covers.
    """
    service_connection = MagicMock()
    service_connection.queryStatementSource = query_statement_source
    connection = TimescaleConnection(service_connection)
    connection._client = MagicMock(name="engine")
    return connection


class _ConcreteTimescaleQueryParser(TimescalePostgresQueryParserSource):
    """Concrete subclass that stubs the one abstract method so object.__new__ can
    build an instance without running the full QueryParserSource.__init__."""

    def _iter(self, *_, **__):
        raise NotImplementedError


def _build_timescale_query_parser(query_statement_source):
    """Build the (unregistered) Timescale PostgresQueryParserSource.

    Bypassing __init__ is deliberate: we only exercise get_sql_statement, which
    reads the attributes wired up here. The class is dead code today -
    TimescaleUsageSource/TimescaleLineageSource inherit the *validated*
    PostgresQueryParserSource from postgres/query_parser.py - but pinning the
    validation here keeps it from silently regaining effect if it is ever
    registered again.

    A concrete subclass stubs the one abstract method (_iter) so object.__new__
    can build an instance without running the full QueryParserSource.__init__,
    which would require a complete WorkflowSource.
    """
    parser = object.__new__(_ConcreteTimescaleQueryParser)
    parser.sql_stmt = POSTGRES_SQL_STATEMENT
    parser.engine = MagicMock(name="engine")
    parser.config = MagicMock()
    parser.config.sourceConfig.config.resultLimit = 100
    parser.get_filters = MagicMock(return_value="")
    service_connection = MagicMock()
    service_connection.queryStatementSource = query_statement_source
    parser.service_connection = service_connection
    return parser


class TestTimescaleConnectionQueryStatementSource:
    """The live attack surface: TimescaleConnection.test_connection builds the
    GetQueries test-connection SQL by string-formatting queryStatementSource
    into the FROM clause. Validation must fire before any SQL is executed."""

    @pytest.mark.parametrize("payload", INJECTION_PAYLOADS)
    def test_malicious_payload_raises_before_the_sql_is_executed(self, payload):
        connection = _build_timescale_connection(payload)
        with (
            patch(f"{_CONNECTION_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"),
            patch(f"{_CONNECTION_MODULE}.test_connection_db_common") as mock_db_common,
            pytest.raises(ValueError, match="Invalid queryStatementSource"),
        ):
            connection.test_connection(metadata=MagicMock())

        # test_connection_db_common is what runs the formatted SQL against the
        # engine. Validation runs during the queries dict construction, which
        # happens entirely before test_connection_db_common is called, so the
        # injected payload can never reach the database.
        mock_db_common.assert_not_called()

    @pytest.mark.parametrize("empty", [None, ""])
    def test_empty_value_falls_back_to_the_default_relation(self, empty):
        connection = _build_timescale_connection(empty)
        with (
            patch(f"{_CONNECTION_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"),
            patch(f"{_CONNECTION_MODULE}.test_connection_db_common") as mock_db_common,
        ):
            connection.test_connection(metadata=MagicMock())

        get_queries = mock_db_common.call_args.kwargs["queries"]["GetQueries"]
        assert DEFAULT_QUERY_STATEMENT_SOURCE in get_queries
        # The default relation interpolates cleanly - no injection fragments
        # sneak through alongside it.
        assert "UNION" not in get_queries
        assert "--" not in get_queries
        assert ";" not in get_queries

    @pytest.mark.parametrize(
        "relation",
        [
            "pg_stat_statements",
            "pg_stat_monitor",
            "my_schema.custom_pg_stat_statements",
            "_leading_underscore",
            "with_digits_123",
            "with$dollar",
            '"Audit Schema"."Query Log"',
            '"quoted_only"',
        ],
    )
    def test_valid_identifier_is_interpolated_unchanged(self, relation):
        connection = _build_timescale_connection(relation)
        with (
            patch(f"{_CONNECTION_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"),
            patch(f"{_CONNECTION_MODULE}.test_connection_db_common") as mock_db_common,
        ):
            connection.test_connection(metadata=MagicMock())

        get_queries = mock_db_common.call_args.kwargs["queries"]["GetQueries"]
        # The identifier is interpolated verbatim into the FROM clause of the
        # test-connection query, right before the table alias `s`.
        assert f"{relation} s" in get_queries
        assert "UNION" not in get_queries
        assert ";" not in get_queries
        assert "--" not in get_queries


class TestTimescaleQueryParserQueryStatementSource:
    """Defense-in-depth for the (currently-unregistered) copy of the
    interpolation in timescale/query_parser.py. The class is dead code today,
    but the fix keeps it from silently regaining effect if it is ever
    registered again. This pins that fix."""

    @pytest.mark.parametrize("payload", INJECTION_PAYLOADS)
    def test_malicious_payload_raises_before_the_sql_statement_is_built(self, payload):
        parser = _build_timescale_query_parser(payload)
        with (
            patch(f"{_QUERY_PARSER_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"),
            pytest.raises(ValueError, match="Invalid queryStatementSource"),
        ):
            parser.get_sql_statement()

    @pytest.mark.parametrize("empty", [None, ""])
    def test_empty_value_falls_back_to_the_default_relation(self, empty):
        parser = _build_timescale_query_parser(empty)
        with patch(f"{_QUERY_PARSER_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"):
            statement = parser.get_sql_statement()

        assert DEFAULT_QUERY_STATEMENT_SOURCE in statement
        assert "UNION" not in statement
        assert ";" not in statement
        assert "--" not in statement

    @pytest.mark.parametrize(
        "relation",
        [
            "pg_stat_statements",
            "my_schema.custom_pg_stat_statements",
            '"Audit Schema"."Query Log"',
        ],
    )
    def test_valid_identifier_is_interpolated_unchanged(self, relation):
        parser = _build_timescale_query_parser(relation)
        with patch(f"{_QUERY_PARSER_MODULE}.get_postgres_time_column_name", return_value="total_exec_time"):
            statement = parser.get_sql_statement()

        assert f"{relation} s" in statement
        assert "UNION" not in statement
        assert ";" not in statement
        assert "--" not in statement
