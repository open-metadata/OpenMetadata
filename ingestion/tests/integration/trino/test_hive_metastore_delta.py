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

"""Every writer registers a Delta table in the Hive metastore by writing
`spark.sql.sources.provider` into TABLE_PARAMS, so the hive connector reading that metastore
directly must type it `DeltaLake` while a plain Hive table in the same metastore stays `Regular`.

These live in the trino package because the metastore stack this needs -- mariadb, a Hive
metastore, S3, and a writer that produces a real `_delta_log` -- is already assembled here.
Trino writes the provider upper case as `DELTA`, which is what makes the comparison
case-insensitive rather than defensive.
"""

import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

DELTA_SCHEMA = "hive_delta_probe"
PLAIN_SCHEMA = "hive_plain_probe"


def _metastore_connection(mysql_container) -> MysqlConnection:
    return MysqlConnection(
        username=mysql_container.username,
        authType=BasicAuth(password=mysql_container.password),
        hostPort=f"localhost:{mysql_container.get_exposed_port(mysql_container.port)}",
        databaseSchema=mysql_container.dbname,
    )


@pytest.fixture(scope="module")
def create_service_request(mysql_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_hive_metastore_delta_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Hive,
        connection=DatabaseConnection(
            config=HiveConnection(
                # A configured metastore replaces HiveServer2 entirely, so no server listens here.
                hostPort="localhost:10000",
                databaseName="default",
                metastoreConnection=_metastore_connection(mysql_container),
            )
        ),
    )


@pytest.fixture(scope="module")
def unmask_password(mysql_container):
    """The server masks the metastore password on read; the workflow needs the real one."""

    def patch_password(service: DatabaseService) -> DatabaseService:
        service.connection.config.metastoreConnection = _metastore_connection(mysql_container)
        return service

    return patch_password


@pytest.fixture(scope="module")
def create_metastore_tables(trino_container):
    """One Delta table, one partitioned Delta table and one plain Hive table, same metastore."""
    delta = create_engine(make_url(trino_container.get_connection_url()).set(database="delta"))
    hive = create_engine(make_url(trino_container.get_connection_url()).set(database="minio"))

    def _run(engine, *statements):
        with engine.connect() as conn:
            for statement in statements:
                conn.execute(text(statement))
            conn.commit()

    try:
        _run(
            delta,
            f"CREATE SCHEMA IF NOT EXISTS delta.{DELTA_SCHEMA} WITH (location = 's3a://hive-warehouse/{DELTA_SCHEMA}')",
            f"CREATE TABLE delta.{DELTA_SCHEMA}.delta_sales (id integer, region varchar, amount double)",
            f"INSERT INTO delta.{DELTA_SCHEMA}.delta_sales VALUES (1, 'emea', 10.5), (2, 'apac', 20.25)",
            f"CREATE TABLE delta.{DELTA_SCHEMA}.delta_sales_partitioned (id integer, region varchar) "
            f"WITH (partitioned_by = ARRAY['region'])",
            f"INSERT INTO delta.{DELTA_SCHEMA}.delta_sales_partitioned VALUES (1, 'emea'), (2, 'apac')",
        )
        _run(
            hive,
            f"CREATE SCHEMA IF NOT EXISTS minio.{PLAIN_SCHEMA} WITH (location = 's3a://hive-warehouse/{PLAIN_SCHEMA}')",
            f"CREATE TABLE minio.{PLAIN_SCHEMA}.hive_orders (id integer, sku varchar)",
            f"INSERT INTO minio.{PLAIN_SCHEMA}.hive_orders VALUES (1, 'sku-a'), (2, 'sku-b')",
        )
        yield
        # The delta and minio catalogs share one metastore, so leaving these behind would
        # expose them to every later module in this package.
        _run(
            delta,
            f"DROP TABLE IF EXISTS delta.{DELTA_SCHEMA}.delta_sales_partitioned",
            f"DROP TABLE IF EXISTS delta.{DELTA_SCHEMA}.delta_sales",
            f"DROP SCHEMA IF EXISTS delta.{DELTA_SCHEMA}",
        )
        _run(
            hive,
            f"DROP TABLE IF EXISTS minio.{PLAIN_SCHEMA}.hive_orders",
            f"DROP SCHEMA IF EXISTS minio.{PLAIN_SCHEMA}",
        )
    finally:
        delta.dispose()
        hive.dispose()


@pytest.fixture(scope="module")
def ingestion_config(ingestion_config):
    ingestion_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "includes": [f"^{DELTA_SCHEMA}$", f"^{PLAIN_SCHEMA}$"],
    }
    return ingestion_config


@pytest.fixture(scope="module")
def run_workflow(run_workflow, ingestion_config, create_metastore_tables):
    run_workflow(MetadataWorkflow, ingestion_config)


def _table(metadata: OpenMetadata, db_service: DatabaseService, schema: str, name: str) -> Table:
    table = metadata.get_by_name(Table, f"{db_service.fullyQualifiedName.root}.default.{schema}.{name}")
    assert table is not None, f"{schema}.{name} was not ingested"
    return table


def test_metastore_delta_table_is_typed_delta_lake(run_workflow, db_service, metadata: OpenMetadata):
    assert _table(metadata, db_service, DELTA_SCHEMA, "delta_sales").tableType == TableType.DeltaLake


def test_metastore_partitioned_delta_table_is_typed_delta_lake(run_workflow, db_service, metadata: OpenMetadata):
    """The metastore records no PARTITION_KEYS for a Delta table -- the partitioning lives in
    `_delta_log`, which the connector must not read -- so the type is DeltaLake, not Partitioned."""
    table = _table(metadata, db_service, DELTA_SCHEMA, "delta_sales_partitioned")

    assert table.tableType == TableType.DeltaLake
    assert table.tablePartition is None


def test_plain_hive_table_in_the_same_metastore_stays_regular(run_workflow, db_service, metadata: OpenMetadata):
    """The indicator is a property of the table row, so a shared metastore cannot spread it."""
    assert _table(metadata, db_service, PLAIN_SCHEMA, "hive_orders").tableType == TableType.Regular
