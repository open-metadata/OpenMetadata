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
"""Daily family policy regressions."""

import re
from collections import namedtuple
from contextlib import contextmanager
from copy import deepcopy
from datetime import date, datetime
from threading import Lock
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from google.cloud.bigquery import Table as BigQueryTable
from sqlalchemy import create_engine, select, text
from sqlalchemy_bigquery import BigQueryDialect

from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table, TableType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_LIFE_CYCLE_QUERY
from metadata.ingestion.source.database.bigquery.sharding import (
    eligible_shard,
    inventory_families,
    logical_shard_name,
    parse_shard_name,
    strip_partition_decorator,
)
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import BigQueryProfilerInterface
from metadata.sampler.sqlalchemy.bigquery.sampler import BigQuerySampler
from metadata.utils.lru_cache import LRUCache


@pytest.mark.parametrize(
    "name,prefix,day",
    [
        ("events_20260102", "events_", date(2026, 1, 2)),
        ("events20260102", "events", date(2026, 1, 2)),
        ("20260102", "", date(2026, 1, 2)),
        ("events_intraday_20240229", "events_intraday_", date(2024, 2, 29)),
    ],
)
def test_native_dates(name, prefix, day):
    assert parse_shard_name(name) == (prefix, day)


@pytest.mark.parametrize(
    "name",
    [
        "events$20260102",
        "events_20260230",
        "events_202601020",
        "events_20230229",
        "events_\uff12\uff10\uff12\uff16\uff10\uff11\uff10\uff12",
        "events_yyyymmdd",
    ],
)
def test_invalid_dates(name):
    assert parse_shard_name(name) is None


def test_names_and_decorators():
    assert logical_shard_name("") == "yyyymmdd"
    assert logical_shard_name("events_") == "events_yyyymmdd"
    assert strip_partition_decorator("events$20260102") == "events"
    assert strip_partition_decorator("events_20260101$20260102") == "events_20260101"
    assert eligible_shard("backup_20260101", "TABLE") == ("backup_", date(2026, 1, 1))
    assert eligible_shard("events_20260101", "VIEW") is None


def test_inventory_uses_suffix_order_and_keeps_distinct_prefixes():
    names = ["events_20260102", "events_20260101", "events_intraday_20260103", "20260101"]
    families = inventory_families(SimpleNamespace(table_id=n, table_type="TABLE") for n in names)
    descriptor = families["events_"].descriptor("demo_project", "demo_dataset")
    assert descriptor.shardCount == 2
    assert descriptor.representative.tableName == "events_20260102"
    assert descriptor.firstShardDate == date(2026, 1, 1)
    assert len(families) == 3
    assert families[""].count == 1


def test_inventory_limit_fails_instead_of_returning_partial_families():
    tables = (SimpleNamespace(table_id=f"family_{i}_20260101", table_type="TABLE") for i in range(10001))
    with pytest.raises(ValueError, match="10000 shard families"):
        inventory_families(tables)


class Catalog:
    def __init__(self, tables=()):
        self.tables = {table.fullyQualifiedName.root: table for table in tables}
        self.fail = False

    def list_all_entities(self, entity, fields=None, params=None):
        assert entity is Table
        assert params["databaseSchema"] == "demo_service.demo_project.demo_dataset"
        if self.fail:
            raise ConnectionError("catalog unavailable")
        return (
            table
            for table in self.tables.values()
            if not table.deleted and (not params.get("tableRegex") or table.name.root.endswith("yyyymmdd"))
        )

    def get_by_name(self, entity, fqn, include=None):
        assert include == "all"
        if self.fail:
            raise ConnectionError("catalog unavailable")
        return self.tables.get(fqn)


class Inventory:
    def __init__(self, names):
        self.names = names
        self.calls = 0
        self.fail_on = None

    def list_tables(self, dataset):
        assert dataset == "demo_project.demo_dataset"
        self.calls += 1
        for index, name in enumerate(self.names):
            yield SimpleNamespace(table_id=name, table_type="TABLE")
            if self.calls == self.fail_on and index == 0:
                raise ConnectionError("listing incomplete")


