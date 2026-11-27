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
"""Greenplum container and distribution-policy fixtures."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import GreenplumConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection, DatabaseServiceType
from metadata.generated.schema.metadataIngestion.workflow import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource


@pytest.fixture(scope="package")
def greenplum_container():
    container = (
        DockerContainer("woblerr/greenplum:6.27.1")
        .with_env("GREENPLUM_PASSWORD", "local_test_password")
        .with_env("GREENPLUM_DATABASE_NAME", "demo_db")
        .with_exposed_ports(5432)
        .with_kwargs(hostname="greenplum", mem_limit="2g", shm_size="256m")
    )
    with container:
        wait_for_logs(container, "INFO - Execute custom init scripts", timeout=180)
        yield container


@pytest.fixture(scope="module")
def greenplum_engine(greenplum_container):
    engine = create_engine(
        URL.create(
            "postgresql+psycopg2",
            username="gpadmin",
            password="local_test_password",
            host=greenplum_container.get_container_host_ip(),
            port=int(greenplum_container.get_exposed_port(5432)),
            database="demo_db",
        )
    )
    try:
        with engine.connect() as connection:
            version = connection.execute(text("SELECT version()")).scalar_one()
            assert "Greenplum Database 6." in version, version
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(scope="module")
def create_service_request(greenplum_container, greenplum_engine):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_greenplum_{uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Greenplum,
        connection=DatabaseConnection(
            config=GreenplumConnection(
                username="gpadmin",
                authType={"password": "local_test_password"},
                hostPort=f"{greenplum_container.get_container_host_ip()}:{greenplum_container.get_exposed_port(5432)}",
                database="demo_db",
                ingestAllDatabases=False,
            )
        ),
    )


@pytest.fixture(scope="module")
def distribution_schemas(greenplum_engine):
    schema = f"om_dist_{uuid4().hex[:8]}"
    other_schema = f"{schema}_other"
    engine = greenplum_engine
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


@pytest.fixture(scope="module")
def greenplum_source(create_service_request):
    config = Source.model_validate(
        {
            "type": "greenplum",
            "serviceName": "test_greenplum",
            "serviceConnection": create_service_request.connection.model_dump(),
            "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeTags": False}},
        }
    )
    with patch.object(GreenplumSource, "test_connection"):
        source = GreenplumSource(config, MagicMock(spec=OpenMetadata))
    try:
        source.context.get().__dict__.update(database_service="test_greenplum", database="demo_db")
        yield source
    finally:
        source.close()
