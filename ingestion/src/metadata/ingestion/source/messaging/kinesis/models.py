#  Copyright 2023 Collate
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
Kinesis Models
"""

# Disable pylint to conform to Kinesis API returns
# We want to convert to the pydantic models in 1 go
from enum import Enum

from pydantic import BaseModel, ConfigDict


class KinesisEnum(Enum):
    """
    Enum for Kinesis
    """

    TRIM_HORIZON = "TRIM_HORIZON"


class KinesisStreamModel(BaseModel):
    """
    Model for Kinesis streams
    """

    StreamNames: list[str]
    HasMoreStreams: bool


class KinesisSummaryAttributes(BaseModel):
    """
    Model for Kinesis Summary Attributes
    """

    RetentionPeriodHours: float | None = 0


class KinesisSummaryModel(BaseModel):
    """
    Model for Kinesis Summary
    """

    StreamDescriptionSummary: KinesisSummaryAttributes


class KinesisTopicMetadataModel(BaseModel):
    """
    Model for Kinesis Topic Metadata
    """

    summary: KinesisSummaryModel | None
    partitions: list[str] | None


class KinesisArgs(BaseModel):
    """
    Model for Kinesis API Arguments
    """

    model_config = ConfigDict(extra="allow")

    Limit: int = 100


class KinesisStreamArgs(BaseModel):
    """
    Model for Kinesis Stream API Arguments
    """

    model_config = ConfigDict(extra="allow")

    StreamName: str


class KinesisShards(BaseModel):
    """
    Model for Kinesis Shards
    """

    ShardId: str


class KinesisPartitions(BaseModel):
    """
    Model for Kinesis Partitions
    """

    Shards: list[KinesisShards] | None
    NextToken: str | None


class KinesisShardIterator(BaseModel):
    """
    Model for Kinesis Shard Iterator
    """

    ShardIterator: str | None


class KinesisData(BaseModel):
    """
    Model for Kinesis Sample Data
    """

    Data: bytes | None


class KinesisRecords(BaseModel):
    """
    Model for Kinesis Records
    """

    Records: list[KinesisData] | None
