#  Copyright 2025 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Query header injection for SQL Server and Azure SQL.
"""

import pytest

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.ingestion.connections.headers import (
    inject_inline_query_header,
    inject_query_header_by_conn,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_FOREIGN_KEY,
    MSSQL_GET_STORED_PROCEDURE_QUERIES,
    MSSQL_SQL_STATEMENT,
    MSSQL_SQL_STATEMENT_CURRENT_DB,
    MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
)

HEADER_START = '/* {"app": "OpenMetadata"'


def text_before_header(statement: str) -> str:
    return statement[: statement.index(HEADER_START)]


class TestInlineQueryHeader:
    """The header must land inside the statement, never ahead of its first token.

    A header that precedes the first token is batch preamble, which SQL Server
    does not keep in ``sys.query_store_query_text``.
    """

    @pytest.mark.parametrize(
        "statement",
        [
            "SELECT 1 AS a FROM sales.orders",
            "\nSELECT TOP 2 name FROM sys.databases",
            "\n SELECT name FROM sys.schemas",
            "\n\t  SELECT name FROM sys.schemas",
            "WITH x AS (SELECT 1 AS c) SELECT c FROM x",
            "(SELECT 1 AS a) UNION (SELECT 2)",
            "EXEC [my_catalog]..sp_addextendedproperty 'MS_Description'",
            "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
            "IF EXISTS (SELECT 1 FROM sys.tables) SELECT 1 AS a",
            "COMMIT",
            MSSQL_GET_FOREIGN_KEY,
            MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
        ],
    )
    def test_header_lands_inside_the_statement(self, statement):
        injected = inject_inline_query_header(statement)

        assert HEADER_START in injected
        assert text_before_header(injected).strip(), "header is ahead of the first token"

    def test_first_token_is_preserved_verbatim(self):
        injected = inject_inline_query_header("WITH x AS (SELECT 1 AS c) SELECT c FROM x")

        assert injected.startswith("WITH ")
        assert injected.endswith(" x AS (SELECT 1 AS c) SELECT c FROM x")

    def test_leading_whitespace_is_preserved(self):
        injected = inject_inline_query_header("\n  SELECT 1 AS a")

        assert injected.startswith("\n  SELECT ")

    def test_statement_already_commented_is_left_alone(self):
        statement = "/* dbt */ SELECT 1 AS a"

        assert inject_inline_query_header(statement) == statement

    def test_blank_statement_is_left_alone(self):
        assert inject_inline_query_header("   ") == "   "

    @pytest.mark.parametrize(
        "connection",
        [
            MssqlConnection(username="u", hostPort="h:1433", database="d"),
            AzureSQLConnection(username="u", hostPort="h:1433", database="d"),
        ],
    )
    def test_both_sql_server_connections_dispatch_to_the_inline_header(self, connection):
        statement, _ = inject_query_header_by_conn(connection, None, None, "SELECT 1 AS a", None, None, False)

        assert statement.startswith("SELECT " + HEADER_START)


class TestQueryStoreFilter:
    """The usage/lineage filters must not anchor the header at position 0.

    ``sp_executesql`` puts the parameter declarations in front of the statement,
    so an anchored pattern misses every parameterised query.
    """

    @pytest.mark.parametrize(
        "query",
        [
            MSSQL_SQL_STATEMENT,
            MSSQL_SQL_STATEMENT_CURRENT_DB,
            MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
            MSSQL_GET_STORED_PROCEDURE_QUERIES,
        ],
    )
    def test_no_filter_anchors_the_header_at_position_zero(self, query):
        assert "NOT LIKE '/*" not in query
        assert query.count("""NOT LIKE '%%/* {{"app":""") == 2
