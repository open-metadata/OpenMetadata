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

import threading
from typing import Any, Dict, List, Set

from more_itertools import partition
from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import Table
from metadata.mixins.sqalchemy.sqa_mixin import Root
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import Metric
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()
thread_local = threading.local()


class StoredStatisticsSource(Root):
    def get_statistics_metrics(self) -> Set[Metrics]:
        """Statistic metrics that are found in system tables. Different for each database."""
        return set()

    def get_column_statistics(
        self, metric: List[Metrics], schema: str, table_name: Table, column: str
    ) -> dict:
        raise NotImplementedError(
            "You used a connector that does not support using statistics tables."
        )

    def get_table_statistics(
        self, metric: List[Metrics], schema: str, table_name: Table
    ) -> dict:
        raise NotImplementedError(
            "You used a connector that does not support using statistics tables."
        )


class ProfilerWithStatistics(SQAProfilerInterface, StoredStatisticsSource):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def __init__(self, *args, **kwargs):
        """Collaborative constructor"""
        super().__init__(*args, **kwargs)

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        column,
        session,
        *args,
        **kwargs,
    ) -> dict:
        result = {}
        if self.source_config.useStatistics:
            metrics, stat_metrics = map(
                list,
                partition(self.is_statistic_metric, metrics),
            )
            schema = runner.schema_name
            table_name = runner.table_name
            logger.debug(
                "Getting statistics for column: %s.%s.%s",
                schema,
                table_name,
                column.name,
            )
            result.update(
                super().get_column_statistics(
                    stat_metrics, schema, table_name, column.name
                )
            )
        result.update(
            super()._compute_static_metrics(
                metrics,
                runner,
                column,
                session,
                *args,
                **kwargs,
            )
        )
        return result

    def _compute_table_metrics(
        self,
        metrics: List[Metric],
        runner: QueryRunner,
        session,
        *args,
        **kwargs,
    ) -> Dict[str, Any]:
        result = {}
        if self.source_config.useStatistics:
            metrics, stat_metrics = map(
                list,
                partition(self.is_statistic_metric, metrics),
            )
            schema = runner.schema_name
            table_name = runner.table_name
            logger.debug("Geting statistics for table: %s.%s", schema, table_name)
            result.update(
                super().get_table_statistics(stat_metrics, schema, table_name)
            )
        super_table_metrics = super()._compute_table_metrics(
            metrics,
            runner,
            session,
            *args,
            **kwargs,
        )
        if super_table_metrics is not None:
            result.update(super_table_metrics)
        return result

    def get_hybrid_metrics(self, column: Column, metric: Metric, column_results: Dict):
        # this metrics might have been computed in a previous step
        return column_results.get(metric.name()) or super().get_hybrid_metrics(
            column, metric, column_results
        )

    def is_statistic_metric(self, metric: Metric) -> bool:
        return metric.name() in {m.name for m in super().get_statistics_metrics()}
