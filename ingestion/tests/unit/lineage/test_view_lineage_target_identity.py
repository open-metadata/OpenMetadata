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
"""View lineage for a view whose definition only reads (no target table in the query)."""

import uuid
from queue import Queue
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import QueryParserType
from metadata.ingestion.api.step import IterStep, Summary
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    _view_target,
    get_lineage_via_table_entity,
    populate_column_lineage_map,
    search_cache,
)
from metadata.ingestion.source.database.clickhouse.lineage_utils import get_mv_target_lineage, get_view_lineage_parser
from metadata.ingestion.source.database.lineage_processors import view_lineage_processor
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage


def _table(table_fqn: str) -> Table:
    return Table(
        id=uuid.uuid4(),
        name=fqn.split(table_fqn)[-1].strip('"'),
        fullyQualifiedName=table_fqn,
        columns=[Column(name="id", dataType=DataType.INT, fullyQualifiedName=f"{table_fqn}.id")],
        serviceType=DatabaseServiceType.Mssql,
    )


@pytest.mark.parametrize(
    ("view", "view_fqn", "lookalike_fqn"),
    [
        (
            TableView(db_name="db", schema_name="dbo.reporting", table_name="orders"),
            'svc.db."dbo.reporting".orders',
            "svc.dbo.reporting.orders",
        ),
        (
            TableView(db_name="db", schema_name="reporting", table_name="warehouse.orders"),
            'svc.db.reporting."warehouse.orders"',
            "svc.reporting.warehouse.orders",
        ),
    ],
)
def test_select_only_view_lineage_targets_the_view(view, view_fqn, lookalike_fqn):
    """The edge goes to the view that was looked up, not to a table whose name looks the same once the dots are joined."""
    view = view.model_copy(update={"view_definition": "SELECT * FROM src"})
    view_entity = _table(view_fqn)
    source = _table("svc.db.reporting.src")
    lookalike = _table(lookalike_fqn)

    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: view_entity if fqn == view_fqn else None

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        found = {view_fqn: [view_entity], lookalike_fqn: [lookalike]}
        if fqn_search_string.endswith(".src"):
            return [source]
        return found.get(fqn_search_string, [])

    metadata.es_search_from_fqn.side_effect = es_search_from_fqn

    results = list(
        get_view_lineage(
            view=view,
            metadata=metadata,
            service_names="svc",
            connection_type="Mssql",
            timeout_seconds=10,
            parser_type="Auto",
        )
    )

    edges = [(result.right.from_entity_fqn, result.right.to_entity_fqn) for result in results if result.right]
    assert edges == [("svc.db.reporting.src", view_fqn)]


def test_table_entity_lineage_uses_the_given_entity_as_target():
    """`get_lineage_via_table_entity` does not resolve its target again by name."""
    view_entity = _table('svc.db."dbo.reporting".orders')
    source = _table("svc.db.reporting.src")
    metadata = MagicMock()
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [source] if fqn_search_string.endswith(".src") else []
    )
    query = "SELECT * FROM src"

    results = list(
        get_lineage_via_table_entity(
            metadata,
            table_entity=view_entity,
            database_name="db",
            schema_name="dbo.reporting",
            service_names="svc",
            query=query,
            dialect=Dialect.TSQL,
            lineage_parser=LineageParser(query, Dialect.TSQL),
        )
    )

    (result,) = results
    assert result.right.to_entity_fqn == 'svc.db."dbo.reporting".orders'


