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
from typing import Optional

from google.cloud.exceptions import NotFound
from google.cloud.monitoring_v3 import MetricServiceClient
from google.cloud.storage import Client

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.gcs.client import MultiProjectClient
from metadata.utils.constants import THREE_MIN
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
            [connection.credentials.gcpConfig.projectId.root]
            if isinstance(connection.credentials.gcpConfig.projectId, SingleProjectId)
            else connection.credentials.gcpConfig.projectId.root
        )
    return GcsObjectStoreClient(
        storage_client=MultiProjectClient(client_class=Client, project_ids=project_ids),
        metrics_client=MetricServiceClient(),
    )


@dataclass
class BucketTestState:
    project_id: str
    bucket_name: str
    blob_name: str = None


class Tester:
    """
    A wrapper class that holds state. We need it because the different testing stages
    are not independent of each other. For example, we need to list buckets before we can list
    blobs within a bucket.
    """

    def __init__(self, client: GcsObjectStoreClient, connection: GcsConnection):
        self.client = client
        self.connection = connection
        self.bucket_tests = []

    def list_buckets(self):
        if self.connection.bucketNames:
            for bucket_name in self.connection.bucketNames:
                for project_id, client in self.client.storage_client.clients.items():
                    try:
                        client.get_bucket(bucket_name)
                    except NotFound:
                        continue
                    else:
                        self.bucket_tests.append(
                            BucketTestState(project_id, bucket_name)
                        )
                        break
                else:
                    raise SourceConnectionException(
                        f"Bucket {bucket_name} not found in provided projects."
                    )
            return
        else:
            for project_id, client in self.client.storage_client.clients.items():
                bucket = next(client.list_buckets())
                self.bucket_tests.append(BucketTestState(project_id, bucket.name))

    def get_bucket(self):
        if not self.bucket_tests:
            raise SourceConnectionException("No buckets found in provided projects")
        for bucket_test in self.bucket_tests:
            client = self.client.storage_client.clients[bucket_test.project_id]
            client.get_bucket(bucket_test.bucket_name)

    def list_blobs(self):
        if not self.bucket_tests:
            raise SourceConnectionException("No buckets found in provided projects")
        for bucket_test in self.bucket_tests:
            client = self.client.storage_client.clients[bucket_test.project_id]
            blob = next(client.list_blobs(bucket_test.bucket_name))
            bucket_test.blob_name = blob.name

    def get_blob(self):
        if not self.bucket_tests:
            raise SourceConnectionException("No buckets found in provided projects")
        for bucket_test in self.bucket_tests:
            client = self.client.storage_client.clients[bucket_test.project_id]
            bucket = client.get_bucket(bucket_test.bucket_name)
            bucket.get_blob(bucket_test.blob_name)

    def get_metrics(self):
        for project_id in self.client.storage_client.clients.keys():
            self.client.metrics_client.list_metric_descriptors(
                name=f"projects/{project_id}"
            )


def test_connection(
    metadata: OpenMetadata,
    client: GcsObjectStoreClient,
    service_connection: GcsConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    tester = Tester(client, service_connection)

    test_fn = {
        "ListBuckets": tester.list_buckets,
        "GetBucket": tester.get_bucket,
        "ListBlobs": tester.list_blobs,
        "GetBlob": tester.get_blob,
        "GetMetrics": tester.get_metrics,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
