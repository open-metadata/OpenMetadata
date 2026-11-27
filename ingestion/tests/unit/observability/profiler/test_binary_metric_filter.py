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
"""Global profiler rules on real catalog-to-SQLAlchemy binary columns."""

from itertools import permutations
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
import sqlalchemy

from metadata.generated.schema.configuration.profilerConfiguration import ProfilerConfiguration
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import SQLiteConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.converter.base import build_orm_col
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.registry import CustomTypes
from metadata.profiler.processor.metric_filter import MetricFilter
from metadata.sampler.sqlalchemy.sampler import SQASampler

BINARY_TYPES = (DataType.BINARY, DataType.VARBINARY, DataType.BLOB, DataType.BYTES, DataType.BYTEA)
SERVICES = tuple(
    getattr(DatabaseServiceType, name)
    for name in ("Mysql", "Postgres", "MariaDB", "Mssql", "AzureSQL", "Trino", "Snowflake", "Redshift", "BigQuery")
)
DEFAULTS = {"nullCount", "distinctCount"}


def build_column(data_type, service=DatabaseServiceType.Mysql):
    return build_orm_col(0, Column(name="payload", dataType=data_type), service)


def selected(column, rules, service=DatabaseServiceType.Mysql):
    metrics = (Metrics.nullCount.value, Metrics.distinctCount.value, Metrics.rowCount.value)
    config = None if rules is None else ProfilerConfiguration(metricConfiguration=rules)
    metric_filter = MetricFilter(metrics=metrics, global_profiler_config=config, metrics_registry=Metrics)
    return {
        metric.name()
        for metric in metric_filter.filter_column_metrics_from_global_config(list(metrics), column, service)
    }


@pytest.mark.parametrize("service", SERVICES)
@pytest.mark.parametrize("data_type", BINARY_TYPES)
@pytest.mark.parametrize(
    "rule,expected",
    [
        ({"disabled": True}, set()),
        ({"metrics": ["nullCount"]}, {"nullCount"}),
        ({}, DEFAULTS),
        ({"metrics": []}, DEFAULTS),
    ],
)
def test_binary_catalog_rules(service, data_type, rule, expected):
    column = build_column(data_type, service)
    assert type(column.type) is CustomTypes.BYTES.value
    assert selected(column, [{"dataType": data_type, **rule}], service) == expected


@pytest.mark.parametrize("data_type", BINARY_TYPES)
@pytest.mark.parametrize("rules", [None, [], [{"dataType": DataType.INT, "disabled": True}]])
def test_binary_without_matching_configuration_uses_defaults(data_type, rules):
    assert selected(build_column(data_type), rules) == DEFAULTS


@pytest.mark.parametrize("disabled_type,selective_type", list(permutations(BINARY_TYPES, 2)))
@pytest.mark.parametrize("reverse", [False, True])
def test_exact_binary_rules_are_independent_of_alias_order(disabled_type, selective_type, reverse):
    rules = [
        {"dataType": disabled_type, "disabled": True, "metrics": ["nullCount"]},
        {"dataType": selective_type, "metrics": ["nullCount"]},
    ]
    if reverse:
        rules.reverse()
    assert selected(build_column(disabled_type), rules) == set()
    assert selected(build_column(selective_type), rules) == {"nullCount"}


@pytest.mark.parametrize("data_type,alias_type", list(permutations(BINARY_TYPES, 2)))
@pytest.mark.parametrize("metrics", [None, []])
def test_exact_default_rule_beats_alias_disable(data_type, alias_type, metrics):
    rule = {"dataType": data_type}
    if metrics is not None:
        rule["metrics"] = metrics
    assert selected(build_column(data_type), [{"dataType": alias_type, "disabled": True}, rule]) == DEFAULTS


@pytest.mark.parametrize("reverse", [False, True])
def test_absent_exact_rule_preserves_first_alias_fallback(reverse):
    rules = [
        {"dataType": DataType.BLOB, "disabled": True},
        {"dataType": DataType.BYTES, "metrics": ["nullCount"]},
    ]
    if reverse:
        rules.reverse()
    assert selected(build_column(DataType.BINARY), rules) == ({"nullCount"} if reverse else set())