@pytest.mark.parametrize(
    ("view", "view_fqn", "lookalike_fqn"),
    [
        (
            TableView(db_name="db", schema_name="reporting", table_name="warehouse.orders"),
            'svc.db.reporting."warehouse.orders"',
            "svc.db.warehouse.orders",
        ),
        (
            TableView(db_name="db", schema_name="dbo.reporting", table_name="orders"),
            'svc.db."dbo.reporting".orders',
            "svc.dbo.reporting.orders",
        ),
    ],
)
def test_create_view_lineage_targets_the_view(view, view_fqn, lookalike_fqn):
    """A full CREATE VIEW definition sends its edge to the view, not to a lookalike table."""
    schema = view.schema_name if "." not in view.schema_name else f"[{view.schema_name}]"
    name = view.table_name if "." not in view.table_name else f"[{view.table_name}]"
    view = view.model_copy(update={"view_definition": f"CREATE VIEW {schema}.{name} AS SELECT id FROM src"})
    view_entity = _table(view_fqn)
    source = _table("svc.db.reporting.src")
    lookalike = _table(lookalike_fqn)

    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: view_entity if fqn == view_fqn else None

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        if fqn_search_string.endswith(".src"):
            return [source]
        if fqn_search_string == view_fqn:
            return [view_entity]
        # Anything resolved by the dotted name finds the lookalike.
        return [lookalike]

    metadata.es_search_from_fqn.side_effect = es_search_from_fqn

    results = list(
        get_view_lineage(
            view=view,
            metadata=metadata,
            service_names="svc",
            connection_type="Mssql",
            timeout_seconds=10,
            parser_type="Auto",
        )
    )

    edges = [(result.right.from_entity_fqn, result.right.to_entity_fqn) for result in results if result.right]
    assert edges == [("svc.db.reporting.src", view_fqn)]
    (result,) = results
    assert result.right.to_entity_id == view_entity.id
    (column_lineage,) = result.right.lineage_details.columnsLineage
    assert [column.root for column in column_lineage.fromColumns] == ["svc.db.reporting.src.id"]
    assert column_lineage.toColumn.root == f"{view_fqn}.id"
    parser = LineageParser(view.view_definition, Dialect.TSQL, parser_type="Auto")
    raw_columns = populate_column_lineage_map(parser.column_lineage)
    assert str(parser.target_tables[0]) in raw_columns


@pytest.mark.parametrize(
    ("view_fqn", "target", "matches"),
    [
        ("svc.db.schema1.orders", "orders", True),
        ("svc.db.schema1.orders", "schema1.orders", True),
        ("svc.db.schema1.orders", "db.schema1.orders", True),
        ("svc.db.schema1.orders", "SCHEMA1.ORDERS", True),
        ("svc.db.schema1.orders", "schema2.orders", False),
        ("svc.db.schema1.orders", "<default>.orders", True),
        ("svc.db.schema1.orders", "<default>.other", False),
        ("svc.db.schema1.orders", "otherdb.schema1.orders", False),
        ("svc.db.schema1.orders", "other.schema1.orders", False),
        ("svc.db.schema1.orders", "svc.db.schema1.orders", False),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "[warehouse.orders]", True),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "[schema.one].[warehouse.orders]", True),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "`db.prod`.`schema.one`.`warehouse.orders`", True),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "other.warehouse.orders", False),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "<default>.warehouse.orders", True),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "<default>.[warehouse.orders]", True),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "other.schema.one.warehouse.orders", False),
        ('svc."db.prod"."schema.one"."warehouse.orders"', "db.other.schema.one.warehouse.orders", False),
    ],
)
def test_view_target_respects_catalog_qualifications(view_fqn, target, matches):
    view_entity = _table(view_fqn)
    assert _view_target(view_entity, target) == ([view_entity] if matches else None)


