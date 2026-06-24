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
import time
import traceback
from typing import Any, List  # noqa: UP035

try:
    from confluent_kafka import Consumer, KafkaException
    from confluent_kafka.schema_registry.avro import AvroDeserializer
except ImportError:
    Consumer = None  # type: ignore
    KafkaException = None  # type: ignore
    AvroDeserializer = None  # type: ignore

from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.sampler.messaging.sampler import MessagingSampler
from metadata.utils.logger import sampler_logger

logger = sampler_logger()

FETCH_TIMEOUT_SECONDS = 30


class KafkaSampler(MessagingSampler):
    """Sampler for Kafka messaging service."""

    service_connection_config: KafkaConnection

    def get_client(self):
        from metadata.ingestion.source.messaging.kafka.connection import get_connection  # noqa: PLC0415

        return get_connection(self.service_connection_config)

    def _get_topic_name(self) -> str:
        from metadata.utils.fqn import split as fqn_split  # noqa: PLC0415

        fqn = self.entity.fullyQualifiedName.root if self.entity.fullyQualifiedName else ""
        parts = fqn_split(fqn)
        topic_name = parts[-1] if len(parts) > 1 else fqn
        if topic_name.startswith('"') and topic_name.endswith('"'):
            topic_name = topic_name[1:-1]
        return topic_name

    def _consumer_group_id(self) -> str:
        fqn = self.entity.fullyQualifiedName.root if self.entity.fullyQualifiedName else ""
        return f"openmetadata-auto-classification-{fqn}" if fqn else "openmetadata-auto-classification"

    def _build_consumer_config(self) -> dict[str, Any]:
        from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (  # noqa: PLC0415
            SecurityProtocol,
        )

        config = {
            "bootstrap.servers": self.service_connection_config.bootstrapServers,
            "group.id": self._consumer_group_id(),
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            "session.timeout.ms": 10000,
        }

        if self.service_connection_config.saslUsername:
            config["sasl.username"] = self.service_connection_config.saslUsername
        if self.service_connection_config.saslPassword:
            config["sasl.password"] = self.service_connection_config.saslPassword.get_secret_value()
        if self.service_connection_config.saslUsername and self.service_connection_config.saslMechanism:
            config["sasl.mechanism"] = self.service_connection_config.saslMechanism.value
        if self.service_connection_config.securityProtocol and (
            self.service_connection_config.securityProtocol != SecurityProtocol.PLAINTEXT
        ):
            config["security.protocol"] = self.service_connection_config.securityProtocol.value

        consumer_config_ssl = getattr(self.service_connection_config, "consumerConfigSSL", None)
        if consumer_config_ssl:
            if getattr(consumer_config_ssl, "caLocation", None):
                config["ssl.ca.location"] = consumer_config_ssl.caLocation
            if getattr(consumer_config_ssl, "certificateLocation", None):
                config["ssl.certificate.location"] = consumer_config_ssl.certificateLocation
            if getattr(consumer_config_ssl, "keyLocation", None):
                config["ssl.key.location"] = consumer_config_ssl.keyLocation

        return config

    def _try_parse_message(self, raw_value: bytes) -> dict:
        if not raw_value:
            return {}

        try:
            decoded = raw_value.decode("utf-8", errors="replace")
            return json.loads(decoded)
        except (json.JSONDecodeError, AttributeError, UnicodeDecodeError):
            pass

        if AvroDeserializer and len(raw_value) > 4:
            try:
                if not hasattr(self, "_avro_deserializer"):
                    client = self.get_client()
                    if client and hasattr(client, "schema_registry_client"):
                        self._avro_deserializer = AvroDeserializer(client.schema_registry_client)
                    else:
                        self._avro_deserializer = None
                if self._avro_deserializer:
                    avro_obj = self._avro_deserializer(raw_value, None)
                    if isinstance(avro_obj, dict):
                        return avro_obj
            except Exception as exc:
                logger.debug(f"Failed to deserialize Avro message: {exc}")

        return {"message": str(raw_value)}

    def _fetch_messages(self, count: int) -> List[dict]:  # noqa: UP006
        if not Consumer:
            logger.warning("confluent_kafka not installed; cannot sample Kafka topics")
            return []

        topic_name = self._get_topic_name()
        consumer_config = self._build_consumer_config()

        messages = []
        consumer = None
        start_time = time.time()
        try:
            consumer = Consumer(consumer_config)
            consumer.subscribe([topic_name])
            while len(messages) < count and (time.time() - start_time) < FETCH_TIMEOUT_SECONDS:
                msg = consumer.poll(timeout=5.0)
                if msg is None:
                    continue
                if msg.error():
                    logger.warning("Kafka consumer error: %s", msg.error())
                    break
                if msg.value():
                    messages.append(self._try_parse_message(msg.value()))
            if len(messages) < count and (time.time() - start_time) >= FETCH_TIMEOUT_SECONDS:
                logger.warning(
                    "Kafka message fetch timeout after %s seconds; collected %s of %s messages",
                    FETCH_TIMEOUT_SECONDS,
                    len(messages),
                    count,
                )
        except Exception as exc:  # KafkaException when confluent_kafka is available
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching messages from Kafka topic %s: %s", topic_name, exc)
        finally:
            if consumer:
                consumer.close()

        return messages