def source_for(names, tables=()):
    source = BigquerySource.__new__(BigquerySource)
    context = SimpleNamespace(database_service="demo_service", database="demo_project", database_schema="demo_dataset")
    source.context = SimpleNamespace(get=lambda: context)
    source.service_connection = BigQueryConnection(credentials={"gcpConfig": {}})
    source.source_config = DatabaseServiceMetadataPipeline(shardedTables={"enabled": True})
    source._sharding_scopes = {}
    source._sharding_scope_lock = Lock()
    source.client = Inventory(names)
    source.metadata = Catalog(tables)
    source.status = MagicMock()
    return source


def catalog_table(name, sharded=False, deleted=False):
    table = Table(
        id=uuid4(),
        name=name,
        fullyQualifiedName=f"demo_service.demo_project.demo_dataset.{name}",
        columns=[],
        deleted=deleted,
    )
    if sharded:
        table.tableType = TableType.Sharded
        table.tableSharding = inventory_families([SimpleNamespace(table_id="events_20260101", table_type="TABLE")])[
            "events_"
        ].descriptor("demo_project", "demo_dataset")
    return table


def test_discovery_selects_one_representative_and_logical_request():
    source = source_for(["events_20260101", "events_20260102", "events"])
    iterator = source.get_tables_name_and_type()
    assert next(iterator) == ("events_20260102", TableType.Sharded)
    request = source.prepare_table_request(
        CreateTableRequest(name="events_20260102", databaseSchema="demo_service.demo_project.demo_dataset", columns=[])
    )
    assert request.name.root == "events_yyyymmdd"
    assert request.tableSharding.shardCount == 2
    assert next(iterator) == ("events", TableType.Regular)
    assert list(iterator) == []
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is True


@pytest.mark.parametrize("deleted", [False, True])
def test_ordinary_placeholder_cannot_become_a_family(deleted):
    ordinary = catalog_table("events_yyyymmdd", deleted=deleted)
    source = source_for(["events_20260101"], [ordinary])
    assert list(source.get_tables_name_and_type()) == [("events_20260101", TableType.Regular)]
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is False
    assert ordinary.tableType != TableType.Sharded


@pytest.mark.parametrize("deleted", [False, True])
def test_family_placeholder_cannot_become_a_physical_table(deleted):
    family = catalog_table("events_yyyymmdd", sharded=True, deleted=deleted)
    source = source_for(["events_20260101", "events_yyyymmdd"], [family])
    assert list(source.get_tables_name_and_type()) == []
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is False
    assert family.tableType == TableType.Sharded


def test_initial_collision_keeps_physical_names():
    source = source_for(["20260101", "yyyymmdd"])
    assert list(source.get_tables_name_and_type()) == [("20260101", TableType.Regular), ("yyyymmdd", TableType.Regular)]


@pytest.mark.parametrize("failure", ["listing", "catalog"])
def test_failed_discovery_cannot_reconcile(failure):
    source = source_for(["events_20260101", "events_20260102"])
    if failure == "listing":
        source.client.fail_on = 1
    else:
        source.metadata.fail = True
    assert list(source.get_tables_name_and_type()) == []
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is False


def test_separate_sampler_pins_physical_sql_and_keeps_logical_entity():
    table = catalog_table("events_yyyymmdd", sharded=True)
    table.serviceType = "BigQuery"
    table.database = EntityReference(id=uuid4(), name="demo_project", type="database")
    table.databaseSchema = EntityReference(id=uuid4(), name="demo_dataset", type="databaseSchema")
    table.columns = [Column(name="id", dataType=DataType.INT)]
    table = Table.model_validate_json(table.model_dump_json())
    sampler = BigQuerySampler.__new__(BigQuerySampler)
    catalog = SimpleNamespace(
        get_by_id=lambda entity, entity_id, nullable: SimpleNamespace(
            name=SimpleNamespace(
                root=(table.database.name if entity.__name__ == "Database" else table.databaseSchema.name)
            )
        )
    )
    orm = sampler.build_table_orm(table, BigQueryConnection(credentials={"gcpConfig": {}}), catalog)
    sql = str(select(orm).compile(dialect=BigQueryDialect()))
    assert "events_20260101" in sql
    assert "events_yyyymmdd" not in sql
    assert table.name.root == "events_yyyymmdd"
    scope = EvaluationScopeRuntimeParameters(execution_source=sampler.execution_source).to_result_scope(False)
    table.tableSharding.representative.tableName = "events_20260102"
    assert scope.executionSource.tableName == "events_20260101"
    assert sampler.execution_source.tableName == "events_20260101"
    assert (
        EvaluationScopeRuntimeParameters(execution_source=sampler.execution_source)
        .to_result_scope(True)
        .executionSource
        is None
    )


