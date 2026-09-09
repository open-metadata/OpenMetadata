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
"""Native lineage SQL enrichment, executing the connector queries against SQLite."""

import json
import re
from collections import defaultdict
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import jsonpatch
import pytest
from sqlalchemy import bindparam, create_engine, event, text
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.unitycatalog.lineage import UnitycatalogLineageSource
from metadata.ingestion.source.database.unitycatalog.queries import UNITY_CATALOG_LINEAGE_SQL

SOURCE = "my_catalog.my_schema.my_source"
TARGET = "my_catalog.my_schema.my_target"
SQL = "INSERT INTO my_catalog.my_schema.my_target SELECT id FROM my_catalog.my_schema.my_source"


@pytest.fixture
def warehouse():
    engine = create_engine("sqlite://")
    state = SimpleNamespace(engine=engine, batches=[], history_error=None, fail_batch=1)
    with engine.begin() as conn:
        conn.execute(text("ATTACH DATABASE ':memory:' AS access"))
        conn.execute(text("ATTACH DATABASE ':memory:' AS query"))
        conn.execute(text("ATTACH DATABASE ':memory:' AS information_schema"))
        conn.execute(
            text(
                "CREATE TABLE information_schema.tables (table_catalog TEXT, table_schema TEXT, table_name TEXT, storage_path TEXT, table_type TEXT)"
            )
        )
        conn.execute(
            text("""
            CREATE TABLE access.table_lineage (
                source_table_full_name TEXT, target_table_full_name TEXT,
                statement_id TEXT, workspace_id TEXT, event_time TEXT, event_date TEXT
            )
        """)
        )
        conn.execute(
            text("""
            CREATE TABLE access.column_lineage (
                source_table_full_name TEXT, target_table_full_name TEXT,
                source_column_name TEXT, target_column_name TEXT, event_time TEXT
            )
        """)
        )
        conn.execute(text("CREATE TABLE query.history (statement_id TEXT, workspace_id TEXT, statement_text TEXT)"))
        state.today = datetime.fromisoformat(conn.execute(text("SELECT current_date")).scalar_one())

    @event.listens_for(engine, "before_cursor_execute", retval=True)
    def execute_databricks_sql(_conn, _cursor, statement, parameters, _context, _executemany):
        if "system.query.history" in statement:
            state.batches.append(len(parameters) // 2)
            if state.history_error and len(state.batches) >= state.fail_batch:
                raise OperationalError(None, None, state.history_error)
        # Adapt only catalog qualification and date syntax; execute joins, ranking and bindings unchanged.
        statement = (
            statement.replace("system.access.", "access.")
            .replace("system.query.", "query.")
            .replace("system.information_schema.", "information_schema.")
        )
        statement = re.sub(r"current_date\(\) - INTERVAL (\d+) DAYS", r"date('now', '-\1 days')", statement)
        return statement, parameters

    yield state
    engine.dispose()


def add_event(warehouse, statement_id="my_statement", source=SOURCE, target=TARGET, days_ago=0, hour=1):
    timestamp = warehouse.today - timedelta(days=days_ago) + timedelta(hours=hour)
    with warehouse.engine.begin() as conn:
        conn.execute(
            text("INSERT INTO access.table_lineage VALUES (:source, :target, :id, :workspace, :time, :date)"),
            {
                "source": source,
                "target": target,
                "id": statement_id,
                "workspace": "my_workspace",
                "time": timestamp.isoformat(sep=" "),
                "date": timestamp.date().isoformat(),
            },
        )


def add_query(warehouse, statement_id="my_statement", sql=SQL, workspace="my_workspace"):
    with warehouse.engine.begin() as conn:
        conn.execute(
            text("INSERT INTO query.history VALUES (:id, :workspace, :sql)"),
            {"id": statement_id, "workspace": workspace, "sql": sql},
        )


def make_table(native_name):
    catalog, schema, name = native_name.split(".")
    return Table(
        id=uuid4(),
        name=name,
        fullyQualifiedName=f"my_service.{native_name}",
        columns=[Column(name="id", dataType=DataType.INT, fullyQualifiedName=f"my_service.{native_name}.id")],
        database=EntityReference(id=uuid4(), type="database", name=catalog),
        databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name=schema),
    )


