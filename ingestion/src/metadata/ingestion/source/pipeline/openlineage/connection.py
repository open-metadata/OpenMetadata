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
Source connection handler
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any

import nats
from botocore.client import BaseClient
from confluent_kafka import Consumer as KafkaConsumer
from confluent_kafka import TopicPartition

from metadata.clients.aws_client import AWSClient
from metadata.clients.nats_client import build_connect_options, cleanup_temp_secrets
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.messaging.saslMechanismType import (
    SaslMechanismType as KafkaSaslMechanism,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    Kafka as KafkaBrokerConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kafkaBrokerConfig import (
    SecurityProtocol as KafkaSecProtocol,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.kinesisBrokerConfig import (
    Kinesis as KinesisBrokerConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.natsBrokerConfig import (
    ConsumerOffsets as NatsConsumerOffsets,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.natsBrokerConfig import (
    Nats as NatsBrokerConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection as OpenLineageConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager

logger = ingestion_logger()


def _get_kafka_connection(
    broker: KafkaBrokerConfig,
) -> tuple[KafkaConsumer, SSLManager | None]:
    security_protocol = broker.securityProtocol or KafkaSecProtocol.PLAINTEXT
    requires_ssl = security_protocol.value in (
        KafkaSecProtocol.SSL.value,
        KafkaSecProtocol.SASL_SSL.value,
    )
    requires_sasl = security_protocol.value in (
        KafkaSecProtocol.SASL_PLAINTEXT.value,
        KafkaSecProtocol.SASL_SSL.value,
    )
    ssl_config = broker.sslConfig
    if requires_ssl and ssl_config is None:
        raise SourceConnectionException("SSL security protocol requires an SSL configuration with a CA certificate.")
    sasl_config = broker.saslConfig
    if requires_sasl and sasl_config is None:
        raise SourceConnectionException(
            "SASL security protocol requires a SASL configuration with a username and password."
        )
    ssl_manager = None
    try:
        config = {
            "bootstrap.servers": broker.brokersUrl,
            "group.id": broker.consumerGroupName,
            "auto.offset.reset": broker.consumerOffsets.value,
            "security.protocol": security_protocol.value,
        }
        if requires_ssl and ssl_config is not None:
            # confluent_kafka's ssl.*.location keys take file paths, but the
            # connection config holds the cert/key content (pasted or uploaded).
            # Materialize them to temp files so the broker is handed a real bundle;
            # the caller registers ssl_manager.cleanup_temp_files to tear them down.
            ssl_manager = SSLManager(
                ca=ssl_config.root.caCertificate,
                cert=ssl_config.root.sslCertificate,
                key=ssl_config.root.sslKey,
            )
            ssl_locations = {
                "ssl.ca.location": ssl_manager.ca_file_path,
                "ssl.certificate.location": ssl_manager.cert_file_path,
                "ssl.key.location": ssl_manager.key_file_path,
            }
            config.update({key: value for key, value in ssl_locations.items() if value is not None})

        if requires_sasl and sasl_config is not None:
            config.update(
                {
                    "sasl.mechanism": (sasl_config.saslMechanism or KafkaSaslMechanism.PLAIN).value,
                    "sasl.username": sasl_config.saslUsername,
                }
            )
            if sasl_config.saslPassword is not None:
                config["sasl.password"] = sasl_config.saslPassword.get_secret_value()

        kafka_consumer = KafkaConsumer(config)
        kafka_consumer.subscribe([broker.topicName])

        return kafka_consumer, ssl_manager  # noqa: TRY300
    except Exception as exc:
        # The cert material is materialized to temp files before the consumer is
        # created; tear it down if we never hand the manager to the caller.
        if ssl_manager is not None:
            ssl_manager.cleanup_temp_files()
        msg = f"Unknown error connecting with Kafka broker: {exc}."
        raise SourceConnectionException(msg)  # noqa: B904


def _get_kinesis_connection(broker: KinesisBrokerConfig):
    try:
        return AWSClient(broker.awsConfig).get_kinesis_client()
    except Exception as exc:
        msg = f"Unknown error connecting with Kinesis: {exc}."
        raise SourceConnectionException(msg)  # noqa: B904


@dataclass
class NatsJetStreamClient:
    """
    Synchronous view of a JetStream pull consumer.

    nats-py is asyncio-only while the connector is a synchronous batch job, so the client
    owns an event loop and runs each call on it.
    """

    nc: Any
    subscription: Any
    _loop: asyncio.AbstractEventLoop = field(repr=False)
    _temp_files: list[str] = field(default_factory=list)

    def fetch(self, batch: int, timeout: float) -> list[Any]:
        """Return up to `batch` messages, or an empty list when the stream is idle."""

        async def _fetch() -> list[Any]:
            try:
                return await self.subscription.fetch(batch, timeout=timeout)
            except (asyncio.TimeoutError, nats.errors.TimeoutError):
                return []

        return self._loop.run_until_complete(_fetch())

    def ack(self, message: Any) -> None:
        self._loop.run_until_complete(message.ack())

    def stream_info(self, stream_name: str) -> Any:
        async def _info() -> Any:
            return await self.nc.jetstream().stream_info(stream_name)

        return self._loop.run_until_complete(_info())

    def close(self) -> None:
        async def _close() -> None:
            # Flush the acknowledgements, then close: draining a pull consumer waits for
            # deliveries that are not coming and times out
            await self.nc.flush(timeout=5)
            await self.nc.close()

        try:
            if not self._loop.is_closed():
                self._loop.run_until_complete(_close())
        except Exception as exc:
            logger.warning("Error draining NATS connection: %s", exc)
        finally:
            if not self._loop.is_closed():
                self._loop.close()
            cleanup_temp_secrets(self._temp_files)


def _get_nats_connection(broker: NatsBrokerConfig) -> NatsJetStreamClient:
    from nats.js.api import AckPolicy, ConsumerConfig, DeliverPolicy

    loop = asyncio.new_event_loop()
    temp_files: list[str] = []
    try:
        options = build_connect_options(
            servers=broker.natsServers,
            auth=broker.authType,
            tls_config=broker.tlsConfig,
            additional_config=broker.additionalConfig,
            temp_files=temp_files,
        )
        # the generated enum members carry the JSON values: all / new
        deliver_policy = DeliverPolicy.NEW if broker.consumerOffsets == NatsConsumerOffsets.new else DeliverPolicy.ALL
        # Every subject of the stream, unless the user narrowed it down
        filter_subject = broker.subject or ">"

        async def _connect() -> tuple[Any, Any]:
            nc = await nats.connect(**options)
            try:
                js = nc.jetstream()
                consumer = ConsumerConfig(
                    durable_name=broker.durableConsumerName,
                    filter_subject=filter_subject,
                    deliver_policy=deliver_policy,
                    ack_policy=AckPolicy.EXPLICIT,
                    ack_wait=broker.ackWait,
                    # A run that dies mid-batch leaves its events unacknowledged; without
                    # a limit JetStream would redeliver them on every run
                    max_deliver=broker.maxDeliver,
                )
                try:
                    await js.add_consumer(broker.streamName, config=consumer)
                except Exception as exc:
                    # A durable consumer that already exists keeps its own settings and
                    # its position in the stream, which is the point of reusing the name
                    logger.debug("Reusing the existing JetStream consumer: %s", exc)
                subscription = await js.pull_subscribe_bind(broker.durableConsumerName, stream=broker.streamName)
            except Exception:
                # The connection is open by now, so a failure here would leak it: one
                # live connection per attempt against a stream that does not exist
                await nc.close()
                raise
            return nc, subscription

        nc, subscription = loop.run_until_complete(_connect())
    except Exception as exc:
        cleanup_temp_secrets(temp_files)
        loop.close()
        msg = f"Unknown error connecting with NATS: {exc}."
        raise SourceConnectionException(msg)  # noqa: B904
    return NatsJetStreamClient(nc=nc, subscription=subscription, _loop=loop, _temp_files=temp_files)


class OpenLineageConnection(
    BaseConnection[OpenLineageConnectionConfig, KafkaConsumer | BaseClient | NatsJetStreamClient]
):
    def _get_client(self) -> KafkaConsumer | BaseClient | NatsJetStreamClient:
        """
        Create connection based on broker config type.
        """
        broker = self.service_connection.brokerConfig

        if isinstance(broker, KafkaBrokerConfig):
            consumer, ssl_manager = _get_kafka_connection(broker)
            self._on_close(consumer.close)
            if ssl_manager is not None:
                self._on_close(ssl_manager.cleanup_temp_files)
            return consumer

        if isinstance(broker, KinesisBrokerConfig):
            client = _get_kinesis_connection(broker)
            self._on_close(client.close)
            return client

        if isinstance(broker, NatsBrokerConfig):
            nats_client = _get_nats_connection(broker)
            self._on_close(nats_client.close)
            return nats_client

        raise SourceConnectionException(f"Unsupported broker config type: {type(broker)}")

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        client = self.client
        service_connection = self.service_connection
        broker = service_connection.brokerConfig

        if isinstance(broker, KafkaBrokerConfig):

            def custom_executor():
                _ = client.get_watermark_offsets(TopicPartition(broker.topicName, 0))  # pyright: ignore[reportAttributeAccessIssue]

            test_fn = {"CheckBrokerConnectivity": custom_executor}

        elif isinstance(broker, KinesisBrokerConfig):

            def custom_executor():
                client.describe_stream_summary(StreamName=broker.streamName)  # pyright: ignore[reportAttributeAccessIssue]

            test_fn = {"CheckBrokerConnectivity": custom_executor}

        elif isinstance(broker, NatsBrokerConfig):

            def custom_executor():
                client.stream_info(broker.streamName)  # pyright: ignore[reportAttributeAccessIssue]

            test_fn = {"CheckBrokerConnectivity": custom_executor}

        else:
            raise SourceConnectionException(f"Unsupported broker config type: {type(broker)}")

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