@pytest.mark.parametrize("parser_type", [QueryParserType.Auto, "Auto"])
def test_materialized_view_processor_preserves_distinct_same_name_target(parser_type):
    """Both the parsed intermediate hop and ClickHouse TO extension retain the target identity."""
    search_cache.clear()
    view_entity = _table("svc.db.schema1.orders")
    source = _table("svc.db.schema1.src")
    target = _table("svc.db.schema2.orders")
    entities = {entity.fullyQualifiedName.root: entity for entity in (view_entity, source, target)}
    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: entities.get(fqn)
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [entities[fqn_search_string]] if fqn_search_string in entities else []
    )
    query = "CREATE MATERIALIZED VIEW schema1.orders TO schema2.orders AS SELECT id FROM schema1.src"
    parser = LineageParser(query, Dialect.CLICKHOUSE, parser_type="Auto")
    assert [str(table) for table in parser.intermediate_tables] == ["schema1.orders"]
    assert [str(table) for table in parser.target_tables] == ["schema2.orders"]
    queue = Queue()
    try:
        view_lineage_processor(
            views=[TableView(db_name="db", schema_name="schema1", table_name="orders", view_definition=query)],
            queue=queue,
            metadata=metadata,
            service_name="svc",
            connectionType="Clickhouse",
            processCrossDatabaseLineage=False,
            crossDatabaseServiceNames=[],
            parsingTimeoutLimit=10,
            overrideViewLineage=True,
            parser_type=parser_type,
            extension=get_mv_target_lineage,
            parser_factory=get_view_lineage_parser,
        )
        results = []
        while not queue.empty():
            result = queue.get_nowait()
            assert result.left is None
            results.append(result.right)
        assert len(results) == 2
        for result in results:
            edge = result.lineage_request
            assert edge.lineage_details.sqlQuery.root == query
            assert edge.from_entity_id != edge.to_entity_id
            assert edge.from_entity_id == entities[edge.from_entity_fqn].id
            assert edge.to_entity_id == entities[edge.to_entity_fqn].id
        upstream = [result for result in results if result.lineage_request.from_entity_id == source.id]
        assert len(upstream) == 1
        assert upstream[0].lineage_request.to_entity_fqn == view_entity.fullyQualifiedName.root
        assert upstream[0].override_lineage is True
        downstream = [result for result in results if result.lineage_request.from_entity_id == view_entity.id]
        assert len(downstream) == 1
        assert all(result.lineage_request.to_entity_fqn == target.fullyQualifiedName.root for result in downstream)
        assert all(result.override_lineage is False for result in downstream)
    finally:
        search_cache.clear()


def test_view_target_without_fetched_entity():
    assert _view_target(None, "schema.orders") is None


def test_view_target_without_fqn_only_matches_exact_leaf_name():
    view_entity = _table("svc.db.schema.orders").model_copy(update={"fullyQualifiedName": None})
    assert _view_target(view_entity, "orders") == [view_entity]
    assert _view_target(view_entity, "schema.orders") is None


@pytest.mark.parametrize("parser_type", [QueryParserType.Auto, "Auto"])
def test_materialized_view_processor_does_not_reverse_collapsed_dotted_target(parser_type):
    search_cache.clear()
    view_entity = _table('svc.db.schema1."schema2.orders"')
    source = _table("svc.db.schema1.src")
    target = _table("svc.db.schema2.orders")
    entities = {entity.fullyQualifiedName.root: entity for entity in (view_entity, source, target)}
    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: entities.get(fqn)
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [entities[fqn_search_string]] if fqn_search_string in entities else []
    )
    query = "CREATE MATERIALIZED VIEW schema1.`schema2.orders` TO schema2.orders AS SELECT id FROM schema1.src"
    parser = LineageParser(query, Dialect.CLICKHOUSE, parser_type="Auto")
    (parsed_target,) = parser.target_tables
    assert str(parsed_target) == "schema2.orders"
    assert parsed_target in parser.source_tables
    assert not parser.intermediate_tables
    queue = Queue()
    try:
        view_lineage_processor(
            views=[TableView(db_name="db", schema_name="schema1", table_name="schema2.orders", view_definition=query)],
            queue=queue,
            metadata=metadata,
            service_name="svc",
            connectionType="Clickhouse",
            processCrossDatabaseLineage=False,
            crossDatabaseServiceNames=[],
            parsingTimeoutLimit=10,
            overrideViewLineage=True,
            parser_type=parser_type,
            extension=get_mv_target_lineage,
            parser_factory=get_view_lineage_parser,
        )
        results = []
        while not queue.empty():
            result = queue.get_nowait()
            assert result.left is None
            results.append(result.right)
        assert len(results) == 2
        assert all(result.lineage_request.lineage_details.sqlQuery.root == query for result in results)
        edges = {
            (result.lineage_request.from_entity_fqn, result.lineage_request.to_entity_fqn): result for result in results
        }
        upstream = edges[(source.fullyQualifiedName.root, view_entity.fullyQualifiedName.root)]
        downstream = edges[(view_entity.fullyQualifiedName.root, target.fullyQualifiedName.root)]
        assert upstream.lineage_request.from_entity_id == source.id
        assert upstream.lineage_request.to_entity_id == view_entity.id
        assert upstream.override_lineage is True
        assert downstream.lineage_request.from_entity_id == view_entity.id
        assert downstream.lineage_request.to_entity_id == target.id
        assert downstream.override_lineage is False
        (column,) = upstream.lineage_request.lineage_details.columnsLineage
        assert [name.root for name in column.fromColumns] == [f"{source.fullyQualifiedName.root}.id"]
        assert column.toColumn.root == f"{view_entity.fullyQualifiedName.root}.id"
    finally:
        search_cache.clear()


