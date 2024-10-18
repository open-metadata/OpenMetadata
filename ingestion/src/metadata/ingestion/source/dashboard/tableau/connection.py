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
import traceback
from functools import partial
from typing import Any, Dict, Optional

from tableau_api_lib.utils import extract_pages

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
from metadata.ingestion.source.dashboard.tableau import (
    TABLEAU_GET_VIEWS_PARAM_DICT,
    TABLEAU_GET_WORKBOOKS_PARAM_DICT,
)
from metadata.ingestion.source.dashboard.tableau.client import TableauClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()


def get_connection(connection: TableauConnection) -> TableauClient:
    """
    Create connection
    """
    tableau_server_config = build_server_config(connection)
    get_verify_ssl = get_verify_ssl_fn(connection.verifySSL)
    try:
        return TableauClient(
            tableau_server_config=tableau_server_config,
            config=connection,
            env=connection.env,
            ssl_verify=get_verify_ssl(connection.sslConfig),
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
        # The Tableau server_info API doesn't provide direct access to the API version.
        # This is due to the "api_version" being a mandatory field for the tableau library's connection class.
        # Without this information, requests to the Tableau server cannot be made,
        # including fetching the server info containing the "api_version".
        # Consequently, we'll compare the declared api_version with the server's api_version during the test connection
        # once the tableau library's connection class is initialized.
        "ValidateApiVersion": client.test_api_version,
        "ValidateSiteUrl": client.test_site_url,
        "GetWorkbooks": partial(
            extract_pages,
            query_func=client.query_workbooks_for_site,
            parameter_dict=TABLEAU_GET_WORKBOOKS_PARAM_DICT,
        ),
        "GetViews": partial(
            extract_pages,
            query_func=client.query_views_for_site,
            content_id=client.site_id,
            parameter_dict=TABLEAU_GET_VIEWS_PARAM_DICT,
        ),
        "GetOwners": client.get_owners,
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
    tableau_server_config = {
        f"{connection.env}": {
            "server": str(connection.hostPort),
            "api_version": str(connection.apiVersion),
            "site_name": connection.siteName if connection.siteName else "",
            "site_url": connection.siteUrl if connection.siteUrl else "",
        }
    }
    if isinstance(connection.authType, BasicAuth):
        tableau_server_config[connection.env]["username"] = connection.authType.username
        tableau_server_config[connection.env][
            "password"
        ] = connection.authType.password.get_secret_value()
    elif isinstance(connection.authType, AccessTokenAuth):
        tableau_server_config[connection.env][
            "personal_access_token_name"
        ] = connection.authType.personalAccessTokenName
        tableau_server_config[connection.env][
            "personal_access_token_secret"
        ] = connection.authType.personalAccessTokenSecret.get_secret_value()
    return tableau_server_config
