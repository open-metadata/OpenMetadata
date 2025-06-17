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
"""Metric filter class for profiler"""

from typing import List, Optional, Set, Tuple, Type, Union, cast

from sqlalchemy import Column

from metadata.generated.schema.configuration.profilerConfiguration import (
    MetricConfigurationDefinition,
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services import databaseService
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    HybridMetric,
    QueryMetric,
    StaticMetric,
    SystemMetric,
    TMetric,
)
from metadata.profiler.orm.converter.converter_registry import converter_registry
from metadata.profiler.registry import MetricRegistry
from metadata.utils.dependency_injector.dependency_injector import (
    DependencyNotFoundError,
    Inject,
    inject,
)
from metadata.utils.sqa_like_column import SQALikeColumn


class MetricFilter:
    """Metric filter class for profiler"""

    @inject
    def __init__(
        self,
        metrics: Tuple[Type[TMetric]],
        global_profiler_config: Optional[ProfilerConfiguration] = None,
        table_profiler_config: Optional[TableProfilerConfig] = None,
        column_profiler_config: Optional[List[ColumnProfilerConfig]] = None,
        metrics_registry: Inject[Type[MetricRegistry]] = None,
    ):
        if metrics_registry is None:
            raise DependencyNotFoundError(
                "MetricRegistry dependency not found. Please ensure the MetricRegistry is properly registered."
            )

        self.metrics = metrics
        self.metrics_registry = metrics_registry
        self.global_profiler_config = global_profiler_config
        self.table_profiler_config = table_profiler_config
        self.column_profiler_config = column_profiler_config

    @property
    def static_metrics(self) -> List[Type[StaticMetric]]:
        """Get static metrics.

        Returns:
            List[Type[StaticMetric]]:
        """
        return self.filter_by_type(StaticMetric)

    @property
    def composed_metrics(self) -> List[Type[ComposedMetric]]:
        """Get composed metrics. Composed metrics are computed from other metrics.

        Returns:
            List[Type[ComposedMetric]]:
        """
        return self.filter_by_type(ComposedMetric)

    @property
    def custom_metrics(self) -> List[Type[CustomMetric]]:
        """Get custom metrics. Custom metrics are user-defined metrics.

        Returns:
            List[Type[CustomMetric]]:
        """
        return self.filter_by_type(CustomMetric)

    @property
    def query_metrics(self) -> List[Type[QueryMetric]]:
        """Get query metrics. Query metrics are computed from a query.

        Returns:
            List[Type[QueryMetric]]: _description_
        """
        return self.filter_by_type(QueryMetric)

    @property
    def system_metrics(self) -> List[Type[SystemMetric]]:
        """Get system metrics. System metrics represent system-level metrics.

        Returns:
            List[Type[SystemMetric]]:
        """
        return self.filter_by_type(SystemMetric)

    @property
    def hybrid_metric(self) -> List[Type[HybridMetric]]:
        """Get hybrid metrics. Hybrid metrics are a combination of different types of metrics.

        Returns:
            List[Type[HybridMetric]]:
        """
        return self.filter_by_type(HybridMetric)

    @staticmethod
    def filter_empty_metrics(
        metric_funcs: List[ThreadPoolMetrics],
    ) -> List[ThreadPoolMetrics]:
        """filter thread pool object where metrics attribute is empty

        Args:
            thread_pool_metrics (List[ThreadPoolMetrics]): list of thread pool metrics to use in `get_all_metrics`

        Returns:
            List[ThreadPoolMetrics]
        """
        return [metric for metric in metric_funcs if metric.metrics]

    def filter_by_type(self, _type: Type[TMetric]) -> List[Type[TMetric]]:
        """filter a list of metric by type

        Args:
            _type (Type[TMetric]): metric type

        Returns:
            List[Type[TMetric]]:
        """
        return [metric for metric in self.metrics if issubclass(metric, _type)]

    def filter_column_metrics_from_global_config(
        self,
        metrics: List[Type[TMetric]],
        column: Union[Column, SQALikeColumn],
        service_type: databaseService.DatabaseServiceType,
    ) -> List[Optional[Type[TMetric]]]:
        """Filter metrics based on profiler global configuration. We first check if we have config
        or if the config has metricConfiguration. If not, we return all metrics. If we have config
        we'll get the om Dtype from the SQA type (or directly from the SQALikeColumn for non SQA sources).
        We'll then check if the om Dtype is present in the config. If it is disabled, we return an empty list of metrics
        otherwise we'll filter the list of metrics set in the config.

        Args:
            column (Column): sqlalchemy column
            service_type (DatabaseServiceType): database service type as per OpenMetadata
                Note: not great to depend on this here, but we load specific data type based
                sqa client library installed to limit core dependencies
        Returns:
            List[Type[TMetric]]
        """
        if not self.global_profiler_config or (
            self.global_profiler_config
            and not self.global_profiler_config.metricConfiguration
        ):
            return [metric for metric in metrics if metric.is_col_metric()]

        self.global_profiler_config.metricConfiguration = cast(
            List[MetricConfigurationDefinition],
            self.global_profiler_config.metricConfiguration,
        )

        # TODO: improve the expected type. Currently Column will have SQA type while SQALikeColumn will have OM type
        # Column will be returned by SQA sources while SQALikeColumn will be returned by other sources
        if not isinstance(column, SQALikeColumn):
            mapper = converter_registry[service_type]
            sqa_to_om_types = mapper.map_sqa_to_om_types()
            om_data_types: Optional[Set] = sqa_to_om_types.get(
                column.type.__class__, None
            )
        else:
            om_data_types = {column.type}

        if not om_data_types:
            return [metric for metric in metrics if metric.is_col_metric()]

        col_dtype_config = next(
            (
                metric_config
                for metric_config in self.global_profiler_config.metricConfiguration
                if metric_config.dataType in om_data_types
            ),
            None,
        )

        if not col_dtype_config or (
            not col_dtype_config.disabled and not col_dtype_config.metrics
        ):
            return [metric for metric in metrics if metric.is_col_metric()]

        if col_dtype_config.disabled:
            return []

        metrics = [
            Metric.value
            for Metric in self.metrics_registry
            if Metric.value.name() in {mtrc.value for mtrc in col_dtype_config.metrics}
            and Metric.value in metrics
        ]

        return metrics

    def filter_column_metrics_from_table_config(
        self,
        metrics: List[Type[TMetric]],
        column: Union[Column, SQALikeColumn],
    ) -> List[Type[TMetric]]:
        """Filter column metrics based on table configuration. Table configuration can be source
        either from the column config or the table config (column config takes precedence over table config)

        Args:
            column (Union[Column, SQALikeColumn]): _description_

        Returns:
            List[Type[TMetric]]:
        """
        if not self.table_profiler_config and not self.column_profiler_config:
            return [metric for metric in metrics if metric.is_col_metric()]

        columns_config = (
            self.column_profiler_config
            if self.column_profiler_config
            else self.table_profiler_config.includeColumns
        )
        columns_config = cast(List[ColumnProfilerConfig], columns_config)
        metric_names = next(
            (
                include_columns.metrics
                for include_columns in columns_config or []
                if include_columns.columnName in {column.name, "all"}
            ),
            None,
        )

        if not metric_names:
            return [metric for metric in metrics if metric.is_col_metric()]

        metrics = [
            Metric.value
            for Metric in self.metrics_registry
            if Metric.value.name().lower() in {mtrc.lower() for mtrc in metric_names}
            and Metric.value in metrics
        ]
        return [metric for metric in metrics if metric.is_col_metric()]

    def get_column_metrics(
        self,
        metric_type: Type[TMetric],
        column: Column,
        service_type: Optional[databaseService.DatabaseServiceType],
    ) -> List[Type[TMetric]]:
        """Get column metrics. Column metrics are metrics computed for columns.

        Returns:
            List[Type[TMetric]]:
        """
        _metrics = self.filter_by_type(metric_type)
        metrics = self.filter_column_metrics_from_global_config(
            _metrics, column, service_type
        )
        if metrics:
            metrics = self.filter_column_metrics_from_table_config(metrics, column)

        return metrics
