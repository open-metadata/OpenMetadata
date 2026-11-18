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
"""Tests for Snowflake view lineage through `IDENTIFIER('<name>')` tables."""

import pickle
import time
import uuid
from unittest.mock import MagicMock, patch

import pytest
import sqlglot
from sqlglot.errors import ParseError

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName, Uuid
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.source.database.snowflake import lineage_utils
from metadata.ingestion.source.database.snowflake.lineage import SnowflakeLineageSource
from metadata.ingestion.source.database.snowflake.lineage_utils import get_view_lineage_parser
from metadata.ingestion.source.models import TableView
from metadata.utils.db_utils import get_view_lineage

SERVICE = "snowflake_service"
VIEW_DEFINITION = (
    "CREATE OR REPLACE VIEW my_db.my_schema.my_view AS SELECT o.id, c.name "
    "FROM IDENTIFIER('my_db.my_schema.orders') o "
    "JOIN my_db.my_schema.customers c ON c.id = o.customer_id WHERE c.region = 'private-value'"
)


def _sources(parser: LineageParser) -> set[str]:
    return {str(table) for table in parser.source_tables}


def _table(name: str) -> Table:
    return Table(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=f"{SERVICE}.my_db.my_schema.{name}"),
        serviceType=DatabaseServiceType.Snowflake,
        columns=[],
    )


class TestSnowflakeViewLineage:
    """The generic view lineage resolves IDENTIFIER tables through the connector factory"""

    @pytest.fixture
    def metadata(self) -> MagicMock:
        search_cache.clear()
        tables = [_table("my_view"), _table("orders"), _table("customers")]
        metadata = MagicMock()
        metadata.es_search_from_fqn = lambda entity_type, fqn_search_string, **_: [
            table for table in tables if table.name.root in fqn_search_string.split(".")
        ]
        metadata.get_by_name = lambda entity, fqn=None, **_: next(
            (table for table in tables if table.fullyQualifiedName.root == fqn), None
        )
        return metadata

    def _edges(self, metadata: MagicMock, parser_factory) -> dict[str, str]:
        view = TableView(
            table_name="my_view", schema_name="my_schema", db_name="my_db", view_definition=VIEW_DEFINITION
        )
        results = list(
            get_view_lineage(
                view=view,
                metadata=metadata,
                service_names=SERVICE,
                connection_type="Snowflake",
                timeout_seconds=30,
                parser_type=QueryParserType.Auto,
                parser_factory=parser_factory,
            )
        )
        assert all(result.left is None for result in results), [result.left for result in results]
        original_masked_query = LineageParser(VIEW_DEFINITION, Dialect.SNOWFLAKE).masked_query
        edges = {}
        for result in results:
            request = result.right
            edges[request.from_entity_fqn] = request.to_entity_fqn
            assert request.lineage_details.sqlQuery.root == original_masked_query
        assert "IDENTIFIER(?)" in original_masked_query
        return edges

    def test_identifier_table_is_a_view_source(self, metadata):
        view_fqn = f"{SERVICE}.my_db.my_schema.my_view"
        assert self._edges(metadata, get_view_lineage_parser) == {
            f"{SERVICE}.my_db.my_schema.orders": view_fqn,
            f"{SERVICE}.my_db.my_schema.customers": view_fqn,
        }

    def test_the_connector_registers_a_picklable_factory(self):
        factory = SnowflakeLineageSource.get_view_lineage_parser_factory(MagicMock())
        assert factory is get_view_lineage_parser
        assert pickle.loads(pickle.dumps(factory)) is get_view_lineage_parser


def test_parser_carries_the_original_definition():
    original = LineageParser(VIEW_DEFINITION, Dialect.SNOWFLAKE)
    parser = get_view_lineage_parser(VIEW_DEFINITION, Dialect.SNOWFLAKE)
    assert _sources(parser) == {"my_db.my_schema.orders", "my_db.my_schema.customers"}
    assert [str(table) for table in parser.target_tables] == ["my_db.my_schema.my_view"]
    assert parser.query == VIEW_DEFINITION
    assert parser.query_hash == original.query_hash
    assert parser.masked_query == original.masked_query
    assert parser.query_parsing_success


