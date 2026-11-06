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

"""OpenLineage integration tests"""

import json
import uuid

import pytest
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient, NewTopic
from testcontainers.kafka import KafkaContainer

from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    Kafka as KafkaBrokerConfig,
)

OPENLINEAGE_JOBS = ["job_0", "job_1", "job_2"]


@pytest.fixture(scope="module")
def kafka_container():
    with KafkaContainer() as container:
        yield container


@pytest.fixture
def kafka_broker(kafka_container) -> KafkaBrokerConfig:
    """A fresh topic holding one COMPLETE event per job, read by a fresh consumer group."""
    bootstrap = kafka_container.get_bootstrap_server()
    topic = f"openlineage-{uuid.uuid4().hex[:8]}"
    admin = AdminClient({"bootstrap.servers": bootstrap})
    admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=1)])[topic].result(timeout=30)

    producer = Producer({"bootstrap.servers": bootstrap})
    for job in OPENLINEAGE_JOBS:
        event = {
            "eventType": "COMPLETE",
            "run": {"runId": str(uuid.uuid4()), "facets": {}},
            "job": {"namespace": "integration", "name": job},
            "inputs": [],
            "outputs": [],
        }
        producer.produce(topic, value=json.dumps(event).encode())
    producer.flush(30)

    return KafkaBrokerConfig(
        brokersUrl=bootstrap,
        topicName=topic,
        consumerGroupName=topic,
        poolTimeout=0.5,
        sessionTimeout=10,
    )
