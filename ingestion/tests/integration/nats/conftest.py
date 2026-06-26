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
Fixtures for NATS integration tests.

Requires:
  - OpenMetadata server running at localhost:8585 (default)
  - Docker available for testcontainers
"""

import asyncio
import uuid

import pytest
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.services.connections.messaging.natsConnection import (
    NatsConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingMetadataConfigType,
)


@pytest.fixture(scope="module")
def nats_container():
    container = DockerContainer("nats:2.10")
    container.with_command("-js")
    container.with_exposed_ports(4222)
    with container:
        wait_for_logs(container, "Server is ready", timeout=30)
        yield container


@pytest.fixture(scope="module")
def nats_streams(nats_container):
    port = nats_container.get_exposed_port(4222)

    async def _create_streams():
        import nats as nats_client

        nc = await nats_client.connect(f"nats://localhost:{port}")
        js = nc.jetstream()
        await js.add_stream(
            name="crawler-jobs",
            subjects=["crawler.>"],
            max_age=24 * 3600 * 1_000_000_000,  # 24h in nanoseconds
        )
        await js.add_stream(name="events", subjects=["events.>"])
        await nc.drain()

    asyncio.run(_create_streams())
    return ["crawler-jobs", "events"]


@pytest.fixture(scope="module")
def nats_service(metadata, nats_container, nats_streams):
    port = nats_container.get_exposed_port(4222)
    request = CreateMessagingServiceRequest(
        name=f"docker_test_nats_{uuid.uuid4().hex[:8]}",
        serviceType=MessagingServiceType.Nats,
        connection=MessagingConnection(
            config=NatsConnection(
                natsServers=f"nats://localhost:{port}",
                jetStreamEnabled=True,
            )
        ),
    )
    service = metadata.create_or_update(data=request)
    yield service
    existing = metadata.get_by_name(MessagingService, service.fullyQualifiedName.root)
    if existing:
        metadata.delete(
            entity=MessagingService,
            entity_id=existing.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def ingestion_config(nats_service, workflow_config, sink_config):
    return {
        "source": {
            "type": "nats",
            "serviceName": nats_service.fullyQualifiedName.root,
            "sourceConfig": {"config": {"type": MessagingMetadataConfigType.MessagingMetadata.value}},
            "serviceConnection": nats_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
