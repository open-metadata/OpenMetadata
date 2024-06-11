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
Wrapper module of OpenLineageEventReader client
"""

import json
from abc import abstractmethod
from typing import Dict, Generator, Iterable, Optional

from confluent_kafka import Consumer as KafkaConsumer
from confluent_kafka import TopicPartition
from confluent_kafka.error import KafkaError

from metadata.generated.schema.entity.services.connections.pipeline.openlineage.openlineageKafkaConnection import (
    OpenLineageKafkaConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.openlineage.openlineageKafkaConnection import (
    SecurityProtocol as KafkaSecProtocol,
)
from metadata.generated.schema.entity.services.connections.pipeline.openLineageConnection import (
    OpenLineageConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.models import (
    EventType,
    OpenLineageEvent,
)
from metadata.ingestion.source.pipeline.openlineage.utils import (
    message_to_open_lineage_event,
)
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


def merge_dicts(*dicts: Dict) -> Dict:
    """
    Merge multiple dictionaries into one.

    :param dicts: Variable number of dictionaries to merge.
    :return: Merged dictionary.
    """
    result = {}
    for d in dicts:
        for key, value in d.items():
            if key in result:
                if isinstance(value, list) and isinstance(result[key], list):
                    result[key].extend([v for v in value if v not in result[key]])
                elif isinstance(value, dict) and isinstance(result[key], dict):
                    result[key] = merge_dicts(result[key], value)
            else:
                result[key] = value
    return result


def filter_event_by_type(
    event: OpenLineageEvent, event_type: EventType
) -> Optional[OpenLineageEvent]:
    """
    Returns event if it matches the specified event_type.

    :param event: Open Lineage raw event.
    :param event_type: Type of event to filter by.
    :return: Open Lineage event if it matches the event_type, otherwise None.
    """
    return event if event.event_type == event_type else None


class OpenLineageEventReader:
    """
    Abstract base class for OpenLineage event readers.
    """

    def get_events(self, metadata: OpenMetadata) -> Iterable[OpenLineageEvent]:
        """
        Abstract method to get events from the data source.

        :param metadata: An instance of OpenMetadata.
        :return: A generator yielding events.
        """
        for event in self._get_events(metadata):
            event = filter_event_by_type(event, EventType.COMPLETE)
            if event:
                yield self._process_complete_event(metadata, event.run_facet["runId"])

    @abstractmethod
    def _get_events(self, metadata: OpenMetadata) -> Iterable[OpenLineageEvent]:
        """
        Abstract method to get events from the data source.

        :param metadata: An instance of OpenMetadata.
        :return: A generator yielding events.
        """
        pass

    @abstractmethod
    def connection_check(self) -> None:
        """
        Abstract method to check the connection to the data source.
        """
        pass

    @abstractmethod
    def close(self, metadata: OpenMetadata) -> None:
        """
        Abstract method to close the connection to the data source.

        :param metadata: An instance of OpenMetadata.
        """
        pass

    def _get_merged_event(self, openmetadata: OpenMetadata, run_id: str) -> Dict:
        """Get merged event JSON for a given run ID."""
        events = openmetadata.get_openlineage_events_for_runid(run_id)
        dicts = [json.loads(event.event) for event in events]

        return merge_dicts(*dicts)

    def _process_complete_event(
        self, openmetadata: OpenMetadata, run_id: str
    ) -> OpenLineageEvent:
        """Process complete event by merging related events."""
        merged_event_json = self._get_merged_event(openmetadata, run_id)
        logger.debug(f"Merged event for runid: {run_id} -> {merged_event_json}")
        merged_event = message_to_open_lineage_event(merged_event_json)

        return merged_event

    @staticmethod
    def cleanup_completed_runs(openmetadata: OpenMetadata) -> None:
        """
        Clean up completed OpenLineage runs from OpenMetadata.

        :param remove_orphaned:
        :param openmetadata: An instance of OpenMetadata.
        """

        def get_finished_run_ids() -> set:
            finished_types = [EventType.COMPLETE, EventType.ABORT, EventType.FAIL]
            finished_events = []
            for finished_type in finished_types:
                try:
                    finished_events.extend(
                        openmetadata.get_openlineage_events_for_type(finished_type)
                    )
                except Exception as e:
                    logger.warn(e)
            return {event.runid for event in finished_events}

        def get_events_to_be_deleted(run_ids: set) -> list:
            events_to_be_deleted = []
            for run_id in run_ids:
                events_to_be_deleted.extend(
                    openmetadata.get_openlineage_events_for_runid(run_id)
                )
            return events_to_be_deleted

        def delete_events(events: list) -> None:
            for event in events:
                openmetadata.delete_openlineage_event(event)

        try:
            finished_run_ids = get_finished_run_ids()
            logger.debug("Completed RunIDs present in state:  %s", finished_run_ids)
            events_to_be_deleted = get_events_to_be_deleted(finished_run_ids)
            delete_events(events_to_be_deleted)
        except Exception as e:
            logger.error("Failed to clean up completed runs: %s", e)


class OpenLineageKafkaEventReader(OpenLineageEventReader):
    """
    Kafka client for reading OpenLineage events.
    """

    def __init__(self, connection: OpenLineageConnection) -> None:
        """
        Initialize the Kafka client with the given connection settings.

        :param connection: An instance of OpenLineageConnection.
        """
        self.connection = connection
        self.kafka_connection = connection.openlineageConnection
        self.cleanup_state = connection.cleanFinalizedRuns
        try:
            self.kafka_consumer = self._create_consumer(
                connection.openlineageConnection
            )
        except Exception as exc:
            msg = f"Error connecting to Kafka with {self.connection}: {exc}."
            logger.error(msg)
            raise SourceConnectionException(msg) from exc

    def _create_consumer(
        self, kafka_connection: OpenLineageKafkaConnection
    ) -> KafkaConsumer:
        """
        Create a Kafka consumer with the given connection settings.

        :param kafka_connection: An instance of OpenLineageConnection.
        :return: A configured KafkaConsumer instance.
        """
        config = {
            "bootstrap.servers": kafka_connection.brokersUrl,
            "group.id": kafka_connection.consumerGroupName,
            "auto.offset.reset": kafka_connection.consumerOffsets.value,
        }

        if kafka_connection.securityProtocol.value == KafkaSecProtocol.SSL.value:
            config.update(
                {
                    "security.protocol": kafka_connection.securityProtocol.value,
                    "ssl.ca.location": kafka_connection.SSLCALocation,
                    "ssl.certificate.location": kafka_connection.SSLCertificateLocation,
                    "ssl.key.location": kafka_connection.SSLKeyLocation,
                }
            )

        consumer = KafkaConsumer(config)
        consumer.subscribe([kafka_connection.topicName])
        return consumer

    def get_raw_kafka_events(self) -> Generator:
        """
        Get raw Kafka events from the subscribed topic.

        :return: A generator yielding raw Kafka messages.
        """
        session_active = True
        empty_msg_count = 0
        pool_timeout = self.kafka_connection.poolTimeout
        session_timeout = self.kafka_connection.sessionTimeout

        while session_active:
            message = self.kafka_consumer.poll(timeout=pool_timeout)
            if message is None:
                logger.debug("No new messages")
                empty_msg_count += 1
                if empty_msg_count * pool_timeout > session_timeout:
                    session_active = False
            else:
                logger.debug(f"New message: {message.value()}")
                empty_msg_count = 0
                yield message

    def _get_events(self, openmetadata: OpenMetadata) -> Iterable[OpenLineageEvent]:
        """
        Get OpenLineage events from the Kafka topic and store them in OpenMetadata.

        :param openmetadata: An instance of OpenMetadata.
        :return: A generator yielding OpenLineage events.
        """

        def process_kafka_message(raw_kafka_msg) -> None:
            """Process individual Kafka message."""
            try:
                openlineage_event = json.loads(raw_kafka_msg.value())
                event = message_to_open_lineage_event(openlineage_event)
                openmetadata.store_raw_openlineage_event(
                    raw_kafka_msg.value().decode("utf-8")
                )
                yield event
            except json.JSONDecodeError as e:
                logger.error("Failed to decode JSON from Kafka message: %s", e)
            except ValueError as e:
                logger.error("Failed to convert JSON to OpenLineage event: %s", e)
            except Exception as e:
                logger.error("Error processing Kafka message: %s", e)

        for raw_kafka_msg in self.get_raw_kafka_events():
            if raw_kafka_msg and not raw_kafka_msg.error():
                yield from process_kafka_message(raw_kafka_msg)

    def connection_check(self) -> None:
        """
        Check the connection to the Kafka broker by getting the watermark offsets.

        :raises SourceConnectionException: If the connection check fails.
        """
        try:
            self.kafka_consumer.get_watermark_offsets(
                TopicPartition(self.kafka_connection.topicName, 0)
            )
            logger.debug("Kafka connection check passed")
        except KafkaError as e:
            logger.error("Kafka connection check failed: %s", e)
            raise SourceConnectionException("Kafka connection check failed") from e

    def close(self, openmetadata: OpenMetadata) -> None:
        """
        Close the Kafka consumer and clean up completed runs in OpenMetadata state.

        :param openmetadata: An instance of OpenMetadata.
        """
        self.kafka_consumer.close()
        logger.debug("Closed Kafka consumer")
        if self.cleanup_state:
            logger.debug("Cleaning up the OpenLineage events state")
            self.cleanup_completed_runs(openmetadata)


class OpenLineageOpenMetadataEventReader(OpenLineageEventReader):
    processed_events = []

    def __init__(self, connection: OpenLineageConnection) -> None:
        """
        Initialize the Kafka client with the given connection settings.

        :param connection: An instance of OpenLineageConnection.
        """
        self.connection = connection
        self.cleanup_state = connection.cleanFinalizedRuns

    def _get_events(self, metadata: OpenMetadata) -> Iterable[OpenLineageEvent]:
        try:
            for event in metadata.get_unprocessed_complete_events():
                self.processed_events.append(event)
                yield message_to_open_lineage_event(json.loads(event.event))

        except json.JSONDecodeError as e:
            logger.error(
                "Failed to decode JSON from OpenMetadata OL API message: %s", e
            )
        except ValueError as e:
            logger.error("Failed to convert JSON to OpenLineage event: %s", e)
        except Exception as e:
            logger.error("Error processing OpenMetadata OL API message: %s", e)

    def close(self, openmetadata: OpenMetadata) -> None:
        """
        Close the Kafka consumer and clean up completed runs in OpenMetadata state.

        :param openmetadata: An instance of OpenMetadata.
        """

        if self.processed_events:
            for event in self.processed_events:
                openmetadata.mark_event_as_processed(event)

        if self.cleanup_state:
            logger.debug("Cleaning up the OpenLineage events state")
            self.cleanup_completed_runs(openmetadata)

    def connection_check(self) -> None:
        pass
