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
Kafka source ingestion
"""
import traceback
from base64 import b64decode
from typing import Any, Dict, Iterable, List

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import TopicSampleData
from metadata.generated.schema.entity.services.connections.messaging.kinesisConnection import (
    KinesisConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class KinesisSource(MessagingServiceSource):
    """
    Implements the necessary methods to extract
    topics metadata from Kinesis Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.generate_sample_data = self.config.sourceConfig.config.generateSampleData
        self.kinesis = self.connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: KinesisConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, KinesisConnection):
            raise InvalidSourceException(
                f"Expected KinesisConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        all_topics, has_more_topics, args = [], True, {"Limit": 100}
        try:
            while has_more_topics:
                topics = self.kinesis.list_streams(**args)
                all_topics.extend(topics["StreamNames"])
                has_more_topics = topics["HasMoreStreams"]
                args["ExclusiveStartStreamName"] = all_topics[-1]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to fetch models list - {err}")

        for topic_name in all_topics:
            yield BrokerTopicDetails(
                topic_name=topic_name,
                topic_metadata={
                    "summary": self._get_topic_details(topic_name),
                    "partitions": self._get_topic_partitions(topic_name),
                },
            )

    def yield_topic(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[CreateTopicRequest]:
        try:
            logger.info(f"Fetching topic details {topic_details.topic_name}")
            topic = CreateTopicRequest(
                name=topic_details.topic_name,
                service=EntityReference(
                    id=self.context.messaging_service.id.__root__,
                    type="messagingService",
                ),
                partitions=len(topic_details.topic_metadata["partitions"]),
                retentionTime=float(
                    topic_details.topic_metadata["summary"].get(
                        "RetentionPeriodHours", 0
                    )
                    * 3600000
                ),
                maximumMessageSize=self._get_max_message_size(),
            )
            if self.generate_sample_data:
                topic.sampleData = self._get_sample_data(
                    topic_details.topic_name, topic_details.topic_metadata["partitions"]
                )
            self.status.topic_scanned(topic.name.__root__)
            yield topic

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception to yield topic [{topic_details.topic_name}]: {exc}"
            )
            self.status.failures.append(
                f"{self.config.serviceName}.{topic_details.topic_name}"
            )

    def get_topic_name(self, topic_details: BrokerTopicDetails) -> str:
        return topic_details.topic_name

    def _get_max_message_size(self) -> int:
        # max message size supported by Kinesis is 1MB and is not configurable
        return 1000000

    def _get_topic_details(self, topic_name: str) -> Dict[str, Any]:
        try:
            topic = self.kinesis.describe_stream_summary(StreamName=topic_name)
            return topic["StreamDescriptionSummary"]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching topic partitions for topic: {topic_name} - {err}"
            )
        return {}

    def _get_topic_partitions(self, topic_name: str) -> List[str]:
        all_partitions, has_more_partitions, args = [], True, {"StreamName": topic_name}
        try:
            while has_more_partitions:
                partitions = self.kinesis.list_shards(**args)
                all_partitions.extend(
                    [part["ShardId"] for part in partitions["Shards"]]
                )
                has_more_partitions = partitions.get("NextToken")
                args["NextToken"] = partitions.get("NextToken")
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching topic partitions for topic: {topic_name} - {err}"
            )
        return all_partitions

    def _get_sample_data(self, topic_name, partitions) -> TopicSampleData:
        data = []
        try:
            for shard in partitions:
                shard_iterator = self.kinesis.get_shard_iterator(
                    StreamName=topic_name,
                    ShardId=shard,
                    ShardIteratorType="TRIM_HORIZON",
                )["ShardIterator"]

                records = self.kinesis.get_records(ShardIterator=shard_iterator)[
                    "Records"
                ]

                data.extend(
                    [b64decode(record["Data"]).decode("utf-8") for record in records]
                )
                if data:
                    break
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching sample data for topic: {topic_name} - {err}"
            )
        return TopicSampleData(messages=data)
