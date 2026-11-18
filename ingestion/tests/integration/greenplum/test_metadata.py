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
"""Greenplum 6 metadata tests; set GREENPLUM_TEST_URL to a disposable database."""

import os
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url

from metadata.generated.schema.entity.data.table import ConstraintType, TableType
from metadata.generated.schema.metadataIngestion.workflow import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource

pytestmark = pytest.mark.metadata


@pytest.fixture(scope="module")
def greenplum_source():
    connection_url = os.getenv("GREENPLUM_TEST_URL")
    if not connection_url:
        pytest.skip("GREENPLUM_TEST_URL is required")
    url = make_url(connection_url)
    config = Source.model_validate(
        {
            "type": "greenplum",
            "serviceName": "test_greenplum",
            "serviceConnection": {
                "config": {
                    "type": "Greenplum",
                    "username": url.username,
                    "authType": {"password": url.password},
                    "hostPort": f"{url.host}:{url.port or 5432}",
                    "database": url.database,
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeTags": False}},
        }
    )
    with patch.object(GreenplumSource, "test_connection"):
        source = GreenplumSource(config, MagicMock(spec=OpenMetadata))
    try:
        version = source.connection.execute(text("SELECT version()")).scalar_one()
        assert "Greenplum Database 6." in version, version
        source.context.get().__dict__.update(database_service="test_greenplum", database=url.database)
        yield source
    finally:
        source.close()


@pytest.fixture(scope="module")
def distribution_schemas(greenplum_source):
    schema = f"om_dist_{uuid4().hex[:8]}"
    other_schema = f"{schema}_other"
    engine = greenplum_source.engine
    try:
        with engine.begin() as connection:
            for name in (schema, other_schema):
                connection.execute(text(f'CREATE SCHEMA "{name}"'))
            for name, definition in {
                "single_key": "(id integer, region integer) DISTRIBUTED BY (id)",
                "composite_key": "(id integer, region integer) DISTRIBUTED BY (region, id)",
                "random_table": "(id integer, region integer) DISTRIBUTED RANDOMLY",
                "replicated_table": "(id integer, region integer) DISTRIBUTED REPLICATED",
                "partitioned_table": (
                    "(id integer, region integer) DISTRIBUTED BY (id) PARTITION BY RANGE (region) "
                    "(START (0) END (20) EVERY (10))"
                ),
                "primary_key_table": "(id integer, region integer, PRIMARY KEY (id, region)) DISTRIBUTED BY (id)",
                "unique_table": "(id integer, region integer, UNIQUE (id, region)) DISTRIBUTED BY (id)",
                "quoted_table": '("Key Column" integer, id integer) DISTRIBUTED BY ("Key Column")',
                "dropped_column_table": "(id integer, unused integer, region integer) DISTRIBUTED BY (region)",
            }.items():
                connection.execute(text(f'CREATE TABLE "{schema}"."{name}" {definition}'))
            connection.execute(text(f'ALTER TABLE "{schema}".dropped_column_table DROP COLUMN unused'))
            connection.execute(
                text(f'CREATE TABLE "{other_schema}".single_key (id integer, region integer) DISTRIBUTED BY (region)')
            )
            connection.execute(text(f'CREATE VIEW "{schema}".plain_view AS SELECT * FROM "{schema}".single_key'))
        yield schema, other_schema
    finally:
        with engine.begin() as connection:
            for name in (schema, other_schema):
                connection.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))


@pytest.mark.parametrize(
    ("table_name", "expected_keys"),
    [
        ("single_key", ["id"]),
        ("composite_key", ["region", "id"]),
        ("random_table", []),
        ("replicated_table", []),
        ("partitioned_table", ["id"]),
        ("primary_key_table", ["id"]),
        ("unique_table", ["id"]),
        ("quoted_table", ["Key Column"]),
        ("dropped_column_table", ["region"]),
        ("plain_view", []),
    ],
)
def test_table_requests_include_distribution_keys(greenplum_source, distribution_schemas, table_name, expected_keys):
    schema, _ = distribution_schemas
    greenplum_source.context.get().__dict__["database_schema"] = schema
    table_type = TableType.View if table_name == "plain_view" else TableType.Regular

    results = list(greenplum_source.yield_table((table_name, table_type)))

    assert len(results) == 1
    assert results[0].left is None, results[0].left
    request = results[0].right
    constraints = request.tableConstraints or []
    dist_keys = [c.columns for c in constraints if c.constraintType == ConstraintType.DIST_KEY]
    assert dist_keys == ([expected_keys] if expected_keys else [])
    if table_name == "primary_key_table":
        assert [c.columns for c in constraints if c.constraintType == ConstraintType.PRIMARY_KEY] == [["id", "region"]]
    if table_name == "unique_table":
        assert [c.columns for c in constraints if c.constraintType == ConstraintType.UNIQUE] == [["id", "region"]]
    if table_name == "partitioned_table":
        assert request.model_dump(mode="json")["tableType"] == "Partitioned"
        assert [c.columnName for c in request.tablePartition.columns] == ["region"]


def test_distribution_keys_are_scoped_to_schema(greenplum_source, distribution_schemas):
    expected_keys = (["id"], ["region"])
    for schema, keys in zip(distribution_schemas, expected_keys, strict=True):
        greenplum_source.context.get().__dict__["database_schema"] = schema
        result = next(greenplum_source.yield_table(("single_key", TableType.Regular)))
        assert result.left is None, result.left
        assert [c.columns for c in result.right.tableConstraints if c.constraintType == ConstraintType.DIST_KEY] == [
            keys
        ]


def test_distribution_query_error_keeps_table_and_next_table(greenplum_source, distribution_schemas, caplog):
    schema, _ = distribution_schemas
    greenplum_source.context.get().__dict__["database_schema"] = schema
    with patch(
        "metadata.ingestion.source.database.greenplum.metadata.GREENPLUM_DISTRIBUTION_KEYS",
        "SELECT attname FROM pg_catalog.om_missing_distribution_policy",
    ):
        result = next(greenplum_source.yield_table(("primary_key_table", TableType.Regular)))

    assert result.left is None, result.left
    assert [column.name.root for column in result.right.columns] == ["id", "region"]
    assert [(constraint.constraintType, constraint.columns) for constraint in result.right.tableConstraints] == [
        (ConstraintType.PRIMARY_KEY, ["id", "region"])
    ]
    assert "DIST_KEY" in caplog.text
    assert greenplum_source.connection.execute(text("SELECT 1")).scalar_one() == 1

    next_result = next(greenplum_source.yield_table(("single_key", TableType.Regular)))
    assert next_result.left is None, next_result.left
    assert [
        constraint.columns
        for constraint in next_result.right.tableConstraints
        if constraint.constraintType == ConstraintType.DIST_KEY
    ] == [["id"]]
