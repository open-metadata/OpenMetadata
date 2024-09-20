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
Return types for Profiler workflow execution.

We need to define this class as we end up having
multiple profilers per table and columns.
"""
from typing import List, Optional, Type, Union

from pydantic import ConfigDict, Field
from sqlalchemy import Column
from sqlalchemy.orm import DeclarativeMeta
from typing_extensions import Annotated

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    ProfileSampleType,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    SampleDataStorageConfig,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.profiler.metrics.core import Metric, MetricTypes
from metadata.profiler.processor.models import ProfilerDef
from metadata.utils.sqa_like_column import SQALikeColumn


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]] = None
    includeColumns: Optional[List[ColumnProfilerConfig]] = None


class BaseProfileConfig(ConfigModel):
    """base profile config"""

    fullyQualifiedName: FullyQualifiedEntityName
    profileSample: Optional[Union[float, int]] = None
    profileSampleType: Optional[ProfileSampleType] = None
    sampleDataCount: Optional[int] = 100


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
        )
        return table_config


class DatabaseAndSchemaConfig(BaseProfileConfig):
    """schema profile config"""

    sampleDataStorageConfig: Optional[SampleDataStorageConfig] = None


class ProfileSampleConfig(ConfigModel):
    """Profile Sample Config"""

    profile_sample: Optional[Union[float, int]] = None
    profile_sample_type: Optional[ProfileSampleType] = ProfileSampleType.PERCENTAGE


class ProfilerProcessorConfig(ConfigModel):
    """
    Defines how we read the processor information
    from the workflow JSON definition
    """

    profiler: Optional[ProfilerDef] = None
    tableConfig: Optional[List[TableConfig]] = None
    schemaConfig: Optional[List[DatabaseAndSchemaConfig]] = []
    databaseConfig: Optional[List[DatabaseAndSchemaConfig]] = []


class SampleData(BaseModel):
    """TableData wrapper to handle ephemeral SampleData"""

    data: Annotated[TableData, Field(None, description="Table Sample Data")]
    store: Annotated[
        bool, Field(False, description="Is the sample data should be stored or not")
    ]


class ProfilerResponse(ConfigModel):
    """
    ORM Profiler processor response.

    For a given table, return all profilers and
    the ran tests, if any.
    """

    table: Table
    profile: CreateTableProfileRequest
    sample_data: Optional[SampleData] = None
    column_tags: Optional[List[ColumnTag]] = None

    def __str__(self):
        """Return the table name being processed"""
        return f"Table [{self.table.name.root}]"


class ThreadPoolMetrics(ConfigModel):
    """A container for all metrics to be computed on the same thread."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    metrics: Union[List[Union[Type[Metric], CustomMetric]], Type[Metric]]
    metric_type: MetricTypes
    column: Optional[Union[Column, SQALikeColumn]] = None
    table: Union[Table, DeclarativeMeta]