def test_family_lifecycle_reduces_source_activity_without_changing_representative():
    from datetime import datetime

    source = source_for(["events_20260101", "events_20260102"])
    iterator = source.get_tables_name_and_type()
    assert next(iterator) == ("events_20260102", TableType.Sharded)
    context = source.context.get()
    context.table = "events_yyyymmdd"
    rows = [
        {
            "table_name": "events_20260101",
            "table_type": "BASE TABLE",
            "created_at": datetime(2026, 1, 3),
            "updated_at": datetime(2026, 2, 1),
        },
        {
            "table_name": "events_20260102",
            "table_type": "BASE TABLE",
            "created_at": datetime(2026, 1, 2),
            "updated_at": None,
        },
    ]
    source.engine = MagicMock()
    source.engine.connect.return_value.__enter__.return_value.execute.return_value = [
        SimpleNamespace(_asdict=lambda row=row: row) for row in rows
    ]
    lifecycle = source.life_cycle_query_dict("select metadata")["events_yyyymmdd"]
    assert lifecycle.created_at == datetime(2026, 1, 2)
    assert lifecycle.updated_at == datetime(2026, 2, 1)
    assert context.shard_family.representative.tableName == "events_20260102"


@pytest.fixture
def metadata_batches():
    source = source_for([])
    assert list(source.get_tables_name_and_type()) == []
    source.source_config.includeDDL = True
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE source_tables (table_name TEXT, table_type TEXT, creation_time TEXT, "
                "ddl TEXT, table_schema TEXT, table_catalog TEXT)"
            )
        )
        conn.execute(
            text("INSERT INTO source_tables VALUES (:name, 'BASE TABLE', :created, :ddl, :schema, :project)"),
            [
                {
                    "name": f"ordinary_{i:04d}",
                    "created": "2026-01-01" if schema == "demo_dataset" else "2026-02-01",
                    "ddl": f"CREATE TABLE {schema}.ordinary_{i:04d} (id INT64)",
                    "schema": schema,
                    "project": "demo_project",
                }
                for schema in ("demo_dataset", "other_dataset")
                for i in range(2501)
            ],
        )
        conn.execute(
            text(
                "INSERT INTO source_tables VALUES (:name, 'BASE TABLE', :created, :ddl, 'demo_dataset', 'demo_project')"
            ),
            [
                {
                    "name": f"events_2026010{day}",
                    "created": f"2026-01-0{day}",
                    "ddl": f"CREATE TABLE events_2026010{day} (id INT64)",
                }
                for day in (1, 2)
            ],
        )
    queries = []

    @contextmanager
    def connect():
        with engine.connect() as conn:

            def execute(statement, parameters=None):
                sql = str(statement)
                queries.append((sql, parameters))
                sql = re.sub(r"`[^`]+`\.`[^`]+`\.INFORMATION_SCHEMA\.TABLES", "source_tables", sql)
                return conn.execute(text(sql), parameters or {})

            yield SimpleNamespace(execute=execute)

    source.engine = SimpleNamespace(connect=connect)
    yield source, queries
    engine.dispose()


def lifecycle_query(schema="demo_dataset"):
    return BIGQUERY_LIFE_CYCLE_QUERY.format(database_name="demo_project", schema_name=schema)


def test_grouped_ordinary_metadata_uses_bounded_batches_without_truncation(metadata_batches):
    source, queries = metadata_batches
    context = source.context.get()
    for i in range(2501):
        name = f"ordinary_{i:04d}"
        context.table = name
        observed = source.life_cycle_query_dict(lifecycle_query())[name]
        assert observed.created_at == datetime(2026, 1, 1)
        assert source.get_schema_definition(TableType.Regular, name, "demo_dataset", None) == (
            f"CREATE TABLE demo_dataset.{name} (id INT64)"
        )
        assert len(context.shard_metadata) <= 2000
    assert len(queries) == 6


