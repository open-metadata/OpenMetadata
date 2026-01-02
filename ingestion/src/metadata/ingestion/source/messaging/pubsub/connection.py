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
Source connection handler for Google Cloud Pub/Sub
"""
import os
from dataclasses import dataclass
from typing import Optional

from google.api_core.exceptions import GoogleAPIError
from google.cloud import pubsub_v1
from google.pubsub_v1.services.schema_service import SchemaServiceClient

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.pubSubConnection import (
    PubSubConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

PUBSUB_EMULATOR_HOST = "PUBSUB_EMULATOR_HOST"


@dataclass
class PubSubClient:
    publisher: pubsub_v1.PublisherClient
    subscriber: pubsub_v1.SubscriberClient
    schema_client: Optional[SchemaServiceClient]
    project_id: str


def _get_project_id(connection: PubSubConnection) -> Optional[str]:
    """
    Get project ID from connection config or from credentials.
    Returns None if project ID cannot be determined.
    """
    if connection.projectId:
        return connection.projectId

    if connection.gcpConfig and hasattr(connection.gcpConfig, "gcpConfig"):
        gcp_config = connection.gcpConfig.gcpConfig
        if isinstance(gcp_config, GcpCredentialsValues):
            project_id = gcp_config.projectId
            if isinstance(project_id, SingleProjectId):
                return project_id.root
            if project_id and hasattr(project_id, "root"):
                if isinstance(project_id.root, list):
                    return project_id.root[0] if project_id.root else None
                return project_id.root

    return None


def get_connection(connection: PubSubConnection) -> PubSubClient:
    """
    Create Pub/Sub client connection.

    Raises:
        ValueError: If project_id cannot be determined from connection config.
    """
    set_google_credentials(connection.gcpConfig)

    if connection.useEmulator and connection.hostPort:
        os.environ[PUBSUB_EMULATOR_HOST] = connection.hostPort
    elif PUBSUB_EMULATOR_HOST in os.environ:
        del os.environ[PUBSUB_EMULATOR_HOST]

    publisher = pubsub_v1.PublisherClient()
    subscriber = pubsub_v1.SubscriberClient()

    schema_client = None
    if connection.schemaRegistryEnabled:
        schema_client = SchemaServiceClient()

    project_id = _get_project_id(connection)
    if not project_id:
        raise ValueError(
            "Project ID is required. Provide it via 'projectId' config or in GCP credentials."
        )

    return PubSubClient(
        publisher=publisher,
        subscriber=subscriber,
        schema_client=schema_client,
        project_id=project_id,
    )


def test_connection(
    metadata: OpenMetadata,
    client: PubSubClient,
    service_connection: PubSubConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def list_topics_test():
        project_path = f"projects/{client.project_id}"
        try:
            topics = list(
                client.publisher.list_topics(request={"project": project_path})
            )
            logger.debug(f"Found {len(topics)} topics in project {client.project_id}")
        except GoogleAPIError as err:
            raise err

    def schema_registry_test():
        if client.schema_client:
            project_path = f"projects/{client.project_id}"
            try:
                schemas = list(
                    client.schema_client.list_schemas(request={"parent": project_path})
                )
                logger.debug(
                    f"Found {len(schemas)} schemas in project {client.project_id}"
                )
            except GoogleAPIError as err:
                raise err

    test_fn = {
        "GetTopics": list_topics_test,
        "CheckSchemaRegistry": schema_registry_test,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
