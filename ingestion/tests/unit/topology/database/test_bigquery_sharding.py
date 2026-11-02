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

from datetime import date
from threading import Lock
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy_bigquery import BigQueryDialect

from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table, TableType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.ingestion.source.database.bigquery.sharding import (
    eligible_shard,
    inventory_families,
    logical_shard_name,
    parse_shard_name,
    strip_partition_decorator,
)
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import BigQueryProfilerInterface
from metadata.sampler.sqlalchemy.bigquery.sampler import BigQuerySampler


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
    assert eligible_shard("backup_20260101", "TABLE", ["^backup_"]) is None
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
    source.service_connection = BigQueryConnection(credentials={"gcpConfig": {}}, shardedTables={"enabled": True})
    source.source_config = DatabaseServiceMetadataPipeline()
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

    def delete_stale(entity, scope_params, live_fqns, recursive):
        assert scope_params == {"databaseSchema": scope}
        for table in (missing, physical):
            if table.fullyQualifiedName.root not in live_fqns:
                table.deleted = True
        return {"deleted": 1}

    source.metadata.delete_stale_entities = delete_stale
    outcomes = list(source.mark_tables_as_deleted())
    assert all(outcome.left is None for outcome in outcomes)
    assert missing.deleted is complete
    assert physical.deleted is False


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

    def delete_stale(entity, scope_params, live_fqns, recursive):
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
