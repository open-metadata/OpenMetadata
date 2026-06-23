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
Source connection handler for Grafana
"""

from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.grafanaConnection import (
    GrafanaConnection as GrafanaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.grafana.client import GrafanaApiClient
from metadata.utils.constants import THREE_MIN


def get_connection(connection: GrafanaConnectionConfig) -> GrafanaApiClient:
    """
    Create connection to Grafana
    """
    return GrafanaApiClient(
        host_port=connection.hostPort,
        api_key=connection.apiKey.get_secret_value(),
        verify_ssl=connection.verifySSL or True,
        page_size=connection.pageSize or 100,
    )


class GrafanaConnection(BaseConnection[GrafanaConnectionConfig, GrafanaApiClient]):
    def _get_client(self) -> GrafanaApiClient:
        return get_connection(self.service_connection)

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection to Grafana instance
        """
        client = self.client
        service_connection = self.service_connection

        def custom_executor():
            if not client.test_connection():
                raise Exception("Failed to connect to Grafana")  # noqa: TRY002

        test_fn = {"GetDashboards": custom_executor}

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
