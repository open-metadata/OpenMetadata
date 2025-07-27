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
Return types for Profiler workflow execution.

We need to define this class as we end up having
multiple profilers per table and columns.
"""

from typing import List, Optional, Type, Union

from pydantic import ConfigDict
from sqlalchemy import Column
from sqlalchemy.orm import DeclarativeMeta

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.profiler.metrics.core import Metric, MetricTypes
from metadata.profiler.processor.models import ProfilerDef
from metadata.sampler.models import DatabaseAndSchemaConfig, TableConfig
from metadata.utils.sqa_like_column import SQALikeColumn


class ProfilerProcessorConfig(ConfigModel):
    """
    Defines how we read the processor information
    from the workflow JSON definition
    """

    profiler: Optional[ProfilerDef] = None
    tableConfig: Optional[List[TableConfig]] = None
    schemaConfig: Optional[List[DatabaseAndSchemaConfig]] = []
    databaseConfig: Optional[List[DatabaseAndSchemaConfig]] = []


class ProfilerResponse(ConfigModel):
    """
    ORM Profiler processor response.

    For a given table, return all profilers and
    the ran tests, if any.
    """

    table: Table
    profile: CreateTableProfileRequest

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
