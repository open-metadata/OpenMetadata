#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""GCS storage connection"""
from dataclasses import dataclass
from functools import partial
from typing import Optional

from google.cloud.monitoring_v3 import MetricServiceClient
from google.cloud.storage import Client

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.gcs.client import MultiProjectClient
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class GcsObjectStoreClient:
    storage_client: MultiProjectClient
    metrics_client: MetricServiceClient


def get_connection(connection: GcsConnection):
    set_google_credentials(connection.credentials)
    project_ids = None
    if isinstance(connection.credentials.gcpConfig, GcpCredentialsValues):
        project_ids = (
            [connection.credentials.gcpConfig.projectId.__root__]
            if isinstance(connection.credentials.gcpConfig.projectId, SingleProjectId)
            else connection.credentials.gcpConfig.projectId.__root__
        )
    return GcsObjectStoreClient(
        storage_client=MultiProjectClient(client_class=Client, project_ids=project_ids),
        metrics_client=MetricServiceClient(),
    )


def test_connection(
    metadata: OpenMetadata,
    client: GcsObjectStoreClient,
    service_connection: GcsConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    project_id = client.storage_client.project_ids()[0]

    def test_buckets(
        connection: GcsConnection, client: GcsObjectStoreClient, project_id: str
    ):
        if connection.bucketNames:
            for bucket_name in connection.bucketNames:
                client.storage_client.list_blobs(bucket_name, project_id=project_id)
            return
        client.storage_client.list_buckets(project_id=project_id)

    test_fn = {
        "ListBuckets": partial(
            test_buckets,
            client=client,
            connection=service_connection,
            project_id=project_id,
        ),
        "GetMetrics": partial(
            client.metrics_client.list_metric_descriptors,
            name=f"projects/{project_id}",
        ),
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