def test_metadata_batches_isolate_datasets_and_support_out_of_order_reads(metadata_batches):
    source, _ = metadata_batches
    context = source.context.get()
    for schema, name in [
        ("demo_dataset", "ordinary_2000"),
        ("other_dataset", "ordinary_2000"),
        ("demo_dataset", "ordinary_0000"),
        ("other_dataset", "ordinary_0001"),
    ]:
        context.database_schema = schema
        context.table = name
        observed = source.life_cycle_query_dict(lifecycle_query(schema))[name]
        assert observed.created_at == datetime(2026, 1 if schema == "demo_dataset" else 2, 1)
        assert source.get_schema_definition(TableType.Regular, name, schema, None) == (
            f"CREATE TABLE {schema}.{name} (id INT64)"
        )
    assert len(context.shard_metadata) <= 2000
    assert deepcopy(context.shard_metadata) == context.shard_metadata


def test_family_lifecycle_and_representative_ddl_coexist_with_ordinary_batches(metadata_batches):
    source, queries = metadata_batches
    context = source.context.get()
    context.table = "ordinary_0000"
    assert source.life_cycle_query_dict(lifecycle_query())[context.table].created_at == datetime(2026, 1, 1)
    context.shard_prefixes = {"events_"}
    context.shard_family = inventory_families(
        SimpleNamespace(table_id=name, table_type="TABLE") for name in ["events_20260101", "events_20260102"]
    )["events_"].descriptor("demo_project", "demo_dataset")
    context.table = "events_yyyymmdd"
    assert source.life_cycle_query_dict(lifecycle_query())[context.table].created_at == datetime(2026, 1, 1)
    assert source.get_schema_definition(TableType.Sharded, "events_20260102", "demo_dataset", None) == (
        "CREATE TABLE events_20260102 (id INT64)"
    )
    context.shard_family = None
    context.table = "ordinary_0001"
    assert source.life_cycle_query_dict(lifecycle_query())[context.table].created_at == datetime(2026, 1, 1)
    assert len(queries) == 3


def test_metadata_batch_caches_absence_and_binds_table_names(metadata_batches):
    source, queries = metadata_batches
    context = source.context.get()
    context.table = "ordinary_0000'"
    for _ in range(2):
        assert source.life_cycle_query_dict(lifecycle_query()) == {}
        assert source.get_schema_definition(TableType.Regular, context.table, "demo_dataset", None) is None
    assert len(queries) == 2
    assert all(context.table not in sql and params["table_name"] == context.table for sql, params in queries)


def test_failed_metadata_batch_does_not_cache_partial_results(metadata_batches):
    source, queries = metadata_batches
    context = source.context.get()
    context.table = "ordinary_0000"
    engine = source.engine

    @contextmanager
    def failed_connect():
        with engine.connect() as conn:

            def execute(statement, parameters):
                yield next(iter(conn.execute(statement, parameters)))
                raise ConnectionError("metadata read interrupted")

            yield SimpleNamespace(execute=execute)

    source.engine = SimpleNamespace(connect=failed_connect)
    with pytest.raises(ConnectionError, match="metadata read interrupted"):
        source.life_cycle_query_dict(lifecycle_query())
    source.engine = engine
    assert source.life_cycle_query_dict(lifecycle_query())[context.table].created_at == datetime(2026, 1, 1)
    assert len(queries) == 2


@pytest.mark.parametrize("complete", [False, True])
def test_only_complete_scopes_delete_missing_families(complete):
    missing = catalog_table("events_yyyymmdd", sharded=True)
    physical = catalog_table("events_20251231")
    source = source_for([], [missing, physical])
    source.source_config.markDeletedTables = True
    source.database_source_state = set()
    scope = "demo_service.demo_project.demo_dataset"
    source._sharding_scopes[scope] = complete
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    source.metadata.list_all_entities = lambda *args, **kwargs: iter([missing, physical])

    def delete_stale(entity, scope_params, live_fqns, recursive, allow_empty_seen=False):
        assert scope_params == {"databaseSchema": scope}
        if not live_fqns and not allow_empty_seen:
            return {"deleted": 0}
        for table in (missing, physical):
            if table.fullyQualifiedName.root not in live_fqns:
                table.deleted = True
        return {"deleted": 1}

    source.metadata.delete_stale_entities = delete_stale
    outcomes = list(source.mark_tables_as_deleted())
    assert all(outcome.left is None for outcome in outcomes)
    assert missing.deleted is complete
    assert physical.deleted is complete


