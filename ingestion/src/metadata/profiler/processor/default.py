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
Default simple profiler to use
"""
from typing import List, Optional, Type

from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import ColumnProfilerConfig
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.settings.settings import Settings
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import Metric, add_props
from metadata.profiler.processor.core import Profiler
from metadata.profiler.registry import MetricRegistry


def get_default_metrics(
    metrics_registry: Type[MetricRegistry],
    table: DeclarativeMeta,
    ometa_client: Optional[OpenMetadata] = None,
    db_service: Optional[DatabaseService] = None,
) -> List[Metric]:
    return [
        # Table Metrics
        metrics_registry.ROW_COUNT.value,
        add_props(table=table)(metrics_registry.COLUMN_COUNT.value),
        add_props(table=table)(metrics_registry.COLUMN_NAMES.value),
        # We'll use the ometa_client & db_service in case we need to fetch info to ES
        add_props(table=table, ometa_client=ometa_client, db_service=db_service)(
            metrics_registry.SYSTEM.value
        ),
        # Column Metrics
        metrics_registry.MEDIAN.value,
        metrics_registry.FIRST_QUARTILE.value,
        metrics_registry.THIRD_QUARTILE.value,
        metrics_registry.MEAN.value,
        metrics_registry.COUNT.value,
        metrics_registry.DISTINCT_COUNT.value,
        metrics_registry.DISTINCT_RATIO.value,
        metrics_registry.MIN.value,
        metrics_registry.MAX.value,
        metrics_registry.NULL_COUNT.value,
        metrics_registry.NULL_RATIO.value,
        metrics_registry.STDDEV.value,
        metrics_registry.SUM.value,
        metrics_registry.UNIQUE_COUNT.value,
        metrics_registry.UNIQUE_RATIO.value,
        metrics_registry.IQR.value,
        metrics_registry.HISTOGRAM.value,
        metrics_registry.NON_PARAMETRIC_SKEW.value,
    ]


class DefaultProfiler(Profiler):
    """
    Pre-built profiler with a simple
    set of metrics that we can use as
    a default.
    """

    def __init__(
        self,
        profiler_interface: ProfilerInterface,
        metrics_registry: Type[MetricRegistry],
        include_columns: Optional[List[ColumnProfilerConfig]] = None,
        exclude_columns: Optional[List[str]] = None,
        global_profiler_configuration: Optional[Settings] = None,
        db_service=None,
    ):
        _metrics = get_default_metrics(
            metrics_registry=metrics_registry,
            table=profiler_interface.table,
            ometa_client=profiler_interface.ometa_client,
            db_service=db_service,
        )

        super().__init__(
            *_metrics,
            profiler_interface=profiler_interface,
            include_columns=include_columns,
            exclude_columns=exclude_columns,
            global_profiler_configuration=global_profiler_configuration,
        )
