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
Kafka sampler implementation
"""

import json
import traceback
from typing import List  # noqa: UP035

from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.sampler.messaging.sampler import MessagingSampler
from metadata.utils.logger import sampler_logger

logger = sampler_logger()


class KafkaSampler(MessagingSampler):
    """Sampler for Kafka messaging service."""

    service_connection_config: KafkaConnection

    def get_client(self):
        from metadata.ingestion.source.messaging.kafka.connection import get_connection  # noqa: PLC0415

        return get_connection(self.service_connection_config)

    def _get_topic_name(self) -> str:
        fqn = self.entity.fullyQualifiedName.root
        parts = fqn.split(".")
        return parts[-1] if len(parts) > 1 else fqn

    def _try_parse_message(self, raw_value: bytes) -> dict:
        try:
            decoded = raw_value.decode("utf-8", errors="replace")
            return json.loads(decoded)
        except (json.JSONDecodeError, AttributeError):
            return {"message": str(raw_value)}

    def _fetch_messages(self, count: int) -> List[dict]:  # noqa: UP006
        try:
            from confluent_kafka import Consumer, KafkaException  # noqa: PLC0415
        except ImportError:
            logger.warning("confluent_kafka not installed; cannot sample Kafka topics")
            return []

        topic_name = self._get_topic_name()
        bootstrap_servers = self.service_connection_config.bootstrapServers
        consumer_config = {
            "bootstrap.servers": bootstrap_servers,
            "group.id": "openmetadata-auto-classification",
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            "session.timeout.ms": 10000,
        }

        messages = []
        consumer = None
        try:
            consumer = Consumer(consumer_config)
            consumer.subscribe([topic_name])
            while len(messages) < count:
                msg = consumer.poll(timeout=5.0)
                if msg is None:
                    break
                if msg.error():
                    logger.warning("Kafka consumer error: %s", msg.error())
                    break
                if msg.value():
                    messages.append(self._try_parse_message(msg.value()))
        except KafkaException as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching messages from Kafka topic %s: %s", topic_name, exc)
        finally:
            if consumer:
                consumer.close()

        return messages
