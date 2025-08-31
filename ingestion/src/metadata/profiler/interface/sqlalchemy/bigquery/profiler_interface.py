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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
import traceback
from typing import Any, Dict, List, Optional, Type, cast

from sqlalchemy import Column, inspect

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
    thread_local,
)
from metadata.profiler.metrics.core import HybridMetric
from metadata.profiler.metrics.system.bigquery.system import (
    BigQuerySystemMetricsComputer,
)
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.bigquery.bigquery_runner import BigQueryQueryRunner
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class BigQueryProfilerInterface(SQAProfilerInterface):
    """BigQuery profiler interface"""

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        logger.debug(f"Computing {metrics.name()} metric for {runner.table_name}")
        self.system_metrics_class = cast(
            Type[BigQuerySystemMetricsComputer], self.system_metrics_class
        )
        instance = self.system_metrics_class(
            session=self.session,
            runner=runner,
            usage_location=self.service_connection_config.usageLocation,
        )
        return instance.get_system_metrics()

    def _get_struct_columns(self, columns: dict, parent: str):
        """"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns_list = []
        for key, value in columns:
            if not isinstance(value, STRUCT):
                col = Column(f"{parent}.{key}", value)
                # pylint: disable=protected-access
                col._set_parent(self.table.__table__)
                # pylint: enable=protected-access
                columns_list.append(col)
            else:
                col = self._get_struct_columns(
                    value.__dict__.get("_STRUCT_fields"), f"{parent}.{key}"
                )
                columns_list.extend(col)
        return columns_list

    def get_columns(self) -> Column:
        """Get columns from table"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns = []
        for column in inspect(self.table).c:
            if isinstance(column.type, STRUCT):
                columns.extend(
                    self._get_struct_columns(
                        column.type.__dict__.get("_STRUCT_fields"), column.name
                    )
                )
            else:
                columns.append(column)
        return columns

    def get_hybrid_metrics(
        self,
        column: Column,
        metric: Type[HybridMetric],
        column_results: Dict[str, Any],
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metric: metric to compute
            column_results: results of the column
        Returns:
            dictionnary of results
        """
        dataset = self.sampler.get_dataset(column=column)
        try:
            return metric(column).fn(
                dataset, column_results, self.session, self._get_schema_translate_map()
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None

    def _get_schema_translate_map(self) -> Optional[Dict]:
        """
        Compute schema translation map from raw dataset schema and entity database (project) name
        """
        raw_table = self.sampler.raw_dataset.__table__
        dataset_name = getattr(raw_table, "schema", None)
        project_name = getattr(self.table_entity.database, "name", None)

        schema_translate_map = None
        if project_name and dataset_name and "." not in dataset_name:
            schema_translate_map = {dataset_name: f"{project_name}.{dataset_name}"}

        return schema_translate_map

    def _create_thread_safe_runner(self, session, column=None):
        """Create a QueryRunner that applies schema_translate_map so queries use project.dataset.table
        without mutating ORM table schema. BigQuery requires fully-qualified names when billing
        project differs from data project.
        """
        # Build or refresh the thread-local runner
        if not hasattr(thread_local, "runner") or not isinstance(
            getattr(thread_local, "runner"), BigQueryQueryRunner
        ):
            thread_local.runner = BigQueryQueryRunner(
                session=session,
                dataset=self.sampler.get_dataset(column=column),
                raw_dataset=self.sampler.raw_dataset,
                partition_details=self.sampler.partition_details,
                profile_sample_query=self.sampler.sample_query,
            )
            return thread_local.runner

        thread_local.runner.dataset = self.sampler.get_dataset(column=column)
        return thread_local.runner
