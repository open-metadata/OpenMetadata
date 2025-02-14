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
Sampling Models
"""
from typing import List, Optional, Union

from pydantic import Field
from typing_extensions import Annotated

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    ProfileSampleType,
    SamplingMethodType,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    SampleDataStorageConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.table_metadata import ColumnTag


class BaseProfileConfig(ConfigModel):
    """base profile config"""

    fullyQualifiedName: FullyQualifiedEntityName
    profileSample: Optional[Union[float, int]] = None
    profileSampleType: Optional[ProfileSampleType] = None
    samplingMethodType: Optional[SamplingMethodType] = None
    sampleDataCount: Optional[int] = 100


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]] = None
    includeColumns: Optional[List[ColumnProfilerConfig]] = None


class TableConfig(BaseProfileConfig):
    """table profile config"""

    profileQuery: Optional[str] = None
    partitionConfig: Optional[PartitionProfilerConfig] = None
    columnConfig: Optional[ColumnConfig] = None

    @classmethod
    def from_database_and_schema_config(
        cls, config: "DatabaseAndSchemaConfig", table_fqn: str
    ):
        table_config = TableConfig(
            fullyQualifiedName=table_fqn,
            profileSample=config.profileSample,
            profileSampleType=config.profileSampleType,
            sampleDataCount=config.sampleDataCount,
            samplingMethodType=config.samplingMethodType,
        )
        return table_config


class DatabaseAndSchemaConfig(BaseProfileConfig):
    """schema profile config"""

    sampleDataStorageConfig: Optional[SampleDataStorageConfig] = None


class SampleData(BaseModel):
    """TableData wrapper to handle ephemeral SampleData"""

    data: Annotated[TableData, Field(None, description="Table Sample Data")]
    store: Annotated[
        bool, Field(False, description="Is the sample data should be stored or not")
    ]


class SamplerResponse(ConfigModel):
    """PII & Sampler Workflow Response. For a given table, return all the tags and sample data"""

    table: Table
    sample_data: Optional[SampleData] = None
    column_tags: Optional[List[ColumnTag]] = None

    def __str__(self):
        """Return the table name being processed"""
        return f"Table [{self.table.name.root}]"


class SampleConfig(ConfigModel):
    """Profile Sample Config"""

    profileSample: Optional[Union[float, int]] = None
    profileSampleType: Optional[ProfileSampleType] = ProfileSampleType.PERCENTAGE
    samplingMethodType: Optional[SamplingMethodType] = None
