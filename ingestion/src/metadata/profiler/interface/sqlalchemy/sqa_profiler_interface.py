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

"""
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

import concurrent.futures
import threading
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import Column
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import scoped_session

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.source.connections import get_connection
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.interface.profiler_protocol import ProfilerProtocol
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.mean import Mean
from metadata.profiler.metrics.static.stddev import StdDev
from metadata.profiler.metrics.static.sum import Sum
from metadata.profiler.processor.runner import QueryRunner
from metadata.profiler.processor.sampler import Sampler
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
from metadata.utils.dispatch import valuedispatch
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


class SQAProfilerInterface(ProfilerProtocol, SQAInterfaceMixin):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    _profiler_type: str = DatabaseConnection.__name__

    def __init__(
        self,
        service_connection_config,
        ometa_client,
        entity,
        profile_sample_config,
        source_config,
        sample_query,
        table_partition_config,
        sqa_metadata=None,
        timeout_seconds=43200,
        thread_count=5,
        **kwargs,
    ):
        """Instantiate SQA Interface object"""
        self._thread_count = thread_count
        self.table_entity = entity
        self.ometa_client = ometa_client
        self.source_config = source_config
        self.service_connection_config = service_connection_config
        self.processor_status = ProfilerProcessorStatus()
        try:
            fqn = self.table_entity.fullyQualifiedName
        except AttributeError:
            self.processor_status.entity = None
        else:
            self.processor_status.entity = fqn.__root__ if fqn else None

        self._table = self._convert_table_to_orm_object(sqa_metadata)

        self.session_factory = self._session_factory(service_connection_config)
        self.session = self.session_factory()
        self.set_session_tag(self.session)
        self.set_catalog(self.session)

        self.profile_sample_config = profile_sample_config
        self.profile_query = sample_query
        self.partition_details = (
            table_partition_config if not self.profile_query else None
        )

        self.timeout_seconds = timeout_seconds

    @property
    def table(self):
        return self._table

    @staticmethod
    def _session_factory(service_connection_config) -> scoped_session:
        """Create thread safe session that will be automatically
        garbage collected once the application thread ends
        """
        engine = get_connection(service_connection_config)
        return create_and_bind_thread_safe_session(engine)

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

    @valuedispatch
    def _get_metrics(self, *args, **kwargs):
        """Generic getter method for metrics. To be used with
        specific dispatch methods
        """
        logger.warning("Could not get metric. No function registered.")

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Table.value)
    def _(
        self,
        metric_type: str,
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
        try:
            row = runner.select_first_from_sample(
                *[metric().fn() for metric in metrics]
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

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Static.value)
    def _(
        self,
        metric_type: str,
        metrics: List[Metrics],
        runner: QueryRunner,
        session,
        column: Column,
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
                is_array=column._is_array,  # pylint: disable=protected-access
                array_col=column._array_col,  # pylint: disable=protected-access
            )
            return dict(row)
        except Exception as exc:
            if (
                isinstance(exc, ProgrammingError)
                and exc.orig
                and exc.orig.errno
                in OVERFLOW_ERROR_CODES.get(session.bind.dialect.name)
            ):
                logger.info(
                    f"Computing metrics without sum for {runner.table.__tablename__}.{column.name}"
                )
                return self._compute_static_metrics_wo_sum(
                    metrics, runner, session, column
                )

            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Query.value)
    def _(
        self,
        metric_type: str,
        metric: Metrics,
        runner: QueryRunner,
        session,
        column: Column,
        sample,
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
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Window.value)
    def _(
        self,
        metric_type: str,
        metrics: List[Metrics],
        runner: QueryRunner,
        session,
        column: Column,
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
                is_array=column._is_array,  # pylint: disable=protected-access
                array_col=column._array_col,  # pylint: disable=protected-access
            )
        except Exception as exc:
            if (
                isinstance(exc, ProgrammingError)
                and exc.orig
                and exc.orig.errno
                in OVERFLOW_ERROR_CODES.get(session.bind.dialect.name)
            ):
                logger.info(
                    f"Skipping window metrics for {runner.table.__tablename__}.{column.name} due to overflow"
                )
                return None
            msg = f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            handle_query_exception(msg, exc, session)
        if row:
            return dict(row)
        return None

    @_get_metrics.register(MetricTypes.System.value)
    def _(
        self,
        metric_type: str,
        metric: Metrics,
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
            rows = metric().sql(session, conn_config=self.service_connection_config)
            return rows
        except Exception as exc:
            msg = f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"
            handle_query_exception(msg, exc, session)

    def _create_thread_safe_sampler(
        self,
        session,
        table,
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "sampler"):
            thread_local.sampler = Sampler(
                session=session,
                table=table,
                sample_columns=self._get_sample_columns(),
                profile_sample_config=self.profile_sample_config,
                partition_details=self.partition_details,
                profile_sample_query=self.profile_query,
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
                row = self._get_metrics(
                    metric_type.value,
                    metrics,
                    runner=runner,
                    session=session,
                    column=column,
                    sample=sample,
                )
            except Exception as exc:
                error = f"{column if column is not None else runner.table.__tablename__} metric_type.value: {exc}"
                logger.error(error)
                self.processor_status.failed_profiler(error, traceback.format_exc())
                row = None

            if column is not None:
                column = column.name

            return row, column, metric_type.value

    # pylint: disable=use-dict-literal
    def get_all_metrics(
        self,
        metric_funcs: list,
    ):
        """get all profiler metrics"""
        logger.info(f"Computing metrics with {self._thread_count} threads.")
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
                                "timestamp": datetime.now(tz=timezone.utc).timestamp(),
                                **profile,
                            }
                        )
                except concurrent.futures.TimeoutError as exc:
                    pool.shutdown39(wait=True, cancel_futures=True)
                    logger.debug(traceback.format_exc())
                    logger.error(f"Operation was cancelled due to TimeoutError - {exc}")
                    raise concurrent.futures.TimeoutError

        return profile_results

    def fetch_sample_data(self, table) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = Sampler(
            session=self.session,
            table=table,
            sample_columns=self._get_sample_columns(),
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )

        # Only fetch columns that are in the table entity
        # with struct columns we create a column for each field in the ORM table
        # but we only want to fetch the columns that are in the table entity
        sample_columns = [
            column.name
            for column in table.__table__.columns
            if column.name in {col.name.__root__ for col in self.table_entity.columns}
        ]

        return sampler.fetch_sqa_sample_data(sample_columns)

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
        self, column: Column, metric: Metrics, column_results: Dict, table, **kwargs
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        sampler = Sampler(
            session=self.session,
            table=table,
            sample_columns=self._get_sample_columns(),
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )
        sample = sampler.random_sample()
        try:
            return metric(column).fn(sample, column_results, self.session)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            self.session.rollback()
            return None
