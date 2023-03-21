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
Kinesis source ingestion
"""
import binascii
import traceback
from base64 import b64decode
from typing import Iterable, List, Optional

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
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.source.messaging.kinesis.models import (
    KinesisArgs,
    KinesisData,
    KinesisEnum,
    KinesisPartitions,
    KinesisRecords,
    KinesisShardIterator,
    KinesisStreamArgs,
    KinesisStreamModel,
    KinesisSummaryModel,
    KinesisTopicMetadataModel,
)
from metadata.ingestion.source.messaging.messaging_service import (
    BrokerTopicDetails,
    MessagingServiceSource,
)
from metadata.utils.constants import UTF_8
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
        self.kinesis = self.connection

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: KinesisConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, KinesisConnection):
            raise InvalidSourceException(
                f"Expected KinesisConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_stream_names_list(self) -> List[str]:
        """
        Get the list of all the streams
        """
        all_topics, has_more_topics, args = [], True, KinesisArgs(Limit=100)
        while has_more_topics:
            try:
                topics = self.kinesis.list_streams(**args.dict())
                kinesis_topic_model = KinesisStreamModel(**topics)
                all_topics.extend(kinesis_topic_model.StreamNames)
                has_more_topics = kinesis_topic_model.HasMoreStreams
                if len(all_topics) > 0:
                    args.ExclusiveStartStreamName = all_topics[-1]
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to fetch kinesis stream - {err}")
        return all_topics

    def get_topic_list(self) -> Iterable[BrokerTopicDetails]:
        """
        Method to yeild topic details
        """
        all_topics = self.get_stream_names_list()
        for topic_name in all_topics:
            try:
                yield BrokerTopicDetails(
                    topic_name=topic_name,
                    topic_metadata=KinesisTopicMetadataModel(
                        summary=self._get_topic_details(topic_name),
                        partitions=self._get_topic_partitions(topic_name),
                    ),
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to yield kinesis topic - {err}")

    def yield_topic(
        self, topic_details: BrokerTopicDetails
    ) -> Iterable[CreateTopicRequest]:
        """
        Method to yield the create topic request
        """
        try:
            logger.info(f"Fetching topic details {topic_details.topic_name}")

            topic = CreateTopicRequest(
                name=topic_details.topic_name,
                service=self.context.messaging_service.fullyQualifiedName.__root__,
                partitions=len(topic_details.topic_metadata.partitions),
                retentionTime=self._compute_retention_time(
                    topic_details.topic_metadata.summary
                ),
                maximumMessageSize=self._get_max_message_size(),
            )
            self.status.scanned(topic.name.__root__)
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

    def _compute_retention_time(self, summary: Optional[KinesisSummaryModel]) -> float:
        retention_time = 0
        if summary:
            retention_time = (
                summary.StreamDescriptionSummary.RetentionPeriodHours * 3600000
            )
        return float(retention_time)

    def _get_max_message_size(self) -> int:
        # max message size supported by Kinesis is 1MB and is not configurable
        return 1000000

    def _get_topic_details(self, topic_name: str) -> Optional[KinesisSummaryModel]:
        try:
            topic_summary = self.kinesis.describe_stream_summary(StreamName=topic_name)
            return KinesisSummaryModel(**topic_summary)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching topic partitions for topic: {topic_name} - {err}"
            )
        return None

    def _get_topic_partitions(self, topic_name: str) -> List[str]:
        all_partitions, has_more_partitions, args = (
            [],
            True,
            KinesisStreamArgs(StreamName=topic_name),
        )
        try:
            while has_more_partitions:
                partitions = self.kinesis.list_shards(**args.dict())
                kinesis_partitions_model = KinesisPartitions(**partitions)
                all_partitions.extend(
                    [
                        partition.ShardId
                        for partition in kinesis_partitions_model.Shards or []
                    ]
                )
                has_more_partitions = kinesis_partitions_model.NextToken
                args.NextToken = has_more_partitions
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching topic partitions for topic: {topic_name} - {err}"
            )
        return all_partitions

    def yield_topic_sample_data(
        self, topic_details: BrokerTopicDetails
    ) -> TopicSampleData:
        """
        Method to Get Sample Data of Messaging Entity
        """
        try:
            if self.context.topic and self.generate_sample_data:
                yield OMetaTopicSampleData(
                    topic=self.context.topic,
                    sample_data=self._get_sample_data(
                        topic_details.topic_name,
                        topic_details.topic_metadata.partitions,
                    ),
                )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while yielding topic sample data for topic: {topic_details.topic_name} - {err}"
            )

    def _get_sample_data(self, topic_name, partitions) -> TopicSampleData:
        data = []
        try:
            for shard in partitions:
                shard_iterator = self.kinesis.get_shard_iterator(
                    StreamName=topic_name,
                    ShardId=shard,
                    ShardIteratorType=KinesisEnum.TRIM_HORIZON.value,
                )
                shard_iterator_model = KinesisShardIterator(**shard_iterator)

                if shard_iterator_model.ShardIterator:
                    records = self.kinesis.get_records(
                        ShardIterator=shard_iterator_model.ShardIterator
                    )
                    records_model = KinesisRecords(**records)
                    if records_model.Records:
                        data.extend(
                            self._get_sample_records(records=records_model.Records)
                        )

                if data:
                    break
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error while fetching sample data for topic: {topic_name} - {err}"
            )
        return TopicSampleData(messages=data)

    def _get_sample_records(self, records: List[KinesisData]) -> List:
        sample_data = []
        try:
            for record in records:
                record_data = record.Data
                if record_data:
                    try:
                        sample_data.append(b64decode(record_data).decode(UTF_8))
                    except (binascii.Error, UnicodeDecodeError):
                        sample_data.append(record_data.decode(UTF_8))
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error while fetching sample records for topics - {err}")
        return sample_data