def test_filtered_logical_family_is_outside_reconciliation_scope():
    family = catalog_table("events_yyyymmdd", sharded=True)
    source = source_for([], [family])
    source.source_config.markDeletedTables = True
    source.source_config.tableFilterPattern = {"includes": ["^other_yyyymmdd$"]}
    source.source_config = DatabaseServiceMetadataPipeline.model_validate_json(source.source_config.model_dump_json())
    source.database_source_state = set()
    scope = "demo_service.demo_project.demo_dataset"
    source._sharding_scopes[scope] = True
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    source.metadata.list_all_entities = lambda *args, **kwargs: iter([family])

    def delete_stale(entity, scope_params, live_fqns, recursive, allow_empty_seen=False):
        if not live_fqns and not allow_empty_seen:
            return {"deleted": 0}
        family.deleted = family.fullyQualifiedName.root not in live_fqns
        return {"deleted": 0}

    source.metadata.delete_stale_entities = delete_stale
    outcomes = list(source.mark_tables_as_deleted())
    assert all(outcome.left is None for outcome in outcomes)
    assert family.deleted is False


def test_sharded_system_metrics_do_not_invoke_the_operation_collector():
    interface = BigQueryProfilerInterface.__new__(BigQueryProfilerInterface)
    interface.table_entity = catalog_table("events_yyyymmdd", sharded=True)
    interface.status = MagicMock()

    class OperationCollector:
        def __init__(self, **kwargs):
            raise AssertionError("Sharded operation collector must not query the warehouse")

    interface.system_metrics_class = OperationCollector
    assert interface._compute_system_metrics(None, None) == []
    assert "not supported" in interface.status.warning.call_args[0][1]


def test_streamed_inventory_extracts_only_latest_members_at_catalog_scale():
    from datetime import date, timedelta

    class Names:
        def __iter__(self):
            for family in range(100):
                for day in range(365):
                    suffix = (date(2025, 1, 1) + timedelta(days=day)).strftime("%Y%m%d")
                    yield f"events_{family}_{suffix}"

    source = source_for(Names())
    requests = []
    for physical, kind in source.get_tables_name_and_type():
        assert kind == TableType.Sharded
        assert physical.endswith("20251231")
        requests.append(
            source.prepare_table_request(
                CreateTableRequest(name=physical, databaseSchema="demo_service.demo_project.demo_dataset", columns=[])
            )
        )
    assert len(requests) == 100
    assert len({request.name.root for request in requests}) == 100
    assert all(request.tableSharding.shardCount == 365 for request in requests)
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is True


class ChangingInventory(Inventory):
    def __init__(self, snapshots, missing_on_fetch=False):
        super().__init__(snapshots[0])
        self.snapshots = snapshots
        self.missing_on_fetch = missing_on_fetch

    def list_tables(self, dataset):
        self.names = self.snapshots[min(self.calls, len(self.snapshots) - 1)]
        yield from super().list_tables(dataset)

    def get_table(self, name):
        if self.missing_on_fetch:
            raise LookupError("replacement disappeared")
        assert name.rsplit(".", 1)[-1] in self.names
        return SimpleNamespace(table_id=name.rsplit(".", 1)[-1])


def test_discovery_refreshes_missing_families_once_per_dataset():
    initial = ["events_20260101", "events_20260102", "other_20260101", "other_20260102"]
    remaining = ["events_20260101", "other_20260101"]
    source = source_for(initial)
    source.client = ChangingInventory([initial, initial, remaining, remaining])
    emitted = []
    for name, kind in source.get_tables_name_and_type():
        descriptor = source.context.get().shard_family
        emitted.append((name, kind, descriptor.shardCount, descriptor.lastShardDate))
    assert emitted == [
        ("events_20260101", TableType.Sharded, 1, date(2026, 1, 1)),
        ("other_20260101", TableType.Sharded, 1, date(2026, 1, 1)),
    ]
    assert source.client.calls == 4
    assert source._sharding_scopes["demo_service.demo_project.demo_dataset"] is True


