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
"""Greenplum metadata ingestion against a disposable Greenplum 6 container."""

from unittest.mock import patch

import pytest
from sqlalchemy import text

from metadata.generated.schema.entity.data.table import ConstraintType, Table, TableType
from metadata.workflow.metadata import MetadataWorkflow

pytestmark = pytest.mark.metadata


@pytest.fixture(scope="module")
def ingested_metadata(
    patch_passwords_for_db_services, run_workflow, ingestion_config, metadata, db_service, distribution_schemas
):
    config = ingestion_config["source"]["sourceConfig"]["config"]
    config["schemaFilterPattern"] = {"includes": [f"^{schema}$" for schema in distribution_schemas]}
    config["includeTags"] = False
    run_workflow(MetadataWorkflow, ingestion_config)
    return metadata, db_service


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
def test_ingested_tables_include_distribution_keys(ingested_metadata, distribution_schemas, table_name, expected_keys):
    metadata, service = ingested_metadata
    schema, _ = distribution_schemas
    fqn = f"{service.fullyQualifiedName.root}.demo_db.{schema}.{table_name}"
    table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["tableConstraints", "tablePartition"])
    assert table is not None, f"{fqn} was not ingested"
    constraints = table.tableConstraints or []
    dist_keys = [c.columns for c in constraints if c.constraintType == ConstraintType.DIST_KEY]
    assert dist_keys == ([expected_keys] if expected_keys else [])
    if table_name == "primary_key_table":
        assert [c.columns for c in constraints if c.constraintType == ConstraintType.PRIMARY_KEY] == [["id", "region"]]
    if table_name == "unique_table":
        assert [c.columns for c in constraints if c.constraintType == ConstraintType.UNIQUE] == [["id", "region"]]
    if table_name == "partitioned_table":
        assert table.tableType == TableType.Partitioned
        assert [c.columnName for c in table.tablePartition.columns] == ["region"]


def test_distribution_keys_are_scoped_to_schema(ingested_metadata, distribution_schemas):
    metadata, service = ingested_metadata
    for schema, keys in zip(distribution_schemas, (["id"], ["region"]), strict=True):
        fqn = f"{service.fullyQualifiedName.root}.demo_db.{schema}.single_key"
        table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["tableConstraints", "tablePartition"])
        assert table is not None, f"{fqn} was not ingested"
        assert [c.columns for c in table.tableConstraints if c.constraintType == ConstraintType.DIST_KEY] == [keys]


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
