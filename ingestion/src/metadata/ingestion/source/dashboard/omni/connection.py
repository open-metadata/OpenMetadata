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

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
    OmniConnection as OmniConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.omni.client import OmniApiClient
from metadata.utils.constants import THREE_MIN


def get_verify_ssl(connection: OmniConnectionConfig):
    """Resolve verifySSL + sslConfig into a requests ``verify`` value and SSLManager."""
    if connection.verifySSL in (VerifySSL.no_ssl, VerifySSL.ignore):
        return False, None
    ca_certificate = getattr(getattr(connection.sslConfig, "root", None), "caCertificate", None)
    if ca_certificate:
        from metadata.utils.ssl_manager import SSLManager  # noqa: PLC0415

        ssl_manager = SSLManager(ca=ca_certificate)
        return ssl_manager.ca_file_path, ssl_manager
    return True, None


def get_connection(connection: OmniConnectionConfig) -> OmniApiClient:
    """
    Create connection
    """
    try:
        verify_ssl, ssl_manager = get_verify_ssl(connection)
        return OmniApiClient(connection, verify_ssl=verify_ssl, ssl_manager=ssl_manager)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


class OmniConnection(BaseConnection[OmniConnectionConfig, OmniApiClient]):
    def _get_client(self) -> OmniApiClient:
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
        client = self.client
        service_connection = self.service_connection

        test_fn = {
            "CheckAccess": client.test_access,
            "GetDashboards": client.test_get_documents,
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
