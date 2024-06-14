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
Test Kafka using the topology
"""


from unittest import TestCase

from confluent_kafka import Producer
from testcontainers.kafka import KafkaContainer

from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


def produce_and_consume_kafka_message(container):
    topic = "test-topic"
    bootstrap_server = container.get_bootstrap_server()

    producer = Producer({"bootstrap.servers": bootstrap_server})
    producer.produce(topic, b"verification message")
    producer.flush()


OM_JWT = "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"


def get_ingestion_config(port: str):
    return {
        "source": {
            "type": "kafka",
            "serviceName": "TEST_KAFKA",
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": f"localhost:{port}",
                }
            },
            "sourceConfig": {"config": {"type": "MessagingMetadata"}},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "DEBUG",
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
                },
            },
        },
    }


def int_admin_ometa(url: str = "http://localhost:8585/api") -> OpenMetadata:
    """Initialize the ometa connection with default admin:admin creds"""
    server_config = OpenMetadataConnection(
        hostPort=url,
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=CustomSecretStr(OM_JWT)),
    )
    metadata = OpenMetadata(server_config)
    assert metadata.health_check()
    return metadata


class KafkaUnitTest(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.metadata = int_admin_ometa()
        cls.kafka_container = KafkaContainer()
        cls.kafka_container.start()
        cls.ingestion_config = get_ingestion_config(
            cls.kafka_container.get_exposed_port(9093)
        )
        produce_and_consume_kafka_message(cls.kafka_container)

        ingestion_workflow = MetadataWorkflow.create(
            cls.ingestion_config,
        )
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.stop()

    def test_topic(self):
        topic = self.metadata.get_by_name(
            entity=Topic,
            fqn="TEST_KAFKA.test-topic",
        )
        self.assertIsNotNone(topic)