@pytest.mark.parametrize("use_factory", [False, True])
def test_ordinary_dotted_view_keeps_distinct_input_with_same_parsed_name(use_factory):
    search_cache.clear()
    view_entity = _table('svc.db.schema1."schema2.orders"')
    parsed_entity = _table("svc.db.schema2.orders")
    source = _table("svc.db.schema1.src")
    entities = {entity.fullyQualifiedName.root: entity for entity in (view_entity, parsed_entity, source)}
    metadata = MagicMock()
    metadata.get_by_name.side_effect = lambda entity, fqn, **_: entities.get(fqn)
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [entities[fqn_search_string]] if fqn_search_string in entities else []
    )
    query = "CREATE VIEW schema1.`schema2.orders` AS SELECT id FROM schema2.orders UNION ALL SELECT id FROM schema1.src"
    parser = LineageParser(query, Dialect.CLICKHOUSE, parser_type="Auto")
    (parsed_target,) = parser.target_tables
    assert parsed_target in parser.source_tables
    assert not parser.intermediate_tables
    try:
        results = list(
            get_view_lineage(
                view=TableView(db_name="db", schema_name="schema1", table_name="schema2.orders", view_definition=query),
                metadata=metadata,
                service_names="svc",
                connection_type="Clickhouse",
                timeout_seconds=10,
                parser_type="Auto",
                parser_factory=get_view_lineage_parser if use_factory else None,
            )
        )
        assert all(result.left is None for result in results)
        edges = {(result.right.from_entity_fqn, result.right.to_entity_fqn) for result in results}
        assert edges == {
            (source.fullyQualifiedName.root, view_entity.fullyQualifiedName.root),
            (parsed_entity.fullyQualifiedName.root, view_entity.fullyQualifiedName.root),
        }
    finally:
        search_cache.clear()