def make_source(warehouse, upstream_names=(SOURCE,)):
    source = UnitycatalogLineageSource.__new__(UnitycatalogLineageSource)
    source.engine = warehouse.engine
    source.table_lineage_map = defaultdict(set)
    source.column_lineage_map = defaultdict(list)
    source.external_location_map = {}
    source.source_config = SimpleNamespace(
        queryLogDuration=1, databaseFilterPattern=None, schemaFilterPattern=None, tableFilterPattern=None
    )
    source.status = Status()
    source.config = SimpleNamespace(serviceName="my_service")
    source._query_history_available = True
    tables = {f"my_service.{name}": make_table(name) for name in upstream_names}
    source.metadata = SimpleNamespace(
        get_by_name=lambda entity, fqn: tables.get(fqn),
        es_search_from_fqn=lambda **kwargs: None,
        tables=tables,
    )
    return source


def requests(source, target=TARGET):
    targets = [target] if isinstance(target, str) else target
    for name in targets:
        source.metadata.tables.setdefault(f"my_service.{name}", make_table(name))
    databases = {}
    schemas = {}
    for name in source.metadata.tables:
        service, catalog, schema, _ = name.split(".")
        database_fqn = f"{service}.{catalog}"
        schema_fqn = f"{database_fqn}.{schema}"
        databases.setdefault(
            database_fqn,
            SimpleNamespace(name=SimpleNamespace(root=catalog), fullyQualifiedName=SimpleNamespace(root=database_fqn)),
        )
        schemas.setdefault(
            schema_fqn,
            SimpleNamespace(name=SimpleNamespace(root=schema), fullyQualifiedName=SimpleNamespace(root=schema_fqn)),
        )

    def list_entities(entity, params):
        if entity is Database:
            return iter(databases.values())
        if entity is DatabaseSchema:
            return (schema for name, schema in schemas.items() if name.rsplit(".", 1)[0] == params["database"])
        assert entity is Table
        return (
            table
            for name, table in source.metadata.tables.items()
            if name.rsplit(".", 1)[0] == params["databaseSchema"]
        )

    source.metadata.list_all_entities = list_entities
    results = list(source._iter())
    assert all(result.right is not None and result.left is None for result in results)
    return [result.right for result in results]


@pytest.mark.parametrize("column_name", [None, "id", "missing_column"])
def test_sql_is_attached_with_or_without_resolved_columns(warehouse, column_name):
    add_event(warehouse)
    add_query(warehouse)
    if column_name:
        with warehouse.engine.begin() as conn:
            conn.execute(
                text("INSERT INTO access.column_lineage VALUES (:source, :target, :column, :column, :time)"),
                {"source": SOURCE, "target": TARGET, "column": column_name, "time": warehouse.today.isoformat()},
            )
    [request] = requests(make_source(warehouse))
    details = request.edge.lineageDetails
    assert model_str(details.sqlQuery) == SQL
    assert details.source == LineageSource.QueryLineage
    assert request.model_dump(mode="json")["edge"]["lineageDetails"]["sqlQuery"] == SQL
    if column_name == "id":
        [mapping] = details.columnsLineage
        assert [model_str(column) for column in mapping.fromColumns] == ["my_service.my_catalog.my_schema.my_source.id"]
        assert model_str(mapping.toColumn) == "my_service.my_catalog.my_schema.my_target.id"
    else:
        assert not details.columnsLineage


@pytest.mark.parametrize("unavailable_sql", [None, "", "  ", "<REDACTED>", " <redacted> "])
def test_latest_unavailable_text_does_not_hide_an_older_query(warehouse, unavailable_sql):
    add_event(warehouse, "older_statement", hour=1)
    add_query(warehouse, "older_statement")
    add_event(warehouse, "newer_statement", hour=2)
    add_query(warehouse, "newer_statement", sql=unavailable_sql)
    [request] = requests(make_source(warehouse))
    assert model_str(request.edge.lineageDetails.sqlQuery) == SQL


