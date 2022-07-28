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
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Union

from sqlalchemy import Column
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.columnTest import ColumnTestCase
from metadata.generated.schema.tests.tableTest import TableTestCase
from metadata.orm_profiler.interfaces.interface_protocol import InterfaceProtocol
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.orm_profiler.validations.core import validation_enum_registry
from metadata.utils.connections import (
    create_and_bind_thread_safe_session,
    get_connection,
    test_connection,
)
from metadata.utils.constants import TEN_MIN
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import sqa_interface_registry_logger
from metadata.utils.timeout import cls_timeout

logger = sqa_interface_registry_logger()

thread_local = threading.local()


class SQAProfilerInterface(InterfaceProtocol):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    def __init__(self, service_connection_config, thread_count: int = 5):
        """Instantiate SQA Interface object"""
        self._sampler = None
        self._runner = None
        self._thread_count = thread_count
        self.service_connection_config = service_connection_config
        self.session: Session = self._session_factory()

    @property
    def sample(self):
        """Getter method for sample attribute"""
        if not self.sampler:
            raise RuntimeError(
                "You must create a sampler first `<instance>.create_sampler(...)`."
            )

        return self.sampler.random_sample()

    @property
    def runner(self):
        """Getter method for runner attribute"""
        return self._runner

    @property
    def sampler(self):
        """Getter methid for sampler attribute"""
        return self._sampler

    def _session_factory(self):
        """Create thread safe session"""
        engine = get_connection(self.service_connection_config)
        return create_and_bind_thread_safe_session(engine)()

    def _create_thread_safe_sampler(
        self, session, table, profile_sample, partition_details, profile_sample_query
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "runner"):
            thread_local.sampler = Sampler(
                session=session,
                table=table,
                profile_sample=profile_sample,
                partition_details=partition_details,
                profile_sample_query=profile_sample_query,
            )
        return thread_local.sampler

    def _create_thread_safe_runner(
        self, session, table, sample, partition_details, profile_sample_query
    ):
        """Create thread safe runner"""
        if not hasattr(thread_local, "runner"):
            thread_local.runner = QueryRunner(
                session=session,
                table=table,
                sample=sample,
                partition_details=partition_details,
                profile_sample_query=profile_sample_query,
            )
        return thread_local.runner

    def compute_metrics_in_thread(
        self,
        metric_funcs,
    ):
        """Run metrics in processor worker"""
        (
            metrics,
            metric_type,
            column,
            table,
            profile_sample,
            partition_details,
            profile_sample_query,
        ) = metric_funcs
        logger.debug(
            f"Running profiler for {table.__tablename__} on thread {threading.current_thread()}"
        )
        session = self._session_factory()
        sampler = self._create_thread_safe_sampler(
            session, table, profile_sample, partition_details, profile_sample_query
        )
        sample = sampler.random_sample()
        runner = self._create_thread_safe_runner(
            session, table, sample, partition_details, profile_sample_query
        )

        row = compute_metrics_registry.registry[metric_type.value](
            metrics,
            runner=runner,
            session=session,
            column=column,
            sample=sample,
        )

        try:
            column = column.name
        except Exception as err:
            logger.debug(err)

        return row, column

    def get_all_metrics(
        self,
        metric_funcs: list,
    ):
        """get all profiler metrics"""
        logger.info(f"Computing metrics with {self._thread_count} threads.")
        profile_results = {"table": dict(), "columns": defaultdict(dict)}
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self._thread_count
        ) as executor:
            futures = [
                executor.submit(
                    self.compute_metrics_in_thread,
                    metric_func,
                )
                for metric_func in metric_funcs
            ]

        for future in concurrent.futures.as_completed(futures):
            profile, column = future.result()
            if not isinstance(profile, dict):
                profile = dict()
            if not column:
                profile_results["table"].update(profile)
            else:
                profile_results["columns"][column].update({"name": column, **profile})
        return profile_results

    def _get_engine(self, service_connection_config):
        """Get engine for database

        Args:
            service_connection_config: connection details for the specific service
        Returns:
            sqlalchemy engine
        """
        engine = get_connection(service_connection_config)
        test_connection(engine)

        return engine

    def fetch_sample_data(self):
        if not self.sampler:
            raise RuntimeError(
                "You must create a sampler first `<instance>.create_sampler(...)`."
            )
        return self.sampler.fetch_sample_data()

    def create_sampler(
        self,
        table: DeclarativeMeta,
        profile_sample: Optional[float] = None,
        partition_details: Optional[dict] = None,
        profile_sample_query: Optional[str] = None,
    ) -> None:
        """Create sampler instance

        Args:
            table: sqlalchemy declarative table of the database table,
            profile_sample: percentage to use for the table sample (between 0-100)
            partition_details: details about the table partition
            profile_sample_query: custom query used for table sampling
        """
        self._sampler = Sampler(
            session=self.session,
            table=table,
            profile_sample=profile_sample,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
        )

    def create_runner(
        self,
        table: DeclarativeMeta,
        partition_details: Optional[dict] = None,
        profile_sample_query: Optional[str] = None,
    ) -> None:
        """Create a QueryRunner Instance

        Args:
            table: sqlalchemy declarative table of the database table,
            profile_sample: percentage to use for the table sample (between 0-100)
            partition_details: details about the table partition
            profile_sample_query: custom query used for table sampling
        """

        self._runner = cls_timeout(TEN_MIN)(
            QueryRunner(
                session=self.session,
                table=table,
                sample=self.sample,
                partition_details=partition_details,
                profile_sample_query=profile_sample_query,
            )
        )

    def get_table_metrics(
        self,
        metrics: List[Metrics],
    ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row = self.runner.select_first_from_table(
                *[metric().fn() for metric in metrics]
            )

            if row:
                return dict(row)

        except Exception as err:
            logger.error(err)
            self.session.rollback()

    def get_static_metrics(
        self,
        column: Column,
        metrics: List[Metrics],
    ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row = self.runner.select_first_from_sample(
                *[
                    metric(column).fn()
                    for metric in metrics
                    if not metric.is_window_metric()
                ]
            )
            return dict(row)
        except Exception as err:
            logger.error(err)
            self.session.rollback()

    def get_query_metrics(
        self,
        column: Column,
        metric: Metrics,
    ) -> Optional[Dict[str, Union[str, int]]]:
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
            metric_query = col_metric.query(sample=self.sample, session=self.session)
            if not metric_query:
                return None
            if col_metric.metric_type == dict:
                results = self.runner.select_all_from_query(metric_query)
                data = {k: [result[k] for result in results] for k in dict(results[0])}
                return {metric.name(): data}

            else:
                row = self.runner.select_first_from_query(metric_query)
                return dict(row)
        except Exception as err:
            logger.error(err)
            self.session.rollback()

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
        except Exception as err:
            logger.error(err)
            self.session.rollback()

    def get_window_metrics(
        self,
        column: Column,
        metric: Metrics,
    ) -> Dict[str, Union[str, int]]:
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row = self.runner.select_first_from_sample(metric(column).fn())
            if not isinstance(row, Row):
                return {metric.name(): row}
            return dict(row)
        except Exception as err:
            logger.error(err)
            self.session.rollback()

    def run_table_test(
        self,
        test_case: TableTestCase,
        table_profile: TableProfile,
        orm_table: DeclarativeMeta,
        profile_sample: float,
    ) -> Optional[TestCaseResult]:
        """Run table tests

        Args:
            table_test_type: test type to be ran
            table_profile: table profile
            table: SQA table,
            profile_sample: sample for the profile
        """
        return validation_enum_registry.registry[test_case.tableTestType.value](
            test_case.config,
            table_profile=table_profile,
            execution_date=datetime.now(),
            session=self.session,
            table=orm_table,
            profile_sample=profile_sample,
        )

    def run_column_test(
        self,
        test_case: ColumnTestCase,
        col_profile: TableProfile,
        orm_table: DeclarativeMeta,
    ) -> Optional[TestCaseResult]:
        """Run table tests

        Args:
            table_test_type: test type to be ran
            table_profile: table profile
            table: SQA table,
            profile_sample: sample for the profile
        """
        return validation_enum_registry.registry[test_case.columnTestType.value](
            test_case.config,
            col_profile=col_profile,
            execution_date=datetime.now(),
            table=orm_table,
            runner=self.runner,
        )


def get_table_metrics(
    metrics: List[Metrics],
    runner: QueryRunner,
    session: Session,
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
        row = runner.select_first_from_table(*[metric().fn() for metric in metrics])

        if row:
            return dict(row)

    except Exception as err:
        logger.error(
            f"Error trying to compute profile for {runner.table.__tablename__} - {err}"
        )
        session.rollback()


def get_static_metrics(
    metrics: List[Metrics],
    runner: QueryRunner,
    session: Session,
    column: Column,
    *args,
    **kwargs,
) -> Dict[str, Union[str, int]]:
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
    except Exception as err:
        logger.error(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name} - {err}"
        )
        session.rollback()


def get_query_metrics(
    metric: Metrics,
    runner: QueryRunner,
    session: Session,
    column: Column,
    sample,
    *args,
    **kwargs,
) -> Optional[Dict[str, Union[str, int]]]:
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

        else:
            row = runner.select_first_from_query(metric_query)
            return dict(row)
    except Exception as err:
        logger.error(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name} - {err}"
        )
        session.rollback()


def get_window_metrics(
    metric: Metrics,
    runner: QueryRunner,
    session: Session,
    column: Column,
    *args,
    **kwargs,
) -> Dict[str, Union[str, int]]:
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
    except Exception as err:
        logger.error(
            f"Error trying to compute profile for {runner.table.__tablename__}.{column.name} - {err}"
        )
        session.rollback()


compute_metrics_registry = enum_register()
compute_metrics_registry.add("Static")(get_static_metrics)
compute_metrics_registry.add("Table")(get_table_metrics)
compute_metrics_registry.add("Query")(get_query_metrics)
compute_metrics_registry.add("Window")(get_window_metrics)
