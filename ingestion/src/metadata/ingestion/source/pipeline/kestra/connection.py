#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Kestra source connection handler.
"""
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.kestraConnection import (
    KestraConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.kestra.client import KestraClient
from metadata.utils.constants import THREE_MIN


def get_connection(connection: KestraConnection) -> KestraClient:
    """
    Instantiate and return a KestraClient for the given connection config.
    """
    return KestraClient(connection)


def test_connection(
    metadata: OpenMetadata,
    client: KestraClient,
    service_connection: KestraConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Validate connectivity to the Kestra instance.

    Test steps:
    - GetNamespaces: verifies the API is reachable and returns namespace data
    - GetFlows: verifies that flows can be listed
    """
    test_fn = {
        "GetNamespaces": client.get_namespaces,
        "GetFlows": client.get_flows,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
