#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  You may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Profiler interface for Spark (PySpark DataFrames)
"""
import traceback
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Type, Union

from metadata.generated.schema.entity.data.table import (
    CustomMetricProfile,
    SystemProfile,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.metric_filter import MetricFilter
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import profiler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_logger()


class SparkProfilerInterface(ProfilerInterface):
    """
    Profiler interface for Spark (PySpark DataFrames).
    Implements all required methods from ProfilerInterface.
    Metric computation will use SparkSQL and DataFrame APIs.
    """

    def __init__(  # pylint: disable=too-many-arguments
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        source_config: DatabaseServiceProfilerPipeline,
        sampler: SamplerInterface,
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        **kwargs,
    ):
        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            source_config=source_config,
            sampler=sampler,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            **kwargs,
        )

    @property
    def table(self):
        """Return the OM Table entity."""
        return self.table_entity

    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ):
        """Compute table-level metrics using SparkSQL/DataFrame API."""
        try:
            row_dict = {}
            for metric in metrics:
                row_dict[metric.name()] = metric().spark_fn(self.sampler.get_dataset())
            return row_dict
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to compute profile for {exc}")
            raise RuntimeError(exc)

    def _compute_static_metrics(  # pylint: disable=arguments-differ
        self,
        metrics: List[Metrics],
        runner,
        column,
        *args,
        **kwargs,
    ) -> Dict[str, Any]:
        """Compute static (column-level) metrics using SparkSQL/DataFrame API."""
        try:
            row_dict = {}
            for metric in metrics:
                row_dict[metric.name()] = metric(column).spark_fn(
                    self.sampler.get_dataset()
                )
            return row_dict
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\nError trying to compute profile for {exc}"
            )
            raise RuntimeError(exc)

    def _compute_query_metrics(  # pylint: disable=arguments-differ
        self,
        metric: Metrics,
        runner,
        column,
        *args,
        **kwargs,
    ):
        """Compute query-based metrics using SparkSQL/DataFrame API."""
        try:
            col_metric = None
            col_metric = metric(column).df_fn(self.sampler.get_dataset())
            if not col_metric:
                return None
            return {metric.name(): col_metric}
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\nError trying to compute query metric for {exc}"
            )
            raise RuntimeError(exc)

    def _compute_window_metrics(  # pylint: disable=arguments-differ
        self,
        metrics: List[Metrics],
        runner,
        column,
        *args,
        **kwargs,
    ):
        """Compute window metrics using SparkSQL/DataFrame API."""
        try:
            metric_values = {}
            for metric in metrics:
                metric_values[metric().name()] = metric(column).spark_fn(
                    self.sampler.get_dataset()
                )
            return metric_values if metric_values else None
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\nError trying to compute window metrics for {exc}"
            )
            raise RuntimeError(exc)

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        """Compute system metrics using SparkSQL/DataFrame API."""
        return []  # TODO: Implement

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, *args, **kwargs
    ):
        """Compute custom metrics using SparkSQL/DataFrame API."""
        if not metrics:
            return None

        custom_metrics = []

        for metric in metrics:
            try:
                # Evaluate the custom metric expression using Spark SQL
                # Assume metric.expression is a valid SQL WHERE clause for the column
                # For Spark, we use filter with the expression and count the rows
                row = self.sampler.get_dataset().filter(metric.expression).count()
                custom_metrics.append(
                    CustomMetricProfile(name=metric.name.root, value=row)
                )
            except Exception as exc:
                msg = f"Error trying to compute profile for custom metric: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(msg)
        if custom_metrics:
            return {"customMetrics": custom_metrics}
        return None

    def get_all_metrics(self, metric_funcs: List[ThreadPoolMetrics]) -> dict:
        """Run all profiler metrics."""

        profile_results = {"table": {}, "columns": defaultdict(dict)}
        metric_list = [
            self.compute_metrics(metric_func)
            for metric_func in MetricFilter.filter_empty_metrics(metric_funcs)
        ]
        for metric_result in metric_list:
            profile, column, metric_type = metric_result
            if profile:
                if metric_type == MetricTypes.Table.value:
                    profile_results["table"].update(profile)
                elif metric_type == MetricTypes.System.value:
                    profile_results["system"] = profile
                elif metric_type == MetricTypes.Custom.value and column is None:
                    profile_results["table"].update(profile)
                else:
                    if profile:
                        profile_results["columns"][column].update(
                            {
                                "name": column,
                                "timestamp": int(datetime.now().timestamp() * 1000),
                                **profile,
                            }
                        )
        return profile_results

    def get_composed_metrics(self, column, metric, column_results: Dict) -> dict:
        """Run composed profiler metrics."""
        try:
            return metric(column).fn(column_results)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing composed metrics: {exc}")
            return {}

    def get_hybrid_metrics(self, column, metric, column_results: Dict) -> dict:
        """Run hybrid profiler metrics."""
        try:
            return metric(column).spark_fn(column_results, self.sampler.get_dataset())
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing hybrid metrics: {exc}")
            return {}

    def close(self):
        """Clean up Spark profiler interface (e.g., stop Spark session if needed)."""

    def get_columns(self):
        """Get columns from the Spark DataFrame."""
        from metadata.sampler.spark.sampler import (  # pylint: disable=import-outside-toplevel
            SparkSampler,
        )

        sqalike_columns = []
        df = self.sampler.raw_dataset

        if df is not None:
            for field in df.schema.fields:
                column_name = field.name
                om_type = SparkSampler.spark_type_to_omdatatype(
                    field.dataType.typeName()
                )
                sqalike_columns.append(SQALikeColumn(column_name, om_type))
        return sqalike_columns

    def compute_metrics(self, metric_func: ThreadPoolMetrics):
        """Run metrics in processor worker"""
        logger.debug(f"Running profiler for {metric_func.table.name.root}")
        try:
            row = self._get_metric_fn[metric_func.metric_type.value](
                metric_func.metrics,
                self.sampler.get_dataset(),
                column=metric_func.column,
            )
        except Exception as exc:
            name = f"{metric_func.column if metric_func.column is not None else metric_func.table}"
            error = f"{name} metric_type.value: {exc}"
            logger.error(error)
            self.status.failed_profiler(error, traceback.format_exc())
            row = None
        if metric_func.column is not None:
            column = metric_func.column.name
            self.status.scanned(f"{metric_func.table.name.root}.{column}")
        else:
            self.status.scanned(metric_func.table.name.root)
            column = None
        return row, column, metric_func.metric_type.value
