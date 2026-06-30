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

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
    OmniConnection as OmniConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.omni.client import OmniApiClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_registry import get_verify_ssl_fn


def get_connection(connection: OmniConnectionConfig) -> OmniApiClient:
    """
    Create the Omni REST client.

    SSL verification is resolved through the shared registry so the platform
    semantics are respected: ``no-ssl`` uses the system CAs (None), ``ignore``
    disables verification (False) and ``validate`` uses the provided CA.
    """
    try:
        verify_ssl = None
        if connection.verifySSL:
            verify_ssl = get_verify_ssl_fn(connection.verifySSL)(connection.sslConfig)
        return OmniApiClient(connection, verify_ssl=verify_ssl)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


class OmniConnection(BaseConnection[OmniConnectionConfig, OmniApiClient]):
    def _get_client(self) -> OmniApiClient:
        return get_connection(self.service_connection)

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
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
