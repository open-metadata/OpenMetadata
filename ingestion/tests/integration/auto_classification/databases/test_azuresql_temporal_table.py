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
"""
Full integration tests for AzureSQL temporal table handling.

Tests the complete workflow:
  1. Register AzureSQL service in OpenMetadata
  2. Create temporal table in the live DB and seed rows
  3. Run MetadataWorkflow to ingest table structure
  4. Run AutoClassificationWorkflow to sample and classify data
  5. Assert sample data exists and excludes temporal period columns

=============================================================================
REQUIRED SQL PERMISSIONS
=============================================================================

The test user (AZURE_SQL_USERNAME) must have the following permissions on the
target database. Run these statements as a db_owner or sysadmin before the
test, substituting <user> with the value of AZURE_SQL_USERNAME:

  -- Schema-level: create and drop tables
  GRANT CREATE TABLE TO [<user>];
  GRANT ALTER ON SCHEMA::dbo TO [<user>];

  -- Table-level: read and write data
  GRANT SELECT ON SCHEMA::dbo TO [<user>];
  GRANT INSERT ON SCHEMA::dbo TO [<user>];

  -- Required to disable system-versioning during teardown
  -- (without this, DROP TABLE fails with 4902 / "cannot find the object")
  GRANT CONTROL ON SCHEMA::dbo TO [<user>];

  -- Required for metadata ingestion (sys catalog reads)
  GRANT VIEW DEFINITION ON DATABASE::<dbname> TO [<user>];
  GRANT VIEW DATABASE STATE TO [<user>];

  -- If using Azure SQL, also ensure the login is allowed through the firewall
  -- and that the user is mapped to the database:
  --   CREATE USER [<user>] FOR LOGIN [<user>];
  --   ALTER ROLE db_datareader ADD MEMBER [<user>];
  --   ALTER ROLE db_datawriter ADD MEMBER [<user>];

TROUBLESHOOTING
---------------
- Error 4902 "Cannot find the object … because it does not exist or you do not
  have permissions": almost always a missing CONTROL or ALTER permission on
  the schema (not a missing table). Grant CONTROL ON SCHEMA::dbo as above.
- Error 18456 "Login failed": wrong credentials or the login is not mapped to
  the database. Verify AZURE_SQL_USERNAME / AZURE_SQL_PASSWORD and that the
  user exists in the database (CREATE USER … FOR LOGIN …).
- Error 40615 / 40544 (firewall): add the client IP to the Azure SQL firewall
  rules in the Azure portal or via:
    EXEC sp_set_firewall_rule N'test_runner', '<ip>', '<ip>';

=============================================================================

Required environment variables:
  AZURE_SQL_HOST       - AzureSQL server host (e.g. "myserver.database.windows.net,1433")
  AZURE_SQL_DATABASE   - Database name
  AZURE_SQL_USERNAME   - SQL authentication username
  AZURE_SQL_PASSWORD   - SQL authentication password

Optional:
  AZURE_SQL_DRIVER     - ODBC driver name (default: "ODBC Driver 18 for SQL Server")
  AZURE_SQL_CLEANUP    - Drop test tables after the run (default: "true"; set to "false" to keep them)
"""

import logging
import os
import uuid

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
    AzureSQLScheme,
    AzureSQLType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow

logger = logging.getLogger(__name__)


REQUIRED_ENV_VARS = [
    "AZURE_SQL_HOST",
    "AZURE_SQL_DATABASE",
    "AZURE_SQL_USERNAME",
    "AZURE_SQL_PASSWORD",
]

AZURE_SQL_DRIVER = os.environ.get("AZURE_SQL_DRIVER", "ODBC Driver 18 for SQL Server")
AZURE_SQL_CLEANUP = os.environ.get("AZURE_SQL_CLEANUP", "true").lower() == "true"

pytestmark = pytest.mark.skipif(
    not all(os.environ.get(v) for v in REQUIRED_ENV_VARS),
    reason="AzureSQL temporal table integration tests require environment variables: " + ", ".join(REQUIRED_ENV_VARS),
)


@pytest.fixture(scope="module")
def table_suffix():
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def create_service_request():
    return CreateDatabaseServiceRequest(
        name=f"azuresql_temporal_test_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.AzureSQL,
        connection=DatabaseConnection(
            config=AzureSQLConnection(
                type=AzureSQLType.AzureSQL,
                scheme=AzureSQLScheme.mssql_pyodbc,
                username=os.environ["AZURE_SQL_USERNAME"],
                password=os.environ["AZURE_SQL_PASSWORD"],
                hostPort=os.environ["AZURE_SQL_HOST"],
                database=os.environ["AZURE_SQL_DATABASE"],
                driver=AZURE_SQL_DRIVER,
            )
        ),
    )


