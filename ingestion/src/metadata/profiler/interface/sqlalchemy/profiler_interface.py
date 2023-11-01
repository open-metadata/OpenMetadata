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
import threading
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import Column, inspect
from sqlalchemy.exc import ProgrammingError, ResourceClosedError
from sqlalchemy.orm import scoped_session

from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum
from metadata.profiler.orm.functions.table_metric_construct import (
    table_metric_construct_factory,
)
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
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
        service_connection_config,
        ometa_client,
        entity,
        profile_sample_config,
        source_config,
        sample_query,
        table_partition_config,
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        sqa_metadata=None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        """Instantiate SQA Interface object"""

        super().__init__(
            service_connection_config,
            ometa_client,
            entity,
            profile_sample_config,
            source_config,
            sample_query,
            table_partition_config,
            thread_count,
            timeout_seconds,
            sample_data_count,
        )

        self._table = self._convert_table_to_orm_object(sqa_metadata)
        self.session_factory = self._session_factory()
        self.session = self.session_factory()
        self.set_session_tag(self.session)
        self.set_catalog(self.session)

    @property
    def table(self):
        return self._table

    def _get_sampler(self, **kwargs):
        """get sampler object"""
        from metadata.profiler.processor.sampler.sampler_factory import (  # pylint: disable=import-outside-toplevel
            sampler_factory_,
        )

        session = kwargs.get("session")
        table = kwargs["table"]

        return sampler_factory_.create(
            self.service_connection_config.__class__.__name__,
            client=session or self.session,
            table=table,
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
            sample_data_count=self.sample_data_count,
        )

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
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        session,
        *args,
        **kwargs,
    ):
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
            row = table_metric_construct_factory.construct(
                dialect,
                runner=runner,
                metrics=metrics,
                conn_config=self.service_connection_config,
            )
            if row:
                return dict(row)
            return None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"  # type: ignore
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
        except ProgrammingError as exc:
            return self._programming_error_static_metric(
                runner, column, exc, session, metrics
            )
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
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
                msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
                handle_query_exception(msg, exc, session)
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
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
            dictionnary of results
        """

        if not metrics:
            return None
        try:
            row = runner.select_first_from_sample(
                *[metric(column).fn() for metric in metrics],
            )
        except ProgrammingError as exc:
            logger.info(
                f"Skipping metrics for {runner.table.__tablename__}.{column.name} due to {exc}"
            )
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        if row:
            return dict(row)
        return None

    def _compute_system_metrics(
        self,
        metrics: Metrics,
        runner: QueryRunner,
        session,
        *args,
        **kwargs,
    ):
        """Get system metric for tables

        Args:
            metric_type: type of metric
            metrics: list of metrics to compute
            session: SQA session object

        Returns:
            dictionnary of results
        """
        try:
            rows = metrics().sql(session, conn_config=self.service_connection_config)
            return rows
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"
            handle_query_exception(msg, exc, session)
        return None

    def _create_thread_safe_sampler(
        self,
        session,
        table,
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "sampler"):
            thread_local.sampler = self._get_sampler(
                table=table,
                session=session,
            )
        return thread_local.sampler

    def _create_thread_safe_runner(
        self,
        session,
        table,
        sample,
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "runner"):
            thread_local.runner = QueryRunner(
                session=session,
                table=table,
                sample=sample,
                partition_details=self.partition_details,
                profile_sample_query=self.profile_query,
            )
        return thread_local.runner

    def compute_metrics_in_thread(
        self,
        metrics,
        metric_type,
        column,
        table,
    ):
        """Run metrics in processor worker"""
        logger.debug(
            f"Running profiler for {table.__tablename__} on thread {threading.current_thread()}"
        )
        Session = self.session_factory  # pylint: disable=invalid-name
        with Session() as session:
            self.set_session_tag(session)
            self.set_catalog(session)
            sampler = self._create_thread_safe_sampler(
                session,
                table,
            )
            sample = sampler.random_sample()
            runner = self._create_thread_safe_runner(
                session,
                table,
                sample,
            )

            try:
                row = self._get_metric_fn[metric_type.value](
                    metrics,
                    runner=runner,
                    session=session,
                    column=column,
                    sample=sample,
                )
            except Exception as exc:
                error = f"{column if column is not None else runner.table.__tablename__} metric_type.value: {exc}"
                logger.error(error)
                self.status.failed_profiler(error, traceback.format_exc())
                row = None

            if column is not None:
                column = column.name
                self.status.scanned(f"{table.__tablename__}.{column}")
            else:
                self.status.scanned(table.__tablename__)

            return row, column, metric_type.value

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
                    *metric_func,
                )
                for metric_func in metric_funcs
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
                except concurrent.futures.TimeoutError as exc:
                    pool.shutdown39(wait=True, cancel_futures=True)
                    logger.debug(traceback.format_exc())
                    logger.error(f"Operation was cancelled due to TimeoutError - {exc}")
                    raise concurrent.futures.TimeoutError

        return profile_results

    def fetch_sample_data(self, table, columns) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = self._get_sampler(
            table=table,
        )

        return sampler.fetch_sample_data(columns)

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
        self, column: Column, metric: Metrics, column_results: Dict, **kwargs
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        sampler = self._get_sampler(table=kwargs.get("table"))
        sample = sampler.random_sample()
        try:
            return metric(column).fn(sample, column_results, self.session)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None

    def _programming_error_static_metric(self, runner, column, exc, _, __):
        """
        Override Programming Error for Static Metrics
        """
        logger.error(
            f"Skipping metrics due to {exc} for {runner.table.__tablename__}.{column.name}"
        )

    def get_columns(self):
        """get columns from entity"""
        return list(inspect(self.table).c)

    def close(self):
        """Clean up session"""
        self.session.close()
        self.connection.pool.dispose()
