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
from sqlalchemy.engine.row import Row

from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.ingestion.source.connections import get_connection
from metadata.interfaces.profiler_protocol import (
    ProfilerInterfaceArgs,
    ProfilerProtocol,
)
from metadata.interfaces.sqalchemy.mixins.sqa_mixin import SQAInterfaceMixin
from metadata.orm_profiler.metrics.core import MetricTypes
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.custom_thread_pool import CustomThreadPoolExecutor
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()
thread_local = threading.local()


class SQAProfilerInterface(SQAInterfaceMixin, ProfilerProtocol):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def __init__(self, profiler_interface_args: ProfilerInterfaceArgs):
        """Instantiate SQA Interface object"""
        self._thread_count = profiler_interface_args.thread_count
        self.table_entity = profiler_interface_args.table_entity
        self.ometa_client = profiler_interface_args.ometa_client
        self.service_connection_config = (
            profiler_interface_args.service_connection_config
        )

        self.processor_status = ProfilerProcessorStatus()
        self.processor_status.entity = (
            self.table_entity.fullyQualifiedName.__root__
            if self.table_entity.fullyQualifiedName
            else None
        )

        self._table = self._convert_table_to_orm_object(
            profiler_interface_args.sqa_metadata_obj
        )

        self.session_factory = self._session_factory(
            profiler_interface_args.service_connection_config
        )
        self.session = self.session_factory()
        self.set_session_tag(self.session)

        self.profile_sample_config = profiler_interface_args.profile_sample_config
        self.profile_query = profiler_interface_args.table_sample_query
        self.partition_details = (
            self.get_partition_details(profiler_interface_args.table_partition_config)
            if not self.profile_query
            else None
        )

        self.timeout_seconds = profiler_interface_args.timeout_seconds

    @staticmethod
    def _session_factory(service_connection_config):
        """Create thread safe session that will be automatically
        garbage collected once the application thread ends
        """
        engine = get_connection(service_connection_config)
        return create_and_bind_thread_safe_session(engine)

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
                f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"
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
                ]
            )
            return dict(row)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            )
            session.rollback()
            raise RuntimeError(exc)

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
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            )
            session.rollback()
            raise RuntimeError(exc)

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Window.value)
    def _(
        self,
        metric_type: str,
        metric: Metrics,
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
            row = runner.select_first_from_sample(metric(column).fn())
            if not isinstance(row, Row):
                return {metric.name(): row}
            return dict(row)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table.__tablename__}.{column.name}: {exc}"
            )
            session.rollback()
            raise RuntimeError(exc)

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
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to compute profile for {runner.table.__tablename__}: {exc}"
            )
            session.rollback()
            raise RuntimeError(exc)

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
                logger.error(exc)
                self.processor_status.failure(
                    f"{column if column is not None else runner.table.__tablename__}",
                    "metric_type.value",
                    f"{exc}",
                )
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
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )
        return sampler.fetch_sqa_sample_data()

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
