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

from functools import partial
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.metadata.amundsenConnection import (
    AmundsenConnection as AmundsenConnectionConfig,
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
from metadata.ingestion.source.metadata.amundsen.client import Neo4JConfig, Neo4jHelper
from metadata.ingestion.source.metadata.amundsen.queries import (
    NEO4J_AMUNDSEN_USER_QUERY,
)
from metadata.utils.constants import THREE_MIN


class AmundsenConnection(BaseConnection[AmundsenConnectionConfig, Neo4jHelper]):
    def _get_client(self) -> Neo4jHelper:
        connection = self.service_connection
        try:
            neo4j_config = Neo4JConfig(
                username=connection.username,
                password=connection.password.get_secret_value(),
                neo4j_url=str(connection.hostPort),
                max_connection_life_time=connection.maxConnectionLifeTime,  # pyright: ignore[reportArgumentType]
                neo4j_encrypted=connection.encrypted,  # pyright: ignore[reportArgumentType]
                neo4j_validate_ssl=connection.validateSSL,  # pyright: ignore[reportArgumentType]
            )
            return Neo4jHelper(neo4j_config)
        except Exception as exc:
            msg = f"Unknown error connecting with {connection}: {exc}."
            raise SourceConnectionException(msg)  # noqa: B904

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

        test_fn = {"CheckAccess": partial(client.execute_query, query=NEO4J_AMUNDSEN_USER_QUERY)}

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