@pytest.mark.parametrize("reverse", [False, True])
def test_duplicate_exact_rules_use_first_row(reverse):
    rules = [
        {"dataType": DataType.BINARY, "disabled": True},
        {"dataType": DataType.BINARY, "metrics": ["nullCount"]},
    ]
    if reverse:
        rules.reverse()
    assert selected(build_column(DataType.BINARY), rules) == ({"nullCount"} if reverse else set())


@pytest.mark.parametrize(
    "sqa_type,data_type",
    [(CustomTypes.BYTES.value, data_type) for data_type in BINARY_TYPES]
    + [(sqlalchemy.LargeBinary, DataType.BINARY), (sqlalchemy.VARBINARY, DataType.VARBINARY)],
)
def test_native_columns_retain_reverse_lookup(sqa_type, data_type):
    column = sqlalchemy.Column("payload", sqa_type)
    assert selected(column, [{"dataType": data_type, "disabled": True}]) == set()
    assert selected(column, [{"dataType": data_type, "metrics": ["nullCount"]}]) == {"nullCount"}


def test_native_binary_columns_keep_alias_order():
    column = sqlalchemy.Column("payload", CustomTypes.BYTES.value)
    assert (
        selected(
            column,
            [
                {"dataType": DataType.BLOB, "disabled": True},
                {"dataType": DataType.BINARY, "metrics": ["nullCount"]},
            ],
        )
        == set()
    )


@pytest.mark.parametrize("reverse", [False, True])
def test_unrelated_shared_types_keep_alias_order(reverse):
    rules = [
        {"dataType": DataType.TINYINT, "disabled": True},
        {"dataType": DataType.SMALLINT, "metrics": ["nullCount"]},
    ]
    if reverse:
        rules.reverse()
    for data_type in (DataType.TINYINT, DataType.SMALLINT):
        column = build_column(data_type)
        assert column.info == {}
        assert selected(column, rules) == ({"nullCount"} if reverse else set())


def test_reverse_map_preserves_legacy_binary_members():
    mapping = CommonMapTypes.map_sqa_to_om_types()
    assert mapping[CustomTypes.BYTES.value] == set(BINARY_TYPES)
    assert mapping[sqlalchemy.LargeBinary] == {DataType.BINARY, DataType.MEDIUMBLOB, DataType.LONGBLOB}
    assert mapping[sqlalchemy.VARBINARY] == {DataType.VARBINARY}


def test_profiler_selects_original_sampler_columns():
    database = Database(id=uuid4(), name="binary_rules", service={"id": uuid4(), "type": "databaseService"})
    metadata = MagicMock()
    metadata.get_by_id.return_value = database
    entity = Table(
        id=uuid4(),
        name="binary_payloads",
        serviceType=DatabaseServiceType.SQLite,
        database={"id": database.id, "type": "database"},
        columns=[Column(name="binary", dataType=DataType.BINARY), Column(name="variable", dataType=DataType.VARBINARY)],
    )
    connection = SQLiteConnection()
    sampler = SQASampler(service_connection_config=connection, ometa_client=metadata, entity=entity)
    interface = SQAProfilerInterface(connection, metadata, entity, None, sampler, 1)
    try:
        columns = interface.get_columns()
        assert columns[0] is sampler.raw_dataset.__table__.c.binary
        assert columns[1] is sampler.raw_dataset.__table__.c.variable
        rules = [
            {"dataType": DataType.BINARY, "disabled": True},
            {"dataType": DataType.VARBINARY, "metrics": ["nullCount"]},
        ]
        assert selected(columns[0], rules, DatabaseServiceType.SQLite) == set()
        assert selected(columns[1], rules, DatabaseServiceType.SQLite) == {"nullCount"}
    finally:
        interface.close()
        sampler.close()


def test_unmapped_native_type_uses_defaults():
    assert (
        selected(
            sqlalchemy.Column("payload", sqlalchemy.types.NullType), [{"dataType": DataType.BINARY, "disabled": True}]
        )
        == DEFAULTS
    )


@pytest.mark.parametrize("rule,expected", [({"disabled": True}, set()), ({"metrics": ["nullCount"]}, {"nullCount"})])
def test_non_sqlalchemy_columns_keep_catalog_lookup(rule, expected):
    from metadata.utils.sqa_like_column import SQALikeColumn

    column = SQALikeColumn(name="payload", type=DataType.BINARY)
    assert selected(column, [{"dataType": DataType.BINARY, **rule}]) == expected
