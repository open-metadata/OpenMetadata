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
S3 custom pydantic models
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference


class S3BucketResponse(BaseModel):
    """
    Class modelling a response received from s3_client.list_buckets operation
    """

    name: str = Field(..., description="Bucket name", alias="Name")
    creation_date: datetime | None = Field(
        None,
        description="Timestamp of Bucket creation in ISO format",
        alias="CreationDate",
    )
    bucket_arn: str | None = Field(
        None,
        description="ARN of the bucket",
        alias="BucketArn",
    )


class S3Tag(BaseModel):
    Key: str
    Value: str


class S3TagResponse(BaseModel):
    """
    Class modelling a response received from s3_client.get_bucket_tagging operation
    """

    TagSet: list[S3Tag] = Field([], description="List of tags")


class S3ContainerDetails(BaseModel):
    """
    Class mapping container details used to create the container requests
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    leaf_container: bool = Field(False, description="Leaf container")
    container_fqn: str | None = Field(None, description="Fully qualified name of the container")
    name: str = Field(..., description="Bucket name")
    prefix: str = Field(..., description="Prefix for the container")
    number_of_objects: float | None = Field(
        None,
        description="Total nr. of objects",
    )
    size: float | None = Field(
        None,
        description="Total size in bytes of all objects",
        title="Total size(bytes) of objects",
    )
    file_formats: list[FileFormat] | None = Field(
        None,
        description="File formats",
    )
    data_model: ContainerDataModel | None = Field(
        None,
        description="Data Model of the container",
    )
    creation_date: str | None = Field(
        None,
        description="Timestamp of Bucket creation in ISO format",
    )
    parent: EntityReference | None = Field(
        None,
        description="Reference to the parent container",
    )
    sourceUrl: basic.SourceUrl | None = Field(None, description="Source URL of the container.")  # noqa: N815

    fullPath: str | None = Field(None, description="Full path of the container/file.")  # noqa: N815
