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
#  pylint: disable=arguments-differ

"""
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Type

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.profiler.adaptors.adaptor_factory import factory
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import Metric, MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.sampler.nosql.sampler import NoSQLSampler
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_interface_registry_logger()


class NoSQLProfilerInterface(ProfilerInterface):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    # pylint: disable=too-many-arguments

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sampler = self._get_sampler()

    def _compute_table_metrics(
        self,
        metrics: List[Type[Metric]],
        runner: NoSQLAdaptor,
        *args,
        **kwargs,
    ):
        result = {}
        for metric in metrics:
            try:
                fn = metric().nosql_fn(runner)
                result[metric.name()] = fn(self.table)
            except Exception as exc:
                logger.debug(
                    f"{traceback.format_exc()}\n"
                    f"Error trying to compute metric {metric} for {self.table.fullyQualifiedName}: {exc}"
                )
                raise RuntimeError(
                    f"Error trying to compute metric {metric.name()} for {self.table.fullyQualifiedName}: {exc}"
                )
        return result

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: NoSQLAdaptor,
        column: SQALikeColumn,
        *args,
        **kwargs,
    ) -> Dict[str, any]:
        try:
            aggs = [metric(column).nosql_fn(runner)(self.table) for metric in metrics]
            filtered = [agg for agg in aggs if agg is not None]
            if not filtered:
                return {}
            row = runner.get_aggregates(self.table, column, filtered)
            return dict(row)
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\n"
                f"Error trying to compute metrics for {self.table.fullyQualifiedName}: {exc}"
            )
            raise RuntimeError(
                f"Error trying to compute metris for {self.table.fullyQualifiedName}: {exc}"
            )

    def _compute_query_metrics(
        self,
        metric: Metrics,
        runner,
        *args,
        **kwargs,
    ):
        return None

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ):
        return None

    def _compute_system_metrics(
        self,
        metrics: Metrics,
        runner: List,
        *args,
        **kwargs,
    ):
        return None

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, *args, **kwargs
    ):
        return None

    def compute_metrics(
        self,
        client: NoSQLAdaptor,
        metric_func: ThreadPoolMetrics,
    ):
        """Run metrics in processor worker"""
        logger.debug(f"Running profiler for {metric_func.table}")
        try:
            row = self._get_metric_fn[metric_func.metric_type.value](
                metric_func.metrics,
                client,
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
            self.status.scanned(f"{metric_func.table.name.__root__}.{column}")
        else:
            self.status.scanned(metric_func.table.name.__root__)
            column = None
        return row, column, metric_func.metric_type.value

    def fetch_sample_data(self, table, columns: List[SQALikeColumn]) -> TableData:
        return self.sampler.fetch_sample_data(columns)

    def _get_sampler(self) -> NoSQLSampler:
        """Get NoSQL sampler from config"""
        from metadata.profiler.processor.sampler.sampler_factory import (  # pylint: disable=import-outside-toplevel
            sampler_factory_,
        )

        return sampler_factory_.create(
            self.service_connection_config.__class__.__name__,
            table=self.table,
            client=factory.create(
                self.service_connection_config.__class__.__name__, self.connection
            ),
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )

    def get_composed_metrics(
        self, column: Column, metric: Metrics, column_results: Dict
    ):
        return None

    def get_hybrid_metrics(
        self, column: Column, metric: Metrics, column_results: Dict, **kwargs
    ):
        return None

    def get_all_metrics(
        self,
        metric_funcs: List[ThreadPoolMetrics],
    ):
        """get all profiler metrics"""
        profile_results = {"table": {}, "columns": defaultdict(dict)}
        runner = factory.create(
            self.service_connection_config.__class__.__name__, self.connection
        )
        metric_list = [
            self.compute_metrics(runner, metric_func) for metric_func in metric_funcs
        ]
        for metric_result in metric_list:
            profile, column, metric_type = metric_result
            if profile:
                if metric_type == MetricTypes.Table.value:
                    profile_results["table"].update(profile)
                if metric_type == MetricTypes.System.value:
                    profile_results["system"] = profile
                elif metric_type == MetricTypes.Custom.value and column is None:
                    profile_results["table"].update(profile)
                else:
                    profile_results["columns"][column].update(
                        {
                            "name": column,
                            "timestamp": int(
                                datetime.now(tz=timezone.utc).timestamp() * 1000
                            ),
                            **profile,
                        }
                    )
        return profile_results

    @property
    def table(self):
        """OM Table entity"""
        return self.table_entity

    def get_columns(self) -> List[Optional[SQALikeColumn]]:
        return [
            SQALikeColumn(name=c.name.__root__, type=c.dataType)
            for c in self.table.columns
        ]

    def close(self):
        self.connection.close()
