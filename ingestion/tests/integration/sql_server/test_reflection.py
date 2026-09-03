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
"""What the MSSQL source reads straight from the server.

These assertions need a SQL Server but no OpenMetadata server: they drive the
source's own reads (descriptions per database, constraint reflection, view
typing) against the container, which is where the SQL itself is either right or
wrong. The catalogue-level counterparts live in test_metadata.py.
"""

from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.mssql.metadata import MssqlSource

from .conftest import (  # noqa: TID252
    FIRST_DATABASE_DESCRIPTION,
    FIRST_SCHEMA_DESCRIPTION,
    SECOND_DATABASE,
    SECOND_DATABASE_DESCRIPTION,
    SECOND_PROCEDURE_DESCRIPTION,
    SECOND_SCHEMA,
    SECOND_SCHEMA_DESCRIPTION,
)

FIRST_SCHEMA = "SalesLT"


@pytest.fixture(scope="module")
def source(mssql_container, db_name):
    """
    A source connected to master, so nothing it reads per database can come from
    the database it happened to connect to.
    """
    config = {
        "type": "mssql",
        "serviceName": "local_mssql_reflection",
        "serviceConnection": {
            "config": {
                "type": "Mssql",
                "scheme": "mssql+pytds",
                "username": mssql_container.username,
                "password": mssql_container.password,
                "hostPort": f"localhost:{mssql_container.get_exposed_port(mssql_container.port)}",
                "database": "master",
                "ingestAllDatabases": True,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "includeStoredProcedures": True,
                "databaseFilterPattern": {"includes": [db_name, SECOND_DATABASE]},
            }
        },
    }
    workflow_config = OpenMetadataWorkflowConfig.model_validate(
        {
            "source": config,
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "not-used"},
                }
            },
        }
    )
    # Nothing here calls the OpenMetadata API: the source only reads from SQL Server.
    with patch.object(CommonDbSourceService, "test_connection"):
        mssql_source = MssqlSource.create(config, workflow_config.workflowConfig.openMetadataServerConfig)
    # The framework puts the service in the context before walking the databases.
    mssql_source.context.get().__dict__["database_service"] = config["serviceName"]
    yield mssql_source
    mssql_source.close()


def _ingest_database(source, database: str, schema: str) -> None:
    """Walk the source to a database the way the framework does, then place the
    context on one of its schemas."""
    for name in source.get_database_names():
        if name == database:
            source.context.get().__dict__["database"] = database
            source.context.get().__dict__["database_schema"] = schema
            return
    raise AssertionError(f"{database} was never yielded")


def test_descriptions_are_read_from_the_database_being_ingested(source, db_name):
    """The description queries are scoped to the connected database, so a run that
    reads them before switching gets the previous database's - which no lookup
    matches, leaving every database silently undocumented."""
    schemas = {db_name: FIRST_SCHEMA, SECOND_DATABASE: SECOND_SCHEMA}
    descriptions = {}

    for database in source.get_database_names():
        source.context.get().__dict__["database"] = database
        descriptions[database] = (
            source.get_database_description(database),
            source.get_schema_description(schemas[database]),
        )

    assert descriptions == {
        db_name: (FIRST_DATABASE_DESCRIPTION, FIRST_SCHEMA_DESCRIPTION),
        SECOND_DATABASE: (SECOND_DATABASE_DESCRIPTION, SECOND_SCHEMA_DESCRIPTION),
    }


def test_stored_procedure_descriptions_are_read_from_the_database_being_ingested(source):
    _ingest_database(source, SECOND_DATABASE, SECOND_SCHEMA)

    description = source.get_stored_procedure_description("get_orders")

    assert description is not None
    assert description.root == SECOND_PROCEDURE_DESCRIPTION


def test_unique_constraints_are_reflected(source):
    """SQLAlchemy's MSSQL dialect reflects none, so they used to be dropped."""
    _ingest_database(source, SECOND_DATABASE, SECOND_SCHEMA)

    constraints = source.inspector.get_unique_constraints("orders", SECOND_SCHEMA)

    assert {constraint["name"]: constraint["column_names"] for constraint in constraints} == {
        "uq_orders_code": ["code"],
        "uq_orders_region_ref": ["region", "ref"],
    }


def test_an_indexed_view_is_typed_as_a_materialized_view(source):
    _ingest_database(source, SECOND_DATABASE, SECOND_SCHEMA)

    views = {view.name: view.type_ for view in source.query_view_names_and_types(SECOND_SCHEMA)}

    assert views == {
        "orders_indexed": TableType.MaterializedView,
        "orders_plain": TableType.View,
    }
