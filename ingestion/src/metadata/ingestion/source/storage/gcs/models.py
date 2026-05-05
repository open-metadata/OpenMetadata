#  Copyright 2024 Collate
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
GCS custom pydantic models
"""

from datetime import datetime
from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.data.container import (
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference


class GCSBucketResponse(BaseModel):
    """
    Class modelling a response received from gcs_client.list_buckets operation
    """

    name: str = Field(..., description="Bucket name")
    project_id: str = Field(..., description="Project ID")
    creation_date: Optional[datetime] = Field(  # noqa: UP045
        None,
        description="Timestamp of Bucket creation in ISO format",
    )


class GCSContainerDetails(BaseModel):
    """
    Class mapping container details used to create the container requests
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    name: str = Field(..., description="Bucket name")
    prefix: str = Field(..., description="Prefix for the container")
    description: Optional[basic.Markdown] = Field(None, description="Description of the container instance.")  # noqa: UP045
    number_of_objects: Optional[float] = Field(  # noqa: UP045
        None,
        description="Total nr. of objects",
    )
    size: Optional[float] = Field(  # noqa: UP045
        None,
        description="Total size in bytes of all objects",
        title="Total size(bytes) of objects",
    )
    file_formats: Optional[List[FileFormat]] = Field(  # noqa: UP006, UP045
        None,
        description="File formats",
    )
    data_model: Optional[ContainerDataModel] = Field(  # noqa: UP045
        None,
        description="Data Model of the container",
    )
    creation_date: Optional[str] = Field(  # noqa: UP045
        None,
        description="Timestamp of Bucket creation in ISO format",
    )
    parent: Optional[EntityReference] = Field(  # noqa: UP045
        None,
        description="Reference to the parent container",
    )
    sourceUrl: Optional[basic.SourceUrl] = Field(None, description="Source URL of the container.")  # noqa: N815, UP045
    fullPath: Optional[str] = Field(None, description="Full path of the container/file.")  # noqa: N815, UP045
    container_fqn: Optional[str] = Field(None, description="Fully qualified name of the container.")  # noqa: UP045
    leaf_container: Optional[bool] = Field(None, description="Whether this is a leaf container.")  # noqa: UP045