@pytest.mark.parametrize("failure", [None, "listing", "replacement", "collision", "placeholder_only"])
def test_refreshed_inventory_controls_reconciliation(failure):
    initial = ["events_20260101", "events_20260102"]
    remaining = [] if failure is None else ["events_20260101"]
    if failure == "collision":
        remaining.append("events_yyyymmdd")
    elif failure == "placeholder_only":
        remaining = ["events_yyyymmdd"]
    family = catalog_table("events_yyyymmdd", sharded=True)
    source = source_for(initial, [family])
    source.source_config.markDeletedTables = True
    source.client = ChangingInventory([initial, initial, ["events_20260101"], remaining], failure == "replacement")
    if failure == "listing":
        source.client.fail_on = 4
    source.database_source_state = set()
    scope = "demo_service.demo_project.demo_dataset"
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    source.metadata.list_all_entities = lambda *args, **kwargs: iter([family])
    submitted = []

    def delete_stale_entities(**kwargs):
        submitted.append(kwargs)
        if kwargs["live_fqns"] or kwargs.get("allow_empty_seen", False):
            family.deleted = family.fullyQualifiedName.root not in kwargs["live_fqns"]
        return {"deleted": 1}

    source.metadata.delete_stale_entities = delete_stale_entities
    assert list(source.get_tables_name_and_type()) == []
    list(source.mark_tables_as_deleted())
    assert source.client.calls == 4
    assert source._sharding_scopes[scope] is (failure is None)
    assert family.deleted is (failure is None)
    if failure is None:
        assert len(submitted) == 1
        assert submitted[0]["live_fqns"] == set()
    else:
        assert submitted == []


def topology_source_for_mode(extraction_fails, grouping, incremental):
    names = ["events_20260101", "events_20260102", "orders", "audit_20260103", "products", "visits_20260104"]
    old_entries = [
        catalog_table("events_20260101"),
        catalog_table("events_20260102"),
        catalog_table("events_yyyymmdd", sharded=True),
    ]
    source = source_for(names, old_entries)
    source.incremental = SimpleNamespace(enabled=incremental)
    source.context = TopologyContextManager(source.topology)
    source.context.get_global().deleted_tables = ["demo_service.demo_project.demo_dataset.events_20260102"]
    source.project_ids = []
    source.context.set_threads(4)
    source.context.get().__dict__.update(
        database_service="demo_service", database="demo_project", database_schema="demo_dataset"
    )
    source.source_config = DatabaseServiceMetadataPipeline(
        includeTags=False, includeDDL=False, markDeletedTables=True, shardedTables={"enabled": grouping}
    )
    source.database_source_state = set()
    source._table_obj_cache = LRUCache(10)
    source._dataset_obj_cache = LRUCache(10)
    source._table_ddl_cache = LRUCache(10)

    class WarehouseInventory(Inventory):
        def get_table(self, name):
            assert name.rsplit(".", 1)[-1] in names
            return BigQueryTable(name)

        def get_dataset(self, name):
            return SimpleNamespace(location="US")

    class WarehouseInspector:
        def get_unique_constraints(self, table_name, schema_name):
            if extraction_fails and table_name == "audit_20260103":
                raise ConnectionError("table metadata unavailable")
            return []

        def get_foreign_keys(self, table_name, schema_name):
            return []

        def get_pk_constraint(self, table_name, schema_name):
            return {}

        def get_columns(self, *args, **kwargs):
            return []

        def get_table_comment(self, table_name, schema_name):
            return {"text": table_name}

    row = namedtuple("LifecycleRow", "table_name table_type created_at updated_at")
    rows = [row(name, "BASE TABLE", datetime(2026, 1, index + 1), None) for index, name in enumerate(names)]

    class WarehouseRows(list):
        def all(self):
            return self

    class WarehouseEngine:
        @contextmanager
        def connect(self):
            yield self

        def execute(self, query, parameters=None):
            if parameters:
                return WarehouseRows(
                    item
                    for item in sorted(rows, key=lambda row: row.table_name)
                    if item.table_name >= parameters["table_name"]
                )
            return WarehouseRows(rows)

    source.client = WarehouseInventory(names)
    source._inspector_map = {source.context.get_current_thread_id(): WarehouseInspector()}
    source.engine = WarehouseEngine()
    scope = "demo_service.demo_project.demo_dataset"
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    submitted = []

    def delete_stale_entities(**kwargs):
        submitted.append(kwargs)
        for table in old_entries:
            table.deleted = table.fullyQualifiedName.root not in kwargs["live_fqns"]
        return {"deleted": sum(table.deleted for table in old_entries)}

    source.metadata.delete_stale_entities = delete_stale_entities

    return source, names, old_entries, submitted


