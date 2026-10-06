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

"""Trino types a table from its catalog's connector, so a `delta_lake` catalog must reach the
API as `DeltaLake`. The `delta` catalog and the `minio` (hive) catalog share one metastore, which
is the deployment where the type matters."""

import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def create_service_request(trino_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_trino_delta_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Trino,
        connection=DatabaseConnection(
            config=TrinoConnection(
                username=trino_container.user,
                hostPort=f"localhost:{trino_container.get_exposed_port(trino_container.port)}",
                catalog="delta",
                connectionArguments={"http_scheme": "http"},
            )
        ),
    )


@pytest.fixture(scope="module")
def create_delta_table(trino_container):
    engine = create_engine(make_url(trino_container.get_connection_url()).set(database="delta"))
    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE SCHEMA IF NOT EXISTS delta.delta_schema WITH (location = 's3a://hive-warehouse/delta_schema')"
                )
            )
            conn.execute(
                text("CREATE TABLE delta.delta_schema.delta_sales (id integer, region varchar, amount double)")
            )
            conn.execute(
                text("INSERT INTO delta.delta_schema.delta_sales VALUES (1, 'emea', 10.5), (2, 'apac', 20.25)")
            )
            conn.commit()
        yield
    finally:
        try:
            # The delta and minio catalogs share one metastore, so leaving the schema behind
            # would expose an unreadable Delta table to every later module in this package.
            # This runs even when the setup above fails part-way, which would otherwise leak
            # a committed table into the metastore for the rest of the package run.
            with engine.connect() as conn:
                conn.execute(text("DROP TABLE IF EXISTS delta.delta_schema.delta_sales"))
                conn.execute(text("DROP SCHEMA IF EXISTS delta.delta_schema"))
                conn.commit()
        finally:
            engine.dispose()


@pytest.fixture(scope="module")
def run_workflow(run_workflow, ingestion_config, create_delta_table):
    run_workflow(MetadataWorkflow, ingestion_config)


def test_delta_lake_catalog_table_is_typed_delta_lake(run_workflow, db_service, metadata: OpenMetadata):
    table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.delta.delta_schema.delta_sales",
    )

    assert table is not None
    assert table.tableType == TableType.DeltaLake
    assert [column.name.root for column in table.columns] == ["id", "region", "amount"]
