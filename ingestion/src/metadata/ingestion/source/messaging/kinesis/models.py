#  Copyright 2023 Collate
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
Kinesis Models
"""
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class KinesisEnum(Enum):
    """
    Enum for Kinesis
    """

    LIMIT = "Limit"
    STREAM_NAMES = "StreamNames"
    STREAM_NAME = "StreamName"
    EXCLUSIVE_START_STREAM_NAME = "ExclusiveStartStreamName"
    NEXT_TOKEN = "NextToken"
    SHARDS = "Shards"
    SHARD_ID = "ShardId"
    RECORDS = "Records"
    DATA = "Data"
    SHARD_ITERATOR = "ShardIterator"
    TRIM_HORIZON = "TRIM_HORIZON"


class KinesisStreamModel(BaseModel):
    """
    Model for Kinesis streams
    """

    StreamNames: List[str]
    HasMoreStreams: bool


class KinesisSummaryAttributes(BaseModel):
    """
    Model for Kinesis Summary Attributes
    """

    RetentionPeriodHours: Optional[float] = 0


class KinesisSummaryModel(BaseModel):
    """
    Model for Kinesis Summary
    """

    StreamDescriptionSummary: KinesisSummaryAttributes


class KinesisTopicMetadataModel(BaseModel):
    """
    Model for Kinesis Topic Metadata
    """

    summary: Optional[KinesisSummaryModel]
    partitions: Optional[List[str]]
