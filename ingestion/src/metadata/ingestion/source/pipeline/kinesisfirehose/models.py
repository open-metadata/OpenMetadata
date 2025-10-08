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
Kinesis Firehose Pipeline Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class KinesisStreamSourceConfiguration(BaseModel):
    KinesisStreamARN: str
    RoleARN: Optional[str] = None


class S3DestinationDescription(BaseModel):
    RoleARN: Optional[str] = None
    BucketARN: str
    Prefix: Optional[str] = None
    ErrorOutputPrefix: Optional[str] = None


class ExtendedS3DestinationDescription(BaseModel):
    RoleARN: Optional[str] = None
    BucketARN: str
    Prefix: Optional[str] = None
    ErrorOutputPrefix: Optional[str] = None


class DeliveryStreamDescription(BaseModel):
    DeliveryStreamName: str
    DeliveryStreamARN: str
    DeliveryStreamStatus: str
    DeliveryStreamType: str
    CreateTimestamp: Optional[float] = None
    LastUpdateTimestamp: Optional[float] = None
    Source: Optional[dict] = None
    Destinations: List[dict]
    HasMoreDestinations: bool
    KinesisStreamSourceConfiguration: Optional[KinesisStreamSourceConfiguration] = (
        None
    )
    S3DestinationDescription: Optional[S3DestinationDescription] = None
    ExtendedS3DestinationDescription: Optional[ExtendedS3DestinationDescription] = None


class DeliveryStreamResponse(BaseModel):
    DeliveryStreamDescription: DeliveryStreamDescription


class ListDeliveryStreamsResponse(BaseModel):
    DeliveryStreamNames: List[str]
    HasMoreDeliveryStreams: bool
