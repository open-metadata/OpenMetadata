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
from typing import List, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.orm_profiler.profiler.models import ProfilerDef


class TablePartitionConfig(ConfigModel):
    """table partition config"""

    partitionField: Optional[str] = None
    partitionQueryDuration: Optional[int] = 30
    partitionValues: Optional[List] = None


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]]
    includeColumns: Optional[List[ColumnProfilerConfig]]


class TableConfig(ConfigModel):
    """table profile config"""

    fullyQualifiedName: FullyQualifiedEntityName
    profileSample: Optional[float] = None
    profileQuery: Optional[str] = None
    partitionConfig: Optional[TablePartitionConfig]
    columnConfig: Optional[ColumnConfig]


class ProfilerProcessorConfig(ConfigModel):
    """
    Defines how we read the processor information
    from the workflow JSON definition
    """

    profiler: Optional[ProfilerDef] = None
    tableConfig: Optional[List[TableConfig]] = None


class ProfilerResponse(ConfigModel):
    """
    ORM Profiler processor response.

    For a given table, return all profilers and
    the ran tests, if any.
    """

    table: Table
    profile: CreateTableProfileRequest
    sample_data: Optional[TableData] = None
