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

import concurrent.futures
import math
import threading
import traceback
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, Union

from sqlalchemy import Column, inspect, text
from sqlalchemy.exc import DBAPIError, ProgrammingError, ResourceClosedError
from sqlalchemy.orm import scoped_session

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
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import HybridMetric, MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum
from metadata.profiler.metrics.system.system import System, SystemMetricsComputer
from metadata.profiler.orm.functions.table_metric_computer import TableMetricComputer
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.metric_filter import MetricFilter
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()
thread_local = threading.local()

OVERFLOW_ERROR_CODES = {
    "snowflake": {100046, 100058},
}


def handle_query_exception(msg, exc, session):
    """Handle exception for query runs"""
    logger.debug(traceback.format_exc())
    logger.warning(msg)
    session.rollback()
    raise RuntimeError(exc)


class SQAProfilerInterface(ProfilerInterface, SQAInterfaceMixin):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    # pylint: disable=too-many-arguments
    def __init__(
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
        """Instantiate SQA Interface object"""
        self.session_factory = None
        self.session = None

        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            source_config=source_config,
            sampler=sampler,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
        )

        self._table = self.sampler.raw_dataset
        self.create_session()
        self.system_metrics_computer = self.initialize_system_metrics_computer()

    def initialize_system_metrics_computer(self) -> SystemMetricsComputer:
        """Initialize system metrics computer. Override this if you want to use a metric source with
        state or other dependencies.
        """
        return SystemMetricsComputer()

    def create_session(self):
        self.session_factory = self._session_factory()
        self.session = self.session_factory()

    @property
    def table(self):
        return self._table

    def _session_factory(self) -> scoped_session:
        """Create thread safe session that will be automatically
        garbage collected once the application thread ends
        """
        return create_and_bind_thread_safe_session(self.connection)

    @staticmethod
    def _compute_static_metrics_wo_sum(
        metrics: List[Metrics],
        runner: QueryRunner,
        session,
        column: Column,
    ):
        """If we catch an overflow error, we will try to compute the static
        metrics without the sum, mean and stddev

        Returns:
            _type_: _description_
        """
        try:
            row = runner.select_first_from_sample(
                *[
                    metric(column).fn()
                    for metric in metrics
                    if not metric.is_window_metric()
                    and metric not in {Sum, StdDev, Mean}
                ]
            )
            return dict(row)
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        session,
        *args,
        **kwargs,
    ) -> Optional[Dict[str, Any]]:
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        # pylint: disable=protected-access
        try:
            dialect = runner._session.get_bind().dialect.name
            table_metric_computer: TableMetricComputer = TableMetricComputer(
                dialect,
                runner=runner,
                metrics=metrics,
                conn_config=self.service_connection_config,
                entity=self.table_entity,
            )
            row = table_metric_computer.compute()
            if row:
                return dict(row)
            return None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table_name}: {exc}"  # type: ignore
            )
            session.rollback()
            raise RuntimeError(exc)

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        column,
        session,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row = runner.select_first_from_sample(
                *[
                    metric(column).fn()
                    for metric in metrics
                    if not metric.is_window_metric()
                ],
            )
            return dict(row)
        except (ProgrammingError, DBAPIError) as exc:
            return self._programming_error_static_metric(
                runner, column, exc, session, metrics
            )
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_query_metrics(
        self,
        metric: Metrics,
        runner: QueryRunner,
        column,
        session,
        sample,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """

        try:
            col_metric = metric(column)
            metric_query = col_metric.query(sample=sample, session=session)
            if not metric_query:
                return None
            if col_metric.metric_type == dict:
                results = runner.select_all_from_query(metric_query)
                data = {k: [result[k] for result in results] for k in dict(results[0])}
                return {metric.name(): data}

            row = runner.select_first_from_query(metric_query)
            return dict(row)
        except ResourceClosedError as exc:
            # if the query returns no results, we will get a ResourceClosedError from Druid
            if (
                # pylint: disable=protected-access
                runner._session.get_bind().dialect.name
                != Dialects.Druid
            ):
                msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
                handle_query_exception(msg, exc, session)
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        column,
        session,
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionary of results
        """

        if not metrics:
            return None
        try:
            row = runner.select_first_from_sample(
                *[metric(column).fn() for metric in metrics],
            )
            if row:
                return dict(row)
        except ProgrammingError as exc:
            logger.info(
                f"Skipping metrics for {runner.table_name}.{column.name} due to {exc}"
            )
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table_name}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, session, *args, **kwargs
    ):
        """Compute custom metrics

        Args:
            metrics (List[Metrics]): list of customMetrics
            runner (_type_): runner
        """
        if not metrics:
            return None

        custom_metrics = []

        for metric in metrics:
            try:
                if not is_safe_sql_query(metric.expression):
                    raise RuntimeError(
                        f"SQL expression is not safe\n\n{metric.expression}"
                    )

                crs = session.execute(text(metric.expression))
                row = (
                    crs.scalar()
                )  # raise MultipleResultsFound if more than one row is returned
                custom_metrics.append(
                    CustomMetricProfile(name=metric.name.root, value=row)
                )

            except Exception as exc:
                msg = f"Error trying to compute profile for {runner.table_name}.{metric.columnName}: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(msg)
        if custom_metrics:
            return {"customMetrics": custom_metrics}
        return None

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        """Get system metric for tables

        Args:
            metric_type: type of metric
            metrics: list of metrics to compute
            session: SQA session object

        Returns:
            dictionnary of results
        """
        logger.debug(f"Computing system metrics for {runner.table_name}")
        return self.system_metrics_computer.get_system_metrics(runner=runner)

    def _create_thread_safe_runner(self, session, column=None):
        """Create thread safe runner"""
        if not hasattr(thread_local, "runner"):
            thread_local.runner = QueryRunner(
                session=session,
                dataset=self.sampler.get_dataset(column=column),
                raw_dataset=self.sampler.raw_dataset,
                partition_details=self.sampler.partition_details,
                profile_sample_query=self.sampler.sample_query,
            )
            return thread_local.runner
        thread_local.runner.dataset = self.sampler.get_dataset(column=column)
        return thread_local.runner

    def compute_metrics_in_thread(
        self,
        metric_func: ThreadPoolMetrics,
    ):
        """Run metrics in processor worker"""
        logger.debug(
            f"Running profiler for {metric_func.table.__tablename__} on thread {threading.current_thread()}"
        )
        Session = self.session_factory  # pylint: disable=invalid-name
        with Session() as session:
            self.set_session_tag(session)
            self.set_catalog(session)
            runner = self._create_thread_safe_runner(session, metric_func.column)
            row = None
            try:
                row = self._get_metric_fn[metric_func.metric_type.value](
                    metric_func.metrics,
                    runner=runner,
                    session=session,
                    column=metric_func.column,
                    sample=runner.dataset,
                )
                if isinstance(row, dict):
                    row = self._validate_nulls(row)
                if isinstance(row, list):
                    row = [
                        self._validate_nulls(r) if isinstance(r, dict) else r
                        for r in row
                    ]

            except Exception as exc:
                error = (
                    f"{metric_func.column if metric_func.column is not None else metric_func.table.__tablename__} "
                    f"metric_type.value: {exc}"
                )
                logger.error(error)
                self.status.failed_profiler(error, traceback.format_exc())

            if metric_func.column is not None:
                column = metric_func.column.name
                self.status.scanned(f"{metric_func.table.__tablename__}.{column}")
            else:
                self.status.scanned(metric_func.table.__tablename__)
                column = None

            return row, column, metric_func.metric_type.value

    @staticmethod
    def _validate_nulls(row: Dict[str, Any]) -> Dict[str, Any]:
        """Detect if we are computing NaNs and replace them with None"""
        for k, v in row.items():
            if isinstance(v, float) and math.isnan(v):
                logger.warning(
                    "NaN data detected and will be cast to null in OpenMetadata to maintain database parity"
                )
                row[k] = None
        return row

    # pylint: disable=use-dict-literal
    def get_all_metrics(
        self,
        metric_funcs: list,
    ):
        """get all profiler metrics"""
        logger.debug(f"Computing metrics with {self._thread_count} threads.")
        profile_results = {"table": dict(), "columns": defaultdict(dict)}
        with CustomThreadPoolExecutor(max_workers=self._thread_count) as pool:
            futures = [
                pool.submit(
                    self.compute_metrics_in_thread,
                    metric_func,
                )
                for metric_func in MetricFilter.filter_empty_metrics(metric_funcs)
            ]

            for future in futures:
                if future.cancelled():
                    continue

                try:
                    profile, column, metric_type = future.result(
                        timeout=self.timeout_seconds
                    )
                    if metric_type != MetricTypes.System.value and not isinstance(
                        profile, dict
                    ):
                        profile = dict()
                    if metric_type == MetricTypes.Table.value:
                        profile_results["table"].update(profile)
                    elif metric_type == MetricTypes.System.value:
                        profile_results["system"] = profile
                    elif metric_type == MetricTypes.Custom.value and column is None:
                        profile_results["table"].update(profile)
                    else:
                        profile_results["columns"][column].update(
                            {
                                "name": column,
                                "timestamp": int(datetime.now().timestamp() * 1000),
                                **profile,
                            }
                        )
                except concurrent.futures.TimeoutError as exc:
                    pool.shutdown39(wait=True, cancel_futures=True)
                    logger.debug(traceback.format_exc())
                    logger.error(f"Operation was cancelled due to TimeoutError - {exc}")
                    raise concurrent.futures.TimeoutError
                except KeyboardInterrupt:
                    pool.shutdown39(wait=True, cancel_futures=True)
                    raise

        return profile_results

    def get_composed_metrics(
        self, column: Column, metric: Metrics, column_results: Dict
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            return metric(column).fn(column_results)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None

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
            return metric(column).fn(dataset, column_results, self.session)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None

    def _programming_error_static_metric(self, runner, column, exc, _, __):
        """
        Override Programming Error for Static Metrics
        """
        raise exc

    def get_columns(self):
        """get columns from entity"""
        return list(inspect(self.table).c)

    def close(self):
        """Clean up session"""
        self.session.close()
        self.connection.pool.dispose()
