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

from typing import Optional

from sqlalchemy.engine import Engine

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_DATABASE,
    POSTGRES_TEST_GET_QUERIES,
    POSTGRES_TEST_GET_TAGS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_postgres_time_column_name,
)
from metadata.utils.constants import THREE_MIN


def get_connection(connection: PostgresConnection) -> Engine:
    """
    Create connection
    """

    if hasattr(connection.authType, "azureConfig"):
        azure_client = AzureClient(connection.authType.azureConfig).create_client()
        if not connection.authType.azureConfig.scopes:
            raise ValueError(
                "Azure Scopes are missing, please refer https://learn.microsoft.com/en-gb/azure/postgresql/flexible-server/how-to-configure-sign-in-azure-ad-authentication#retrieve-the-microsoft-entra-access-token and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
            )
        access_token_obj = azure_client.get_token(
            *connection.authType.azureConfig.scopes.split(",")
        )
        connection.authType = BasicAuth(password=access_token_obj.token)
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: PostgresConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    queries = {
        "GetQueries": POSTGRES_TEST_GET_QUERIES.format(
            time_column_name=get_postgres_time_column_name(engine=engine),
        ),
        "GetDatabases": POSTGRES_GET_DATABASE,
        "GetTags": POSTGRES_TEST_GET_TAGS,
    }
    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
        timeout_seconds=timeout_seconds,
    )
