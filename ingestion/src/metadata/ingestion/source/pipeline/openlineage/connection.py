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
from typing import Optional, Union

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.openLineageKafkaConnection import (
    OpenLineageKafkaConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.openLineageApiConnection import (
    OpenLineageApiConnection,
)

from metadata.ingestion.connections.test_connections import (
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.client import OpenLineageKafkaClient

from ingestion.src.metadata.ingestion.source.pipeline.openlineage.client import OpenLineageApiClient


def get_connection(connection: OpenLineageConnection) -> Union[OpenLineageKafkaClient,OpenLineageApiClient]:
    """
    Create connection
    """

    if isinstance(connection.connection, OpenLineageKafkaConnection):
        return OpenLineageKafkaClient(connection)

    if isinstance(connection.connection, OpenLineageApiConnection):
        return OpenLineageApiClient(connection)

    raise ValueError("Unrecognized OpenLineage connection type!")


def test_connection(
        metadata: OpenMetadata,
        client: Union[OpenLineageKafkaClient, OpenLineageApiClient],
        service_connection: OpenLineageConnection,
        automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {"Connection check": client.connection_check}

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
