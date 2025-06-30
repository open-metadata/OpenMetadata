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
from typing import Any, Dict, Optional, Union

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
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()


def get_connection(connection: TableauConnection) -> TableauClient:
    """
    Create connection
    """
    tableau_server_auth = build_server_config(connection)
    verify_ssl, ssl_manager = set_verify_ssl(connection)
    try:
        return TableauClient(
            tableau_server_auth=tableau_server_auth,
            config=connection,
            verify_ssl=verify_ssl,
            pagination_limit=connection.paginationLimit,
            ssl_manager=ssl_manager,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(
            f"Unknown error connecting with {connection}: {exc}."
        )


def set_verify_ssl(connection: TableauConnection) -> tuple[Union[bool, str], Optional[SSLManager]]:
    """
    Set verify ssl based on connection configuration
    ref: https://tableau.github.io/server-client-python/docs/sign-in-out#handling-ssl-certificates-for-tableau-server
    """
    if connection.verifySSL.value == "no-ssl":
        return None, None
    
    if connection.verifySSL.value == "ignore":
        return False, None
    
    if connection.verifySSL.value == "validate":
        # Use SSLManager to create temporary certificate files
        if not connection.sslConfig:
            raise ValueError(
                "SSL Config is required when verifySSL is set to 'validate'. "
                "Please provide CA certificate, SSL certificate, or SSL key."
            )
        
        # Create SSLManager to handle certificate files
        ssl_manager = SSLManager(
            ca=connection.sslConfig.root.caCertificate,
            cert=connection.sslConfig.root.sslCertificate,
            key=connection.sslConfig.root.sslKey,
        )
        
        # Return the CA certificate file path for verification
        # If no CA certificate is provided, use default verification
        if ssl_manager.ca_file_path:
            return ssl_manager.ca_file_path, ssl_manager
        else:
            # If no CA certificate is provided but SSL is enabled, use default verification
            return True, ssl_manager
    
    # Default case - should not reach here
    return None, None


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
