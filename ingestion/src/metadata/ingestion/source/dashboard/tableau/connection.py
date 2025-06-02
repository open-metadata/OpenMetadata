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
import traceback
from typing import Any, Dict, Optional

import tableauserverclient as TSC

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.accessTokenAuth import (
    AccessTokenAuth,
)
from metadata.generated.schema.security.credentials.basicAuth import BasicAuth
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.tableau.client import TableauClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()


def get_connection(connection: TableauConnection) -> TableauClient:
    """
    Create connection
    """
    tableau_server_auth = build_server_config(connection)
    get_verify_ssl = get_verify_ssl_fn(connection.verifySSL)
    try:
        return TableauClient(
            tableau_server_auth=tableau_server_auth,
            config=connection,
            verify_ssl=get_verify_ssl(connection.sslConfig),
            pagination_limit=connection.paginationLimit,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(
            f"Unknown error connecting with {connection}: {exc}."
        )


def test_connection(
    metadata: OpenMetadata,
    client: TableauClient,
    service_connection: TableauConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {
        "ServerInfo": client.server_info,
        "ValidateApiVersion": client.server_api_version,
        "ValidateSiteUrl": client.test_site_url,
        "GetWorkbooks": client.test_get_workbooks,
        "GetViews": client.test_get_workbook_views,
        "GetOwners": client.test_get_owners,
        "GetDataModels": client.test_get_datamodels,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )


def build_server_config(connection: TableauConnection) -> Dict[str, Dict[str, Any]]:
    """
    Build client configuration
    Args:
        connection: configuration of Tableau Connection
    Returns:
        Client configuration
    """

    if isinstance(connection.authType, BasicAuth):
        tableau_auth = TSC.TableauAuth(
            username=connection.authType.username,
            password=connection.authType.password.get_secret_value(),
            site_id=connection.siteName if connection.siteName else "",
        )
    elif isinstance(connection.authType, AccessTokenAuth):
        tableau_auth = TSC.PersonalAccessTokenAuth(
            token_name=connection.authType.personalAccessTokenName,
            personal_access_token=connection.authType.personalAccessTokenSecret.get_secret_value(),
            site_id=connection.siteName if connection.siteName else "",
        )
    else:
        raise ValueError("Unsupported authentication type")

    return tableau_auth
