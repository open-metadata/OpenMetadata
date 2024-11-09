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
S3 custom pydantic models
"""
from datetime import datetime
from typing import List, Optional

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

    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(..., description="Bucket name", alias="Name")
    creation_date: Optional[datetime] = Field(
        None,
        description="Timestamp of Bucket creation in ISO format",
        alias="CreationDate",
    )


class S3Tag(BaseModel):
    Key: str
    Value: str


class S3TagResponse(BaseModel):
    """
    Class modelling a response received from s3_client.get_bucket_tagging operation
    """

    TagSet: List[S3Tag] = Field([], description="List of tags")


class S3ContainerDetails(BaseModel):
    """
    Class mapping container details used to create the container requests
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    leaf_container: bool = Field(False, description="Leaf container")
    container_fqn: Optional[str] = Field(
        None, description="Fully qualified name of the container"
    )
    name: str = Field(..., description="Bucket name")
    prefix: str = Field(..., description="Prefix for the container")
    number_of_objects: Optional[float] = Field(
        None,
        description="Total nr. of objects",
    )
    size: Optional[float] = Field(
        None,
        description="Total size in bytes of all objects",
        title="Total size(bytes) of objects",
    )
    file_formats: Optional[List[FileFormat]] = Field(
        None,
        description="File formats",
    )
    data_model: Optional[ContainerDataModel] = Field(
        None,
        description="Data Model of the container",
    )
    creation_date: Optional[str] = Field(
        None,
        description="Timestamp of Bucket creation in ISO format",
    )
    parent: Optional[EntityReference] = Field(
        None,
        description="Reference to the parent container",
    )
    sourceUrl: Optional[basic.SourceUrl] = Field(
        None, description="Source URL of the container."
    )

    fullPath: Optional[str] = Field(
        None, description="Full path of the container/file."
    )
