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
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
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


def get_connection_url(connection: UnityCatalogConnection) -> str:
    url = f"{connection.scheme.value}://{connection.hostPort}"
    if connection.catalog:
        url = f"{url}?catalog={quote_plus(connection.catalog)}"
    return url


def get_connection(connection: UnityCatalogConnection) -> WorkspaceClient:
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


def get_sqlalchemy_connection(connection: UnityCatalogConnection) -> Engine:
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


def select_test_catalog(
    workspace_client: WorkspaceClient,
    table_obj: DatabricksTable,
    configured_catalog: Optional[str],  # noqa: UP045
) -> None:
    """Pick the catalog used by the rest of the test-connection probes.

    Honors `configured_catalog` from the service config when set. Otherwise
    walks `catalogs.list()` and skips both `__databricks_internal` and any
    foreign/federated catalog — their `information_schema.*_tags` queries
    are pushed down to the source DB and fail on stale credentials.
    """
    if configured_catalog:
        table_obj.catalog_name = configured_catalog
        return
    for catalog in workspace_client.catalogs.list():
        if catalog.name == "__databricks_internal":
            continue
        catalog_type = str(getattr(catalog, "catalog_type", "") or "").upper()
        if "FOREIGN" in catalog_type:
            continue
        table_obj.catalog_name = catalog.name
        return


def test_connection(
    metadata: OpenMetadata,
    connection: WorkspaceClient,
    service_connection: UnityCatalogConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
    timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    table_obj = DatabricksTable()
    engine = get_sqlalchemy_connection(service_connection)

    def get_schemas(connection: WorkspaceClient, table_obj: DatabricksTable):
        for schema in connection.schemas.list(catalog_name=table_obj.catalog_name):
            if schema.name:
                table_obj.schema_name = schema.name
                return

    def get_tables(connection: WorkspaceClient, table_obj: DatabricksTable):
        if table_obj.catalog_name and table_obj.schema_name:
            for table in connection.tables.list(catalog_name=table_obj.catalog_name, schema_name=table_obj.schema_name):
                table_obj.name = table.name
                break

    def get_tags(service_connection: UnityCatalogConnection, table_obj: DatabricksTable):
        engine = get_sqlalchemy_connection(service_connection)
        with engine.connect() as connection:  # noqa: PLR1704
            connection.execute(
                text(UNITY_CATALOG_GET_CATALOGS_TAGS.format(database=table_obj.catalog_name).replace(";", " limit 1;"))
            )
            connection.execute(
                text(
                    UNITY_CATALOG_GET_ALL_SCHEMA_TAGS.format(database=table_obj.catalog_name).replace(";", " limit 1;")
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
        "GetDatabases": partial(select_test_catalog, connection, table_obj, service_connection.catalog),
        "GetSchemas": partial(get_schemas, connection, table_obj),
        "GetTables": partial(get_tables, connection, table_obj),
        "GetViews": partial(get_tables, connection, table_obj),
        "GetQueries": partial(test_lineage_tables, engine),
        "GetTags": partial(get_tags, service_connection, table_obj),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=service_connection.connectionTimeout or timeout_seconds,
    )
