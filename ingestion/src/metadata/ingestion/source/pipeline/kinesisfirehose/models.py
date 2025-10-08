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

from pydantic import BaseModel, ConfigDict


class KinesisStreamSourceConfiguration(BaseModel):
    KinesisStreamARN: str
    RoleARN: Optional[str] = None


class S3DestinationBase(BaseModel):
    """Base class for S3 destination configurations."""

    RoleARN: Optional[str] = None
    BucketARN: str
    Prefix: Optional[str] = None
    ErrorOutputPrefix: Optional[str] = None


class S3DestinationDescription(S3DestinationBase):
    """Standard S3 destination configuration."""

    pass


class ExtendedS3DestinationDescription(S3DestinationBase):
    """
    Extended S3 destination configuration.
    Can be extended with additional fields as AWS adds them.
    """

    pass


class CopyCommand(BaseModel):
    """Redshift COPY command configuration."""

    DataTableName: str
    DataTableColumns: Optional[str] = None
    CopyOptions: Optional[str] = None


class RedshiftDestinationDescription(BaseModel):
    """Redshift destination configuration."""

    RoleARN: str
    ClusterJDBCURL: str
    CopyCommand: CopyCommand
    Username: Optional[str] = None
    S3DestinationDescription: Optional[S3DestinationDescription] = None


class AmazonopensearchserviceDestinationDescription(BaseModel):
    """Amazon OpenSearch Service destination configuration."""

    RoleARN: str
    DomainARN: Optional[str] = None
    ClusterEndpoint: Optional[str] = None
    IndexName: str
    TypeName: Optional[str] = None


class SnowflakeDestinationDescription(BaseModel):
    """Snowflake destination configuration."""

    AccountUrl: str
    User: str
    Database: str
    Schema: str
    Table: str
    RoleARN: str
    ContentColumnName: Optional[str] = None
    MetaDataColumnName: Optional[str] = None


class HttpEndpointConfiguration(BaseModel):
    """HTTP endpoint configuration."""

    Url: str
    Name: Optional[str] = None
    AccessKey: Optional[str] = None


class HttpEndpointDestinationDescription(BaseModel):
    """HTTP endpoint destination configuration (used for MongoDB and others)."""

    EndpointConfiguration: Optional[HttpEndpointConfiguration] = None
    RoleARN: Optional[str] = None
    S3DestinationDescription: Optional[S3DestinationDescription] = None


class DeliveryStreamDescription(BaseModel):
    model_config = ConfigDict(extra="allow")

    DeliveryStreamName: str
    DeliveryStreamARN: str
    DeliveryStreamStatus: str
    DeliveryStreamType: str
    CreateTimestamp: Optional[float] = None
    LastUpdateTimestamp: Optional[float] = None
    Source: Optional[dict] = None
    Destinations: List[dict]
    HasMoreDestinations: bool
    KinesisStreamSourceConfiguration: Optional[KinesisStreamSourceConfiguration] = None
    S3DestinationDescription: Optional[S3DestinationDescription] = None
    ExtendedS3DestinationDescription: Optional[ExtendedS3DestinationDescription] = None
    RedshiftDestinationDescription: Optional[RedshiftDestinationDescription] = None
    AmazonopensearchserviceDestinationDescription: Optional[
        AmazonopensearchserviceDestinationDescription
    ] = None
    SnowflakeDestinationDescription: Optional[SnowflakeDestinationDescription] = None
    HttpEndpointDestinationDescription: Optional[
        HttpEndpointDestinationDescription
    ] = None


class DeliveryStreamResponse(BaseModel):
    DeliveryStreamDescription: DeliveryStreamDescription


class ListDeliveryStreamsResponse(BaseModel):
    DeliveryStreamNames: List[str]
    HasMoreDeliveryStreams: bool