@pytest.fixture(scope="module")
def ensure_temporal_table(db_service, table_suffix):
    conn_config = db_service.connection.config
    driver = (conn_config.driver or AZURE_SQL_DRIVER).replace(" ", "+")
    password = conn_config.password.get_secret_value() if conn_config.password else os.environ["AZURE_SQL_PASSWORD"]
    connection_url = (
        f"mssql+pyodbc://{conn_config.username}:{password}"
        f"@{conn_config.hostPort}/{conn_config.database}"
        f"?driver={driver}&Encrypt=yes&TrustServerCertificate=no"
    )
    engine = create_engine(connection_url, echo=False)

    table_name = f"om_test_temporal_{table_suffix}"
    history_name = f"{table_name}_history"

    with engine.connect() as conn:
        conn.execute(
            text(f"""
            IF OBJECT_ID('dbo.[{table_name}]', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.[{table_name}] (
                    id INT PRIMARY KEY,
                    name NVARCHAR(100),
                    email NVARCHAR(100),
                    ValidFrom DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
                    ValidTo   DATETIME2 GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
                    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo)
                ) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.[{history_name}]))
            END
            """)
        )
        conn.commit()
        conn.execute(
            text(f"""
            IF NOT EXISTS (SELECT 1 FROM dbo.[{table_name}] WHERE id IN (1, 2, 3))
            BEGIN
                INSERT INTO dbo.[{table_name}] (id, name, email) VALUES
                (1, 'Alice', 'alice@example.com'),
                (2, 'Bob',   'bob@example.com'),
                (3, 'Carol', 'carol@example.com')
            END
            """)
        )
        conn.commit()

    yield table_name

    if AZURE_SQL_CLEANUP:
        with engine.connect() as conn:
            for stmt in [
                f"ALTER TABLE dbo.[{table_name}] SET (SYSTEM_VERSIONING = OFF)",
                f"DROP TABLE IF EXISTS dbo.[{table_name}]",
                f"DROP TABLE IF EXISTS dbo.[{history_name}]",
            ]:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception as exc:
                    logger.error(
                        "Cleanup failed for %r: %s. "
                        "If the error mentions 'does not exist or you do not have permissions' (4902), "
                        "the user lacks ALTER/CONTROL on the schema. "
                        "Grant it with: GRANT CONTROL ON SCHEMA::dbo TO [<user>]",
                        stmt,
                        exc,
                    )

    engine.dispose()


@pytest.fixture(scope="module")
def table_name(ensure_temporal_table):
    return ensure_temporal_table


@pytest.fixture(scope="module")
def ingestion_config(db_service, workflow_config, sink_config, table_name):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": DatabaseMetadataConfigType.DatabaseMetadata.value,
                    "tableFilterPattern": FilterPattern(includes=[f"^{table_name}$"]),
                    "schemaFilterPattern": FilterPattern(includes=["^dbo$"]),
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def autoclassification_config(db_service, workflow_config, sink_config, table_name):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "tableFilterPattern": FilterPattern(includes=[f"^{table_name}$"]),
                    "schemaFilterPattern": FilterPattern(includes=["^dbo$"]),
                    "storeSampleData": True,
                    "enableAutoClassification": False,
                }
            },
        },
        "processor": {"type": "orm-profiler", "config": {}},
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def load_metadata(run_workflow, ingestion_config, ensure_temporal_table, patch_passwords_for_db_services):
    return run_workflow(MetadataWorkflow, ingestion_config)


@pytest.fixture(scope="module")
def run_classification(run_workflow, autoclassification_config, load_metadata, patch_passwords_for_db_services):
    return run_workflow(AutoClassificationWorkflow, autoclassification_config)


class TestAzureSQLTemporalTableFullWorkflow:
    def test_temporal_columns_excluded_from_sample_data(
        self,
        db_service: DatabaseService,
        metadata,
        table_name: str,
        run_classification,
    ) -> None:
        table_fqn = f"{db_service.fullyQualifiedName.root}.{db_service.connection.config.database}.dbo.{table_name}"
        table = metadata.get_by_name(entity=Table, fqn=table_fqn)
        assert table is not None, f"Table not found: {table_fqn}"

        result = metadata.get_sample_data(table)
        assert result is not None
        assert result.sampleData is not None
        assert len(result.sampleData.rows) > 0

        column_names = [col.root for col in result.sampleData.columns]
        assert "ValidFrom" not in column_names, "ValidFrom must be excluded from sample data"
        assert "ValidTo" not in column_names, "ValidTo must be excluded from sample data"
        assert "id" in column_names
        assert "name" in column_names
        assert "email" in column_names

    def test_workflow_does_not_raise_on_temporal_table(
        self,
        db_service: DatabaseService,
        metadata,
        table_name: str,
        run_classification,
    ) -> None:
        table_fqn = f"{db_service.fullyQualifiedName.root}.{db_service.connection.config.database}.dbo.{table_name}"
        table = metadata.get_by_name(entity=Table, fqn=table_fqn)
        assert table is not None, f"Table not found: {table_fqn}"