def test_disabling_grouping_preserves_physical_table_ddl():
    source, names, _, _ = topology_source_for_mode(False, False, True)
    source.source_config.includeDDL = True
    warehouse_engine = source.engine

    class WarehouseEngineWithDDL:
        @contextmanager
        def connect(self):
            yield self

        def execute(self, query):
            if "ddl" in str(query).lower():
                return SimpleNamespace(
                    all=lambda: [
                        SimpleNamespace(table_name=name, ddl=f"CREATE TABLE {name} (id INT64)") for name in names
                    ]
                )
            return warehouse_engine.execute(query)

    source.engine = WarehouseEngineWithDDL()
    results = list(source.process_nodes([source.topology.table]))
    assert not [result.left for result in results if result.left]
    requests = [result.right for result in results if isinstance(result.right, CreateTableRequest)]
    assert {request.name.root: request.schemaDefinition.root for request in requests} == {
        name: f"CREATE TABLE {name} (id INT64)" for name in names
    }


@pytest.mark.parametrize("grouping", [False, True])
@pytest.mark.parametrize("incremental", [False, True])
@pytest.mark.parametrize("extraction_fails", [False, True])
def test_topology_keeps_each_table_descriptor_and_lifecycle_through_extraction(extraction_fails, grouping, incremental):
    source, names, old_entries, submitted = topology_source_for_mode(extraction_fails, grouping, incremental)
    scope = "demo_service.demo_project.demo_dataset"
    results = list(source.process_nodes([source.topology.table]))
    failures = [result.left for result in results if result.left]
    assert [failure.name for failure in failures] == (["audit_20260103"] if extraction_fails else []), [
        failure.error for failure in failures
    ]
    requests = [result.right for result in results if isinstance(result.right, CreateTableRequest)]
    expected = [
        ("events_yyyymmdd", "events_20260102", "events_"),
        ("orders", "orders", None),
        *([("audit_yyyymmdd", "audit_20260103", "audit_")] if not extraction_fails else []),
        ("products", "products", None),
        ("visits_yyyymmdd", "visits_20260104", "visits_"),
    ]
    if not grouping:
        expected = [(name, name, None) for name in names if not (extraction_fails and name == "audit_20260103")]
    assert [
        (request.name.root, request.description.root, request.tableSharding.prefix if request.tableSharding else None)
        for request in requests
    ] == expected
    assert [request.tableType for request in requests] == [
        TableType.Sharded if prefix else TableType.Regular for _, _, prefix in expected
    ]
    lifecycle = [result.right for result in results if isinstance(result.right, OMetaLifeCycleData)]
    expected_created = {
        "events_yyyymmdd": 1767225600000,
        "orders": 1767398400000,
        "products": 1767571200000,
        "visits_yyyymmdd": 1767657600000,
    }
    if not extraction_fails:
        expected_created["audit_yyyymmdd"] = 1767484800000
    if not grouping:
        expected_created = {
            name: 1767225600000 + index * 86400000
            for index, name in enumerate(names)
            if not (extraction_fails and name == "audit_20260103")
        }
    assert {
        item.entity_fqn.rsplit(".", 1)[-1]: item.life_cycle.created.timestamp.root for item in lifecycle
    } == expected_created
    if grouping or not extraction_fails:
        assert len(lifecycle) == len(expected_created)
    assert source.database_source_state == {f"{scope}.{name}" for name, _, _ in expected}
    list(source.mark_tables_as_deleted())
    if extraction_fails:
        assert submitted == []
        assert all(not table.deleted for table in old_entries)
    else:
        assert len(submitted) == 1
        assert submitted[0]["live_fqns"] == source.database_source_state
        assert [table.deleted for table in old_entries] == [grouping, grouping, not grouping]