def test_latest_event_wins_with_deterministic_statement_ties(warehouse):
    for statement_id, hour, sql in [
        ("statement_z", 1, "SELECT 1"),
        ("statement_b", 2, "SELECT 2"),
        ("statement_a", 2, "SELECT 3"),
    ]:
        add_event(warehouse, statement_id, hour=hour)
        add_query(warehouse, statement_id, sql=sql)
    [request] = requests(make_source(warehouse))
    assert model_str(request.edge.lineageDetails.sqlQuery) == "SELECT 2"


@pytest.mark.parametrize(
    "missing", ["statement_id", "history_row", "text", "workspace", "history_table", "statement_column"]
)
def test_missing_query_information_preserves_native_edges_and_columns(warehouse, missing):
    add_event(warehouse, statement_id=None if missing == "statement_id" else "my_statement")
    if missing == "text":
        add_query(warehouse, sql="<REDACTED>")
    if missing == "workspace":
        add_query(warehouse, workspace="other_workspace")
    with warehouse.engine.begin() as conn:
        conn.execute(
            text("INSERT INTO access.column_lineage VALUES (:source, :target, 'id', 'id', :time)"),
            {"source": SOURCE, "target": TARGET, "time": warehouse.today.isoformat()},
        )
        if missing == "history_table":
            conn.execute(text("DROP TABLE query.history"))
        if missing == "statement_column":
            conn.execute(text("ALTER TABLE access.table_lineage DROP COLUMN statement_id"))
    [request] = requests(make_source(warehouse))
    details = request.edge.lineageDetails
    assert details.sqlQuery is None
    [mapping] = details.columnsLineage
    assert [model_str(column) for column in mapping.fromColumns] == ["my_service.my_catalog.my_schema.my_source.id"]
    assert model_str(mapping.toColumn) == "my_service.my_catalog.my_schema.my_target.id"


def test_query_selection_is_scoped_to_table_pair_and_lookback(warehouse):
    add_event(warehouse)
    add_query(warehouse)
    add_event(warehouse, "old_statement", days_ago=2)
    add_query(warehouse, "old_statement", sql="SELECT 2")
    add_event(warehouse, "other_target", target="my_catalog.my_schema.other_target", hour=3)
    add_query(warehouse, "other_target", sql="SELECT 3")
    add_event(warehouse, "other_source", source="my_catalog.my_schema.other_source", hour=3)
    add_query(warehouse, "other_source", sql="SELECT 4")
    [request] = requests(make_source(warehouse))
    assert model_str(request.edge.lineageDetails.sqlQuery) == SQL


def test_lookback_configuration_controls_sql_selection(warehouse):
    add_event(warehouse, days_ago=2)
    add_query(warehouse)
    source = make_source(warehouse)
    assert requests(source) == []
    source.source_config.queryLogDuration = 3
    source._cache_lineage()
    [request] = requests(source)
    assert model_str(request.edge.lineageDetails.sqlQuery) == SQL


@pytest.mark.parametrize("history_denied", [False, True])
def test_all_edges_survive_batch_boundaries_and_history_access_failure(warehouse, history_denied):
    names = [f"my_catalog.my_schema.my_source_{index}" for index in range(205)]
    for index, name in enumerate(names):
        add_event(warehouse, statement_id=f"my_statement_{index}", source=name)
        add_query(warehouse, statement_id=f"my_statement_{index}", sql=f"SELECT {index}")
    if history_denied:
        warehouse.history_error = PermissionError("Query history access denied")
    results = requests(make_source(warehouse, names))
    assert len(results) == 205
    assert len({model_str(request.edge.fromEntity.id) for request in results}) == 205
    if history_denied:
        assert all(request.edge.lineageDetails.sqlQuery is None for request in results)
        assert warehouse.batches == [100]
    else:
        assert {model_str(request.edge.lineageDetails.sqlQuery) for request in results} == {
            f"SELECT {index}" for index in range(205)
        }
        assert warehouse.batches == [100, 100, 5]


