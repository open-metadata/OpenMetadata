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
Source connection handler
"""

from copy import deepcopy
from functools import partial
from typing import Optional
from urllib.parse import quote_plus

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import TableType
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection as UnityCatalogConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.databricks.auth import get_auth_config
from metadata.ingestion.source.database.databricks.log_filters import (
    suppress_user_agent_entry_deprecation_log,
)
from metadata.ingestion.source.database.unitycatalog.models import DatabricksTable
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_GET_ALL_SCHEMA_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_TAGS,
    UNITY_CATALOG_GET_CATALOGS_TAGS,
    UNITY_CATALOG_TEST_COLUMN_LINEAGE,
    UNITY_CATALOG_TEST_TABLE_LINEAGE,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.db_utils import get_host_from_host_port

suppress_user_agent_entry_deprecation_log()

INTERNAL_CATALOG = "__databricks_internal"
VIEW_TABLE_TYPES = {TableType.VIEW, TableType.MATERIALIZED_VIEW}
VIEW_LISTING_SCAN_LIMIT = 100


def _require_resolved_catalog_and_schema(table_obj: DatabricksTable) -> tuple[str, str]:
    """
    Fail the test connection step loudly when the previous steps could not
    resolve a catalog and schema, instead of silently passing.
    """
    if not (table_obj.catalog_name and table_obj.schema_name):
        raise SourceConnectionException(
            f"Could not resolve a catalog (got: {table_obj.catalog_name}) and schema "
            f"(got: {table_obj.schema_name}) from the previous steps. Validate that the configured "
            "catalog and schema exist and that the user has `USE CATALOG` and `USE SCHEMA` privileges on them."
        )
    return table_obj.catalog_name, table_obj.schema_name


def get_catalogs(connection: WorkspaceClient, table_obj: DatabricksTable, catalog_name: Optional[str] = None) -> None:  # noqa: UP045
    """
    Resolve the catalog used by the remaining test connection steps. If a catalog is
    configured on the connection, validate access to that exact catalog.
    """
    if catalog_name:
        table_obj.catalog_name = connection.catalogs.get(catalog_name).name
    else:
        for catalog in connection.catalogs.list():
            if catalog.name != INTERNAL_CATALOG:
                table_obj.catalog_name = catalog.name
                break


def get_schemas(connection: WorkspaceClient, table_obj: DatabricksTable, schema_name: Optional[str] = None) -> None:  # noqa: UP045
    """
    Resolve the schema used by the remaining test connection steps. If a databaseSchema is
    configured on the connection, validate access to that exact schema.
    """
    if not table_obj.catalog_name:
        raise SourceConnectionException(
            "Could not resolve a catalog from the previous steps. Validate that the user "
            "has `USE CATALOG` privilege on at least one catalog."
        )
    if schema_name:
        table_obj.schema_name = connection.schemas.get(f"{table_obj.catalog_name}.{schema_name}").name
    else:
        for schema in connection.schemas.list(catalog_name=table_obj.catalog_name):
            if schema.name:
                table_obj.schema_name = schema.name
                break


def get_tables(connection: WorkspaceClient, table_obj: DatabricksTable) -> None:
    """
    Validate that tables can be listed from the resolved catalog and schema.
    """
    catalog_name, schema_name = _require_resolved_catalog_and_schema(table_obj)
    # Only one table is needed to validate access; max_results=1 avoids
    # downloading the schema's full table list in a single response.
    for table in connection.tables.list(catalog_name=catalog_name, schema_name=schema_name, max_results=1):
        table_obj.name = table.name
        break


def get_views(connection: WorkspaceClient, table_obj: DatabricksTable) -> None:
    """
    Validate that views can be listed from the resolved catalog and schema.

    Scan at most VIEW_LISTING_SCAN_LIMIT objects: the goal is to confirm the listing
    call works and exposes view types, not to enumerate every object. A schema with no
    views would otherwise force a full paginated scan that could trip the overall
    test-connection timeout on large schemas.
    """
    catalog_name, schema_name = _require_resolved_catalog_and_schema(table_obj)
    listed_tables = connection.tables.list(
        catalog_name=catalog_name,
        schema_name=schema_name,
        max_results=VIEW_LISTING_SCAN_LIMIT,
        omit_columns=True,
        omit_properties=True,
    )
    for scanned, table in enumerate(listed_tables, start=1):
        if table.table_type in VIEW_TABLE_TYPES or scanned >= VIEW_LISTING_SCAN_LIMIT:
            break


def get_connection_url(connection: UnityCatalogConnectionConfig) -> str:
    url = f"{connection.scheme.value}://{connection.hostPort}"
    if connection.catalog:
        url = f"{url}?catalog={quote_plus(connection.catalog)}"
    return url


def get_connection(connection: UnityCatalogConnectionConfig) -> WorkspaceClient:
    """
    Create connection
    """
    client_params = {}
    if isinstance(connection.authType, PersonalAccessToken):
        client_params["token"] = connection.authType.token.get_secret_value()
    elif isinstance(connection.authType, DatabricksOauth):
        client_params["client_id"] = connection.authType.clientId
        client_params["client_secret"] = connection.authType.clientSecret.get_secret_value()
    elif isinstance(connection.authType, AzureAdSetup):
        client_params["azure_client_id"] = connection.authType.azureClientId
        client_params["azure_client_secret"] = connection.authType.azureClientSecret.get_secret_value()
        client_params["azure_tenant_id"] = connection.authType.azureTenantId

    return WorkspaceClient(host=get_host_from_host_port(connection.hostPort), **client_params)


def get_sqlalchemy_connection(connection: UnityCatalogConnectionConfig) -> Engine:
    """
    Create sqlalchemy connection
    """

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.httpPath:
        connection.connectionArguments.root["http_path"] = connection.httpPath

    auth_args = get_auth_config(connection)

    original_connection_arguments = connection.connectionArguments
    connection.connectionArguments = deepcopy(original_connection_arguments)
    connection.connectionArguments.root.update(auth_args)

    engine = create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )
    connection.connectionArguments = original_connection_arguments
    return engine


class UnityCatalogConnection(BaseConnection[UnityCatalogConnectionConfig, WorkspaceClient]):
    def _get_client(self) -> WorkspaceClient:
        return get_connection(self.service_connection)

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        connection = self.client
        service_connection = self.service_connection

        table_obj = DatabricksTable()
        engine = get_sqlalchemy_connection(service_connection)

        def get_tags(service_connection: UnityCatalogConnectionConfig, table_obj: DatabricksTable):
            engine = get_sqlalchemy_connection(service_connection)
            with engine.connect() as connection:
                connection.execute(
                    text(
                        UNITY_CATALOG_GET_CATALOGS_TAGS.format(database=table_obj.catalog_name).replace(
                            ";", " limit 1;"
                        )
                    )
                )
                connection.execute(
                    text(
                        UNITY_CATALOG_GET_ALL_SCHEMA_TAGS.format(database=table_obj.catalog_name).replace(
                            ";", " limit 1;"
                        )
                    )
                )
                connection.execute(
                    text(
                        UNITY_CATALOG_GET_ALL_TABLE_TAGS.format(
                            database=table_obj.catalog_name, schema=table_obj.schema_name
                        ).replace(";", " limit 1;")
                    )
                )
                connection.execute(
                    text(
                        UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS.format(
                            database=table_obj.catalog_name, schema=table_obj.schema_name
                        ).replace(";", " limit 1;")
                    )
                )

        def test_lineage_tables(engine: Engine):
            with engine.connect() as conn:
                conn.execute(text(UNITY_CATALOG_TEST_TABLE_LINEAGE)).fetchone()
                conn.execute(text(UNITY_CATALOG_TEST_COLUMN_LINEAGE)).fetchone()

        test_fn = {
            "CheckAccess": connection.catalogs.list,
            "GetDatabases": partial(get_catalogs, connection, table_obj, service_connection.catalog),
            "GetSchemas": partial(get_schemas, connection, table_obj, service_connection.databaseSchema),
            "GetTables": partial(get_tables, connection, table_obj),
            "GetViews": partial(get_views, connection, table_obj),
            "GetQueries": partial(test_lineage_tables, engine),
            "GetTags": partial(get_tags, service_connection, table_obj),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=service_connection.connectionTimeout or timeout_seconds,
        )