@pytest.mark.parametrize(
    "config,enabled", [(None, False), ({}, False), ({"enabled": False}, False), ({"enabled": True}, True)]
)
def test_sharding_enabled_comes_from_metadata_pipeline(config, enabled):
    source = source_for(["events_20260101"])
    source.source_config = DatabaseServiceMetadataPipeline(shardedTables=config)
    assert source.sharding_enabled is enabled


def test_pipeline_groups_each_daily_family_and_keeps_ordinary_tables():
    source = source_for(["events_20260101", "events_20260102", "backup_20260101", "ordinary"])
    source.source_config = DatabaseServiceMetadataPipeline(shardedTables={"enabled": True})
    discovered = list(source._grouped_tables())
    assert [(table.catalog_name, table.table_type) for table in discovered] == [
        ("events_yyyymmdd", TableType.Sharded),
        ("backup_yyyymmdd", TableType.Sharded),
        ("ordinary", TableType.Regular),
    ]


@pytest.mark.parametrize("grouping", [False, True])
@pytest.mark.parametrize("mark_deleted", [False, True])
@pytest.mark.parametrize("excluded", [False, True])
def test_mode_switch_retires_previous_names_with_replacement_name_filters(grouping, mark_deleted, excluded):
    physical = catalog_table("events_20260101")
    family = catalog_table("events_yyyymmdd", sharded=True)
    ordinary = catalog_table("orders")
    old_entries = [family, physical, ordinary]
    source = source_for(["events_20260101"], old_entries)
    source.incremental = SimpleNamespace(enabled=False)
    source.source_config = DatabaseServiceMetadataPipeline(
        markDeletedTables=mark_deleted,
        shardedTables={"enabled": grouping},
        tableFilterPattern={
            "includes": ["^events_yyyymmdd$" if grouping else "^events_[0-9]{8}$"],
            "excludes": ["^events_"] if excluded else [],
        },
    )
    source.database_source_state = set()
    scope = "demo_service.demo_project.demo_dataset"
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    for name, kind in source.get_tables_name_and_type():
        request = source.prepare_table_request(
            CreateTableRequest(name=name, tableType=kind, databaseSchema=scope, columns=[])
        )
        source.register_record(request)

    def delete_stale_entities(**kwargs):
        for table in old_entries:
            table.deleted = table.fullyQualifiedName.root not in kwargs["live_fqns"]
        return {"deleted": sum(table.deleted for table in old_entries)}

    source.metadata.delete_stale_entities = delete_stale_entities
    list(source.mark_tables_as_deleted())
    assert physical.deleted is (grouping and mark_deleted and not excluded)
    assert family.deleted is (not grouping and mark_deleted and not excluded)
    assert ordinary.deleted is False


@pytest.mark.parametrize("failure", ["listing", "catalog", "collision"])
def test_disabling_grouping_cannot_retire_family_with_incomplete_or_conflicting_inventory(failure):
    family = catalog_table("events_yyyymmdd", sharded=True)
    source = source_for(["events_20260101", "events_20260102"], [family])
    source.source_config = DatabaseServiceMetadataPipeline(markDeletedTables=True)
    source.incremental = SimpleNamespace(enabled=False)
    source.database_source_state = set()
    scope = "demo_service.demo_project.demo_dataset"
    source._get_filtered_schema_names = lambda **kwargs: [scope]
    if failure == "listing":
        source.client.fail_on = 1
    elif failure == "catalog":
        source.metadata.fail = True
    else:
        source.client.names.append("events_yyyymmdd")

    def delete_stale_entities(**kwargs):
        family.deleted = family.fullyQualifiedName.root not in kwargs["live_fqns"]
        return {"deleted": int(family.deleted)}

    source.metadata.delete_stale_entities = delete_stale_entities
    list(source.get_tables_name_and_type())
    list(source.mark_tables_as_deleted())
    assert family.deleted is False
    assert source._sharding_scopes[scope] is False
