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
Source connection handler for Dataflow
"""
from functools import partial
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.dataflowConnection import (
    DataflowConnection,
)
from metadata.ingestion.connections.builders import get_connection_args_common
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.dataflow.client import DataflowClient
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection(connection: DataflowConnection) -> DataflowClient:
    """
    Create connection to Dataflow
    """
    return DataflowClient(connection)


def test_connection(
    metadata: OpenMetadata,
    client: DataflowClient,
    service_connection: DataflowConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection to Dataflow
    """

    def custom_test_connection(client: DataflowClient) -> None:
        client.list_jobs(limit=1)

    test_fn = {
        "GetJobs": partial(custom_test_connection, client),
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        connection_args=get_connection_args_common(service_connection),
    )
