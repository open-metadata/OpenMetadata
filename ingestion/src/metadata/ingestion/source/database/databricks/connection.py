#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""
from functools import partial
from typing import Optional, Union

from databricks.sdk import WorkspaceClient
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.databricks.client import DatabricksClient
from metadata.ingestion.source.database.databricks.models import DatabricksTable
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_CATALOGS,
)
from metadata.utils.db_utils import get_host_from_host_port


def get_connection_url(connection: DatabricksConnection) -> str:
    url = f"{connection.scheme.value}://token:{connection.token.get_secret_value()}@{connection.hostPort}"
    return url


def get_connection(connection: DatabricksConnection) -> Union[Engine, WorkspaceClient]:
    """
    Create connection
    """

    if connection.useUnityCatalog:
        return WorkspaceClient(
            host=get_host_from_host_port(connection.hostPort),
            token=connection.token.get_secret_value(),
        )

    if connection.httpPath:
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.__root__["http_path"] = connection.httpPath

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    connection: Union[Engine, WorkspaceClient],
    service_connection: DatabricksConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    client = DatabricksClient(service_connection)

    if service_connection.useUnityCatalog:
        table_obj = DatabricksTable()

        def get_catalogs(connection: WorkspaceClient, table_obj: DatabricksTable):
            for catalog in connection.catalogs.list():
                table_obj.catalog_name = catalog.name
                break

        def get_schemas(connection: WorkspaceClient, table_obj: DatabricksTable):
            for schema in connection.schemas.list(catalog_name=table_obj.catalog_name):
                table_obj.schema_name = schema.name
                break

        def get_tables(connection: WorkspaceClient, table_obj: DatabricksTable):
            for table in connection.tables.list(
                catalog_name=table_obj.catalog_name, schema_name=table_obj.schema_name
            ):
                table_obj.name = table.name
                break

        test_fn = {
            "CheckAccess": connection.catalogs.list,
            "GetDatabases": partial(get_catalogs, connection, table_obj),
            "GetSchemas": partial(get_schemas, connection, table_obj),
            "GetTables": partial(get_tables, connection, table_obj),
            "GetViews": partial(get_tables, connection, table_obj),
            "GetQueries": client.test_query_api_access,
        }

    else:
        inspector = inspect(connection)
        test_fn = {
            "CheckAccess": partial(test_connection_engine_step, connection),
            "GetSchemas": inspector.get_schema_names,
            "GetTables": inspector.get_table_names,
            "GetViews": inspector.get_view_names,
            "GetDatabases": partial(
                test_query,
                engine=connection,
                statement=DATABRICKS_GET_CATALOGS,
            ),
            "GetQueries": client.test_query_api_access,
        }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=service_connection.connectionTimeout,
    )
