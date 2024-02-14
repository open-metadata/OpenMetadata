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
from typing import Dict, Iterable, List, Optional, Type

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.profiler.adaptors.factory import factory
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import Metric, MetricTypes
from metadata.profiler.metrics.nosql_metric import NoSQLMetric
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_interface_registry_logger()


class NoSQLProfilerInterface(ProfilerInterface, PandasInterfaceMixin):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    # pylint: disable=too-many-arguments

    def _get_sampler(self):
        return None

    def _compute_table_metrics(
        self,
        metrics: List[Type[Metric and NoSQLMetric]],
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
        runner: List,
        column,
        *args,
        **kwargs,
    ):
        return None

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

    def fetch_sample_data(self, table, columns: SQALikeColumn) -> TableData:
        return None

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
        profile_results = {"table": {}, "columns": {}}
        runner = factory.construct(self.connection)
        filtered = self._filter_metrics(metric_funcs)
        metric_list = [
            self.compute_metrics(runner, metric_func) for metric_func in filtered
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
                    pass
        return profile_results

    @property
    def table(self):
        """OM Table entity"""
        return self.table_entity

    def get_columns(self) -> List[Optional[SQALikeColumn]]:
        return []

    def close(self):
        self.connection.close()

    def _filter_metrics(
        self, metrics: List[ThreadPoolMetrics]
    ) -> List[ThreadPoolMetrics]:
        result = []
        for tpm in metrics:
            if not isinstance(tpm.metrics, Iterable):
                continue
            metrics = [
                metric for metric in tpm.metrics if issubclass(metric, NoSQLMetric)
            ]
            if not metrics:
                continue
            result.append(
                ThreadPoolMetrics(
                    metrics=metrics,
                    metric_type=tpm.metric_type,
                    column=tpm.column,
                    table=tpm.table,
                )
            )
        return result
