#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Ingesting every database on the server, without ingesting the server itself.

Informix creates sysmaster, sysadmin, sysuser and sysutils on every instance.
They are not empty placeholders the way Postgres's template databases are --
sysmaster alone carries over 200 monitoring tables -- so ingesting all databases
without excluding them buries a user's real ones under several hundred internal
ones.
"""

import uuid

import pytest
from tests.integration.informix.conftest import (
    ANSI_DATABASE,
    DATABASE,
    INFORMIX_PORT,
    PASSWORD,
    SECOND_DATABASE,
    SERVER_NAME,
    THIRD_DATABASE,
    USERNAME,
)

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.metadata import MetadataWorkflow

SYSTEM_DATABASES = ["sysmaster", "sysadmin", "sysuser", "sysutils"]


@pytest.fixture(scope="module")
def create_service_request(informix_container):
    """Overrides the shared fixture so this module ingests every database."""
    return CreateDatabaseServiceRequest(
        name="docker_test_informix_alldbs_" + uuid.uuid4().hex[:8],
        serviceType=DatabaseServiceType.Informix,
        connection=DatabaseConnection(
            config=InformixConnection(
                username=USERNAME,
                password=PASSWORD,
                hostPort=f"localhost:{informix_container.get_exposed_port(INFORMIX_PORT)}",
                database=DATABASE,
                serverName=SERVER_NAME,
                ingestAllDatabases=True,
            )
        ),
    )


@pytest.fixture(scope="module")
def ingested_databases(patch_passwords_for_db_services, run_workflow, ingestion_config, metadata, db_service) -> set:
    run_workflow(MetadataWorkflow, ingestion_config)
    listed = metadata.list_entities(
        entity=Database, params={"service": db_service.fullyQualifiedName.root}, limit=100
    ).entities
    return {model_str(database.name) for database in listed}


class TestIngestAllDatabases:
    def test_every_user_database_is_ingested(self, ingested_databases):
        assert {DATABASE, SECOND_DATABASE, THIRD_DATABASE, ANSI_DATABASE} <= ingested_databases

    def test_logging_mode_does_not_affect_inclusion(self, ingested_databases):
        """The filter keys off a flag bit that shares a field with logging mode.

        A buffered-logging database has different flags from a plain one; if the
        mask were wrong it would be dropped silently rather than reported.
        """
        assert THIRD_DATABASE in ingested_databases

    @pytest.mark.parametrize("system_database", SYSTEM_DATABASES)
    def test_server_databases_are_not_ingested(self, ingested_databases, system_database):
        assert system_database not in ingested_databases

    def test_nothing_but_user_databases_arrives(self, ingested_databases):
        assert ingested_databases == {
            DATABASE,
            SECOND_DATABASE,
            THIRD_DATABASE,
            ANSI_DATABASE,
        }, sorted(ingested_databases)


class TestColumnTypesAcrossDatabases:
    """Every Informix database owns its tables as "informix"."""

    def test_a_large_object_in_the_second_database_is_typed(
        self, patch_passwords_for_db_services, run_workflow, ingestion_config, metadata, db_service
    ):
        """orders.receipt is a CLOB, and only the second database has it.

        Cached per schema name, this column keeps the VARCHAR(2147483647) the
        driver reports for every large object, and the profiler then fails on it
        with "Type (clob) is not hashable".
        """
        run_workflow(MetadataWorkflow, ingestion_config)
        fqn = f"{db_service.fullyQualifiedName.root}.{SECOND_DATABASE}.informix.orders"
        table = metadata.get_by_name(entity=Table, fqn=fqn, fields=["columns"])
        assert table is not None, f"{fqn} was not ingested"

        receipt = next(c for c in table.columns if model_str(c.name) == "receipt")
        assert receipt.dataType == DataType.CLOB, receipt.dataTypeDisplay