@pytest.mark.parametrize(
    ("schema_name", "table_name", "view_fqn"),
    [
        ("reporting", "missing", "svc.db.reporting.missing"),
        ("dbo.reporting", "missing", 'svc.db."dbo.reporting".missing'),
        ("reporting", "warehouse.missing", 'svc.db.reporting."warehouse.missing"'),
    ],
)
@pytest.mark.parametrize("failure_mode", ["missing", "lookup_error", "search_error"])
def test_view_lookup_failure_is_named_and_later_view_continues(schema_name, table_name, view_fqn, failure_mode):
    search_cache.clear()
    valid_view = _table("svc.db.reporting.orders")
    source = _table("svc.db.reporting.src")
    metadata = MagicMock()

    def lookup(entity, fqn, **_):
        if fqn == view_fqn and failure_mode == "lookup_error":
            raise RuntimeError("catalog lookup unavailable")
        return valid_view if fqn == valid_view.fullyQualifiedName.root else None

    def search(entity_type, fqn_search_string, **_):
        if fqn_search_string == view_fqn and failure_mode == "search_error":
            raise RuntimeError("catalog search unavailable")
        return [source] if fqn_search_string.endswith(".src") else []

    metadata.get_by_name.side_effect = lookup
    metadata.es_search_from_fqn.side_effect = search
    queue = Queue()
    query = "CREATE VIEW reporting.orders AS SELECT id FROM src WHERE id = 987654321"
    try:
        view_lineage_processor(
            views=[
                TableView(db_name="db", schema_name=schema_name, table_name=table_name, view_definition=query),
                TableView(db_name="db", schema_name="reporting", table_name="orders", view_definition=query),
            ],
            queue=queue,
            metadata=metadata,
            service_name="svc",
            connectionType="Mssql",
            processCrossDatabaseLineage=False,
            crossDatabaseServiceNames=[],
            parsingTimeoutLimit=10,
            overrideViewLineage=True,
            parser_type=QueryParserType.Auto,
        )
        results = list(queue.queue)
        assert len(results) == 2
        failure, success = results
        assert failure.right is None
        assert failure.left.name == view_fqn
        assert f"Could not resolve view [{view_fqn}]" in failure.left.error
        cause = {
            "missing": "View entity not found in the catalog",
            "lookup_error": "catalog lookup unavailable",
            "search_error": "catalog search unavailable",
        }[failure_mode]
        assert cause in failure.left.error
        assert cause in failure.left.stackTrace
        assert "987654321" not in failure.left.model_dump_json()
        assert success.left is None
        request = success.right.lineage_request
        assert (request.from_entity_fqn, request.to_entity_fqn) == ("svc.db.reporting.src", "svc.db.reporting.orders")
        assert (request.from_entity_id, request.to_entity_id) == (source.id, valid_view.id)
        assert (
            request.lineage_details.sqlQuery.root == "CREATE VIEW reporting.orders AS SELECT id FROM src WHERE id = ?"
        )
        assert success.right.override_lineage is True
        (column,) = request.lineage_details.columnsLineage
        assert [name.root for name in column.fromColumns] == ["svc.db.reporting.src.id"]
        assert column.toColumn.root == "svc.db.reporting.orders.id"

        class QueuedLineageStep(IterStep):
            name = "View lineage"

            @classmethod
            def create(cls, config_dict, metadata, pipeline_name=None):
                return cls()

            def close(self):
                pass

            def _iter(self):
                yield from results

        step = QueuedLineageStep()
        assert list(step.run()) == [None, success.right]
        summary = Summary.from_step(step)
        assert summary.errors == 1
        assert summary.failures[0].name == view_fqn
        assert cause in summary.failures[0].error
    finally:
        search_cache.clear()


@pytest.mark.parametrize("definition", [None, ""])
def test_view_without_definition_skips_missing_catalog_entity(definition):
    metadata = MagicMock()
    metadata.get_by_name.return_value = None
    metadata.es_search_from_fqn.return_value = []
    assert (
        list(
            get_view_lineage(
                view=TableView(db_name="db", schema_name="reporting", table_name="missing", view_definition=definition),
                metadata=metadata,
                service_names="svc",
                connection_type="Mssql",
                timeout_seconds=10,
                parser_type=QueryParserType.Auto,
            )
        )
        == []
    )


@pytest.mark.parametrize("failure_stage", ["parser", "extension"])
def test_view_lookup_fix_preserves_parser_and_extension_recovery(failure_stage):
    search_cache.clear()
    view = _table("svc.db.reporting.orders")
    source = _table("svc.db.reporting.src")
    metadata = MagicMock()
    metadata.get_by_name.return_value = view
    metadata.es_search_from_fqn.side_effect = lambda entity_type, fqn_search_string, **_: (
        [source] if fqn_search_string.endswith(".src") else []
    )

    def fail(*_, **__):
        raise RuntimeError("connector parsing failed")

    try:
        results = list(
            get_view_lineage(
                view=TableView(
                    db_name="db", schema_name="reporting", table_name="orders", view_definition="SELECT id FROM src"
                ),
                metadata=metadata,
                service_names="svc",
                connection_type="Mssql",
                timeout_seconds=10,
                parser_type=QueryParserType.Auto,
                parser_factory=fail if failure_stage == "parser" else None,
                extension=fail if failure_stage == "extension" else None,
            )
        )
        assert all(result.left is None for result in results)
        assert [(result.right.from_entity_fqn, result.right.to_entity_fqn) for result in results] == (
            [] if failure_stage == "parser" else [("svc.db.reporting.src", "svc.db.reporting.orders")]
        )
    finally:
        search_cache.clear()