@pytest.mark.parametrize(
    "edge_count,expected_batches", [(0, []), (100, [100]), (101, [100, 1]), (205, [100, 100, 5]), (1000, [100] * 10)]
)
def test_batches_span_targets_schemas_and_catalogs(warehouse, edge_count, expected_batches):
    targets = [f"my_catalog_{index % 2}.my_schema_{index % 3}.my_target_{index}" for index in range(edge_count)]
    for index, target in enumerate(targets):
        add_event(warehouse, statement_id=f"statement_{index}", target=target)
        add_query(warehouse, statement_id=f"statement_{index}", sql=f"SELECT {index}")
    source = make_source(warehouse)
    results = requests(source, targets)
    expected = {
        model_str(source.metadata.tables[f"my_service.{target}"].id): f"SELECT {index}"
        for index, target in enumerate(targets)
    }
    assert len(results) == edge_count
    assert {
        model_str(result.edge.toEntity.id): model_str(result.edge.lineageDetails.sqlQuery) for result in results
    } == expected
    assert warehouse.batches == expected_batches


def test_sql_query_selects_only_requested_pairs(warehouse):
    other_source = "my_catalog.my_schema.other_source"
    other_target = "my_catalog.my_schema.other_target"
    for index, (source, target) in enumerate(
        [(SOURCE, TARGET), (other_source, other_target), (SOURCE, other_target), (other_source, TARGET)]
    ):
        add_event(warehouse, statement_id=f"statement_{index}", source=source, target=target)
        add_query(warehouse, statement_id=f"statement_{index}", sql=f"SELECT {index}")
    statement = text(UNITY_CATALOG_LINEAGE_SQL.format(query_log_duration=1)).bindparams(
        bindparam("table_pairs", expanding=True)
    )
    with warehouse.engine.connect() as conn:
        rows = conn.execute(statement, {"table_pairs": [(SOURCE, TARGET), (other_source, other_target)]}).all()
    assert {(row.source_table_full_name, row.target_table_full_name, row.statement_text) for row in rows} == {
        (SOURCE, TARGET, "SELECT 0"),
        (other_source, other_target, "SELECT 1"),
    }


@pytest.mark.parametrize("fail_batch", [1, 2])
def test_history_failure_preserves_all_target_edges_and_column_mappings(warehouse, fail_batch):
    targets = [f"my_catalog.my_schema.my_target_{index}" for index in range(205)]
    for index, target in enumerate(targets):
        add_event(warehouse, statement_id=f"statement_{index}", target=target)
        add_query(warehouse, statement_id=f"statement_{index}", sql=f"SELECT {index}")
        with warehouse.engine.begin() as conn:
            conn.execute(
                text("INSERT INTO access.column_lineage VALUES (:source, :target, 'id', 'id', :time)"),
                {"source": SOURCE, "target": target, "time": warehouse.today.isoformat()},
            )
    warehouse.history_error = PermissionError("Query history access denied")
    warehouse.fail_batch = fail_batch
    results = requests(make_source(warehouse), targets)
    assert len(results) == 205
    assert len({model_str(result.edge.toEntity.id) for result in results}) == 205
    assert sum(result.edge.lineageDetails.sqlQuery is not None for result in results) == (0 if fail_batch == 1 else 100)
    assert all(len(result.edge.lineageDetails.columnsLineage) == 1 for result in results)
    assert warehouse.batches == ([100] if fail_batch == 1 else [100, 100])


@pytest.mark.parametrize("filter_name", ["databaseFilterPattern", "schemaFilterPattern", "tableFilterPattern"])
def test_filtered_targets_are_not_enriched(warehouse, filter_name):
    add_event(warehouse)
    add_query(warehouse)
    source = make_source(warehouse)
    setattr(source.source_config, filter_name, FilterPattern(includes=["^excluded$"]))
    assert requests(source) == []
    assert warehouse.batches == []


def test_unresolved_upstream_is_not_enriched(warehouse):
    add_event(warehouse)
    add_query(warehouse)
    assert requests(make_source(warehouse, [])) == []
    assert warehouse.batches == []