@pytest.mark.parametrize(
    ("from_clause", "named_from_clause"),
    [
        ("""IDENTIFIER('"My Db"."My Schema"."Orders"') o""", '"My Db"."My Schema"."Orders" o'),
        ("IDENTIFIER('my_schema.orders') o", "my_schema.orders o"),
        ("IDENTIFIER('orders') o", "orders o"),
        ("identifier( 'orders' )o", "orders o"),
        ("IDENTIFIER('orders') AS o", "orders AS o"),
        ("IDENTIFIER /* source table */ ('orders') o", "orders o"),
        ("IDENTIFIER -- source table\n ('orders') o", "orders o"),
        (
            "IDENTIFIER('my_db.my_schema.orders') o JOIN IDENTIFIER('my_db.my_schema.customers') c ON c.id = o.id",
            "my_db.my_schema.orders o JOIN my_db.my_schema.customers c ON c.id = o.id",
        ),
    ],
)
def test_identifier_literal_resolves_to_the_named_table(from_clause, named_from_clause):
    query = f"CREATE VIEW my_db.my_schema.my_view AS SELECT o.id FROM {from_clause}"
    named_query = f"CREATE VIEW my_db.my_schema.my_view AS SELECT o.id FROM {named_from_clause}"
    expected = _sources(LineageParser(named_query, Dialect.SNOWFLAKE))
    assert expected
    assert _sources(get_view_lineage_parser(query, Dialect.SNOWFLAKE)) == expected


@pytest.mark.parametrize(
    "query",
    [
        "CREATE VIEW my_view AS SELECT id FROM IDENTIFIER($table_name)",
        "CREATE VIEW my_view AS SELECT id FROM IDENTIFIER(:table_name)",
        "CREATE VIEW my_view AS SELECT id FROM IDENTIFIER(?)",
        "CREATE VIEW my_view AS SELECT id FROM IDENTIFIER('my_db.' || $table_name)",
        "CREATE VIEW my_view AS SELECT 'IDENTIFIER(''orders'')' AS note FROM customers",
        "CREATE VIEW my_view AS SELECT $$IDENTIFIER('orders')$$ AS note FROM customers",
        "CREATE VIEW my_view AS SELECT id FROM customers -- IDENTIFIER('orders')",
        "CREATE VIEW my_view AS SELECT id /* IDENTIFIER('orders') */ FROM customers",
        "CREATE VIEW my_view AS SELECT my_schema.identifier('orders') AS note FROM customers",
    ],
)
def test_other_identifier_text_keeps_native_parsing(query):
    expected = LineageParser(query, Dialect.SNOWFLAKE)
    parser = get_view_lineage_parser(query, Dialect.SNOWFLAKE)
    assert _sources(parser) == _sources(expected)
    assert "<default>.orders" not in _sources(parser)
    assert parser.query == expected.query
    assert parser.masked_query == expected.masked_query
    assert parser.query_hash == expected.query_hash


def test_definition_without_identifier_is_parsed_once():
    query = "CREATE VIEW my_view AS SELECT id FROM my_db.my_schema.orders"
    with patch.object(lineage_utils.sqlglot, "parse_one", wraps=sqlglot.parse_one) as parse_one:
        parser = get_view_lineage_parser(query, Dialect.SNOWFLAKE)
    parse_one.assert_not_called()
    assert _sources(parser) == {"my_db.my_schema.orders"}


def test_failed_normalisation_keeps_native_parsing():
    expected = LineageParser(VIEW_DEFINITION, Dialect.SNOWFLAKE)
    with patch.object(lineage_utils.sqlglot, "parse_one", side_effect=ParseError("unsupported")):
        parser = get_view_lineage_parser(VIEW_DEFINITION, Dialect.SNOWFLAKE)
    assert _sources(parser) == _sources(expected)
    assert parser.masked_query == expected.masked_query


def test_failed_normalisation_logs_no_sql():
    error = ParseError("Invalid expression. Line 1, Col: 40. WHERE api_key = 'my-secret-value'")
    with (
        patch.object(lineage_utils.sqlglot, "parse_one", side_effect=error),
        patch.object(lineage_utils.logger, "warning") as warning,
    ):
        get_view_lineage_parser(VIEW_DEFINITION, Dialect.SNOWFLAKE)
    warning.assert_called_once()
    logged = warning.call_args.args[0] % warning.call_args.args[1:]
    assert "ParseError" in logged
    assert "my-secret-value" not in logged


@pytest.mark.parametrize("from_clause", ["orders t", "IDENTIFIER('orders') t"])
def test_long_comment_run_returns_promptly(from_clause):
    query = "SELECT t. " + "/* comment */ " * 24 + "id FROM " + from_clause
    start = time.monotonic()
    parser = get_view_lineage_parser(query, Dialect.SNOWFLAKE, timeout_seconds=10)
    assert time.monotonic() - start < 5
    assert parser.query == query
