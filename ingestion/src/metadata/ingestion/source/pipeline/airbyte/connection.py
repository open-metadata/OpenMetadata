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

from typing import Optional, Union

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyte.oauthClientAuth import (
    Oauth20ClientCredentialsAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection as AirbyteConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airbyte.client import (
    AirbyteClient,
    AirbyteCloudClient,
)
from metadata.utils.constants import THREE_MIN


def get_connection(
    connection: AirbyteConnectionConfig,
) -> Union[AirbyteClient, AirbyteCloudClient]:  # noqa: UP007
    """
    Create connection - returns appropriate client based on auth type.
    OAuth authentication indicates Airbyte Cloud, otherwise self-hosted instance.
    """
    if connection.auth and isinstance(connection.auth, Oauth20ClientCredentialsAuthentication):
        return AirbyteCloudClient(connection)
    return AirbyteClient(connection)


class AirbyteConnection(BaseConnection[AirbyteConnectionConfig, AirbyteClient | AirbyteCloudClient]):
    def _get_client(self) -> AirbyteClient | AirbyteCloudClient:
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

        test_fn = {"GetPipelines": client.list_workspaces}

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
