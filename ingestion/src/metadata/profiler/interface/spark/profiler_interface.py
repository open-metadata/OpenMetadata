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
from typing import Any, Dict, List, Type, Union

from metadata.generated.schema.entity.data.table import SystemProfile, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.system.system import System
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import profiler_logger

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
                row_dict[metric().name()] = metric().spark_fn(
                    self.sampler.get_dataset()
                )
            return row_dict
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to compute profile for {exc}")
            raise RuntimeError(exc)

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ) -> Dict[str, Any]:
        """Compute static (column-level) metrics using SparkSQL/DataFrame API."""
        raise NotImplementedError(
            "Implement static metrics computation using Spark DataFrame."
        )

    def _compute_query_metrics(
        self,
        metric: Metrics,
        runner,
        *args,
        **kwargs,
    ):
        """Compute query-based metrics using SparkSQL/DataFrame API."""
        raise NotImplementedError(
            "Implement query metrics computation using Spark DataFrame."
        )

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ):
        """Compute window metrics using SparkSQL/DataFrame API."""
        raise NotImplementedError(
            "Implement window metrics computation using Spark DataFrame."
        )

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        """Compute system metrics using SparkSQL/DataFrame API."""
        raise NotImplementedError(
            "Implement system metrics computation using Spark DataFrame."
        )

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, *args, **kwargs
    ):
        """Compute custom metrics using SparkSQL/DataFrame API."""
        raise NotImplementedError(
            "Implement custom metrics computation using Spark DataFrame."
        )

    def get_all_metrics(self, metric_funcs) -> dict:
        """Run all profiler metrics."""
        raise NotImplementedError("Implement get_all_metrics for Spark.")

    def get_composed_metrics(self, column, metric, column_results: Dict) -> dict:
        """Run composed profiler metrics."""
        raise NotImplementedError("Implement get_composed_metrics for Spark.")

    def get_hybrid_metrics(self, column, metric, column_results: Dict) -> dict:
        """Run hybrid profiler metrics."""
        raise NotImplementedError("Implement get_hybrid_metrics for Spark.")

    def close(self):
        """Clean up Spark profiler interface (e.g., stop Spark session if needed)."""

    def get_columns(self):
        """Get columns from the Spark DataFrame."""
        raise NotImplementedError("Implement get_columns for Spark DataFrame.")