def test_only_eligible_pairs_consume_batch_slots(warehouse):
    targets = [f"my_catalog.my_schema.my_target_{index}" for index in range(101)]
    excluded_targets = [
        "other_catalog.my_schema.my_target_excluded",
        "my_catalog.other_schema.my_target_excluded",
        "my_catalog.my_schema.other_target",
    ]
    for index, target in enumerate(targets + excluded_targets):
        add_event(warehouse, statement_id=f"statement_{index}", target=target)
        add_query(warehouse, statement_id=f"statement_{index}", sql=f"SELECT {index}")
        add_event(
            warehouse, statement_id=f"unresolved_{index}", source="my_catalog.my_schema.missing_source", target=target
        )
        add_query(warehouse, statement_id=f"unresolved_{index}", sql="SELECT 999")
    source = make_source(warehouse)
    source.source_config.databaseFilterPattern = FilterPattern(includes=["^my_catalog$"])
    source.source_config.schemaFilterPattern = FilterPattern(includes=["^my_schema$"])
    source.source_config.tableFilterPattern = FilterPattern(includes=["^my_target_"])
    results = requests(source, targets + excluded_targets)
    assert len(results) == 101
    assert {model_str(result.edge.lineageDetails.sqlQuery) for result in results} == {
        f"SELECT {index}" for index in range(101)
    }
    assert warehouse.batches == [100, 1]


def test_missing_history_for_one_pair_does_not_hide_another_pairs_sql(warehouse):
    other_target = "my_catalog.my_schema.other_target"
    add_event(warehouse)
    add_query(warehouse)
    add_event(warehouse, statement_id="missing_statement", target=other_target)
    source = make_source(warehouse)
    results = requests(source, [TARGET, other_target])
    assert {
        model_str(result.edge.toEntity.id): model_str(result.edge.lineageDetails.sqlQuery)
        if result.edge.lineageDetails.sqlQuery
        else None
        for result in results
    } == {
        model_str(source.metadata.tables[f"my_service.{TARGET}"].id): SQL,
        model_str(source.metadata.tables[f"my_service.{other_target}"].id): None,
    }
    assert warehouse.batches == [2]


def test_external_location_lineage_is_preserved_alongside_batched_native_edges(warehouse):
    add_event(warehouse)
    add_query(warehouse)
    with warehouse.engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO information_schema.tables VALUES ('my_catalog', 'my_schema', 'my_target', 's3://bucket/path', 'EXTERNAL')"
            )
        )
    source = make_source(warehouse)
    container_id = uuid4()
    source.metadata.es_search_container_by_path = lambda **kwargs: [SimpleNamespace(id=container_id, dataModel=None)]
    results = requests(source)
    [native] = [result for result in results if result.edge.fromEntity.type == "table"]
    [external] = [result for result in results if result.edge.fromEntity.type == "container"]
    assert model_str(native.edge.lineageDetails.sqlQuery) == SQL
    assert model_str(external.edge.fromEntity.id) == str(container_id)
    assert external.edge.toEntity.id == native.edge.toEntity.id
    assert warehouse.batches == [1]


def test_table_names_are_bound_as_values(warehouse):
    source_name = "my_catalog.my_schema.my_source's_table"
    target_name = "my_catalog.my_schema.my_target's_table"
    add_event(warehouse, source=source_name, target=target_name)
    add_query(warehouse)
    [request] = requests(make_source(warehouse, [source_name]), target_name)
    assert model_str(request.edge.lineageDetails.sqlQuery) == SQL


@pytest.mark.parametrize(
    "stored_sql,incoming_sql,expected_sql",
    [(None, SQL, SQL), ("SELECT 0", SQL, SQL), ("SELECT 0", None, "SELECT 0")],
)
def test_table_only_requests_backfill_update_and_preserve_stored_sql(warehouse, stored_sql, incoming_sql, expected_sql):
    add_event(warehouse)
    if incoming_sql:
        add_query(warehouse, sql=incoming_sql)
    [request] = requests(make_source(warehouse))
    stored = {"sqlQuery": stored_sql, "columnsLineage": []}

    def put(_path, data):
        stored.clear()
        stored.update(json.loads(data)["edge"]["lineageDetails"] or {})

    metadata = OpenMetadata.__new__(OpenMetadata)
    metadata.client = SimpleNamespace(
        get=lambda _path: {"edge": stored.copy()},
        patch=lambda _path, data: jsonpatch.JsonPatch(json.loads(data)).apply(stored, in_place=True),
        put=put,
    )
    metadata.add_lineage(request, check_patch=True, return_lineage=False)
    assert stored.get("sqlQuery") == expected_sql
