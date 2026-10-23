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
"""End-to-end regression for the MSSQL description casing bug.

The single-database path yields the user-configured database name verbatim into
``context.database``, while the description maps are keyed by ``DB_NAME()``
(server-stored casing). On the default case-insensitive collation, a user can
configure e.g. ``database: northwind`` against a server-stored ``Northwind`` and
the connection succeeds — but Python dict lookups are case-sensitive, so before
the fix the database description (and, because the database key mismatched,
the schema and stored-procedure descriptions too) was silently dropped. This
test recreates that scenario end-to-end against a real SQL Server: it installs a
database under one casing, ingests it configured under a different casing, and
asserts all three description types attach.
"""

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.mssql.metadata import MssqlSource

from .conftest import SECOND_PROCEDURE_DESCRIPTION, SECOND_SCHEMA_DESCRIPTION  # noqa: TID252

# A database whose name the test creates with a non-trivial casing. The MSSQL
# default collation (SQL_Latin1_General_CP1_CI_AS) is case-insensitive, so a
# profile that asks for the lowercase spelling will connect and DB_NAME() will
# report the stored (mixed-case) spelling back — exactly the mismatch path.
SERVER_DB_NAME = "CaseMismatchDB"
USER_CONFIGURED_DB_NAME = "casemismatchdb"  # all-lowercase, intentionally different
SERVER_SCHEMA = "catalog_test"
DB_DESCRIPTION = "Case-mismatch database description"
SCHEMA_DESCRIPTION = SECOND_SCHEMA_DESCRIPTION
PROC_DESCRIPTION = SECOND_PROCEDURE_DESCRIPTION
PROC_NAME = "get_orders"


def _install_case_mismatch_database(mssql_container):
    """Create a database whose stored name casing differs from the casing the
    ingestion profile will request, then attach MS_Description extended
    properties to the database, a schema, and a stored procedure."""
    port = mssql_container.get_exposed_port(mssql_container.port)
    url = f"mssql+pytds://{mssql_container.username}:{mssql_container.password}@localhost:{port}/master?TrustServerCertificate=yes"
    engine = create_engine(url, connect_args={"autocommit": True})
    with engine.connect() as conn:
        trans = conn.begin()
        conn.execute(text(f"IF DB_ID('{SERVER_DB_NAME}') IS NOT NULL DROP DATABASE [{SERVER_DB_NAME}];"))
        conn.execute(text(f"CREATE DATABASE [{SERVER_DB_NAME}];"))
        conn.execute(text(f"USE [{SERVER_DB_NAME}];"))
        conn.execute(text(f"CREATE SCHEMA {SERVER_SCHEMA};"))
        conn.execute(text(f"CREATE PROCEDURE {SERVER_SCHEMA}.{PROC_NAME} AS SELECT 1;"))
        conn.execute(text(f"EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'{DB_DESCRIPTION}';"))
        conn.execute(
            text(
                f"EXEC sp_addextendedproperty @name = N'MS_Description', "
                f"@value = N'{SCHEMA_DESCRIPTION}', "
                f"@level0type = N'SCHEMA', @level0name = N'{SERVER_SCHEMA}';"
            )
        )
        conn.execute(
            text(
                f"EXEC sp_addextendedproperty @name = N'MS_Description', "
                f"@value = N'{PROC_DESCRIPTION}', "
                f"@level0type = N'SCHEMA', @level0name = N'{SERVER_SCHEMA}', "
                f"@level1type = N'PROCEDURE', @level1name = N'{PROC_NAME}';"
            )
        )
        conn.execute(text("USE [master];"))
        trans.commit()
    engine.dispose()


def _source_single_database(mssql_container, configured_db_name, service_name):
    config = {
        "type": "mssql",
        "serviceName": service_name,
        "serviceConnection": {
            "config": {
                "type": "Mssql",
                "scheme": "mssql+pytds",
                "username": mssql_container.username,
                "password": mssql_container.password,
                "hostPort": f"localhost:{mssql_container.get_exposed_port(mssql_container.port)}",
                "database": configured_db_name,
                "ingestAllDatabases": False,
                "connectionOptions": {"TrustServerCertificate": "yes"},
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeStoredProcedures": True}},
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
    with patch.object(CommonDbSourceService, "test_connection"):
        mssql_source = MssqlSource.create(config, workflow_config.workflowConfig.openMetadataServerConfig)
    mssql_source.context.get().__dict__["database_service"] = service_name
    return mssql_source


@pytest.fixture(scope="module")
def case_mismatch_source(mssql_container):
    """Install the cased-mismatched database once, then stand up a single-database
    source configured with a deliberately different (lowercase) casing."""
    _install_case_mismatch_database(mssql_container)
    source = _source_single_database(mssql_container, USER_CONFIGURED_DB_NAME, "local_mssql_case_mismatch")
    yield source
    source.close()


def _walk_to_database(source, database: str, schema: str) -> None:
    """Consume get_database_names() exactly as the topology does and place the
    context on the yielded database + a schema, mirroring the framework."""
    for name in source.get_database_names():
        if name == database:
            source.context.get().__dict__["database"] = name
            source.context.get().__dict__["database_schema"] = schema
            return
    raise AssertionError(f"{database} was never yielded by get_database_names()")


def test_database_description_resolves_under_casing_mismatch(case_mismatch_source):
    """The user requests ``casemismatchdb``; the server stores ``CaseMismatchDB``.
    The profile's connection succeeds (case-insensitive collation), so
    get_database_names() yields the user-cased name into context.database, but
    the description maps are keyed by DB_NAME() (= ``CaseMismatchDB``). The
    database description must still attach."""
    _walk_to_database(case_mismatch_source, USER_CONFIGURED_DB_NAME, SERVER_SCHEMA)
    assert case_mismatch_source.get_database_description(USER_CONFIGURED_DB_NAME) == DB_DESCRIPTION


def test_schema_description_resolves_under_casing_mismatch(case_mismatch_source):
    _walk_to_database(case_mismatch_source, USER_CONFIGURED_DB_NAME, SERVER_SCHEMA)
    assert case_mismatch_source.get_schema_description(SERVER_SCHEMA) == SCHEMA_DESCRIPTION


def test_stored_procedure_description_resolves_under_casing_mismatch(case_mismatch_source):
    _walk_to_database(case_mismatch_source, USER_CONFIGURED_DB_NAME, SERVER_SCHEMA)
    description = case_mismatch_source.get_stored_procedure_description(PROC_NAME)
    assert description is not None
    assert description.root == PROC_DESCRIPTION
