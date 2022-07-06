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
Main Profile definition and queries to execute
"""
import traceback
from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, Tuple, Type, Union

from pydantic import ValidationError
from sqlalchemy import Column, inspect
from sqlalchemy.engine.row import Row
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.session import Session
from sqlalchemy.orm.util import AliasedClass

from metadata.generated.schema.entity.data.table import ColumnProfile, TableProfile
from metadata.orm_profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    QueryMetric,
    StaticMetric,
    TMetric,
)
from metadata.orm_profiler.metrics.static.column_names import ColumnNames
from metadata.orm_profiler.metrics.static.row_count import RowCount
from metadata.orm_profiler.orm.registry import NOT_COMPUTE
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.constants import TEN_MIN
from metadata.utils.logger import profiler_logger
from metadata.utils.timeout import cls_timeout

logger = profiler_logger()


class MissingMetricException(Exception):
    """
    Raise when building the profiler with Composed Metrics
    and not all the required metrics are present
    """


class Profiler(Generic[TMetric]):
    """
    Core Profiler.

    A profiler is composed of:
    - A session, used to run the queries against.
    - An ORM Table. One profiler attacks one table at a time.
    - A tuple of metrics, from which we will construct queries.
    """

    # pylint: disable=too-many-instance-attributes,too-many-public-methods

    def __init__(
        self,
        *metrics: Type[TMetric],
        session: Session,
        table: DeclarativeMeta,
        profile_date: datetime = datetime.now(),
        ignore_cols: Optional[List[str]] = None,
        use_cols: Optional[List[Column]] = None,
        profile_sample: Optional[float] = None,
        timeout_seconds: Optional[int] = TEN_MIN,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        """
        :param metrics: Metrics to run. We are receiving the uninitialized classes
        :param session: Where to run the queries
        :param table: DeclarativeMeta containing table info
        :param ignore_cols: List of columns to ignore when computing the profile
        :param profile_sample: % of rows to use for sampling column metrics
        """

        if not isinstance(table, DeclarativeMeta):
            raise ValueError(f"Table {table} should be a DeclarativeMeta.")

        self._session = session
        self._table = table
        self._metrics = metrics
        self._ignore_cols = ignore_cols
        self._use_cols = use_cols
        self._profile_sample = profile_sample
        self._profile_date = profile_date
        self._partition_details = partition_details
        self._profile_sample_query = profile_sample_query

        self.validate_composed_metric()

        # Initialize profiler results
        self._table_results: Dict[str, Any] = {}
        self._column_results: Dict[str, Any] = {}

        # We will get columns from the property
        self._columns: Optional[List[Column]] = None

        # We will compute the sample from the property
        self._sampler = Sampler(
            session=session,
            table=table,
            profile_sample=profile_sample,
            partition_details=self._partition_details,
            profile_sample_query=self._profile_sample_query,
        )
        self._sample: Optional[Union[DeclarativeMeta, AliasedClass]] = None

        # Prepare a timeout controlled query runner
        self.runner: QueryRunner = cls_timeout(timeout_seconds)(
            QueryRunner(
                session=session,
                table=table,
                sample=self.sample,
                partition_details=self._partition_details,
                profile_sample_query=self._profile_sample_query,
            )
        )

    @property
    def session(self) -> Session:
        return self._session

    @property
    def table(self) -> DeclarativeMeta:
        return self._table

    @property
    def metrics(self) -> Tuple[Type[TMetric], ...]:
        return self._metrics

    @property
    def ignore_cols(self) -> List[str]:
        return self._ignore_cols

    @property
    def use_cols(self) -> List[Column]:
        """
        Columns to use.

        If it is informed, we'll use them as columns
        instead of picking up all table's columns
        and ignoring the specified ones.
        """
        return self._use_cols

    @property
    def profile_date(self) -> datetime:
        return self._profile_date

    @property
    def columns(self) -> List[Column]:
        """
        Return the list of columns to profile
        by skipping the columns to ignore.
        """

        if self.use_cols:
            return self.use_cols

        ignore = self.ignore_cols if self.ignore_cols else {}

        if not self._columns:
            self._columns = [
                column for column in inspect(self.table).c if column.name not in ignore
            ]

        return self._columns

    def _filter_metrics(self, _type: Type[TMetric]) -> List[Type[TMetric]]:
        """
        Filter metrics by type
        """
        return [metric for metric in self.metrics if issubclass(metric, _type)]

    @property
    def static_metrics(self) -> List[Type[StaticMetric]]:
        return self._filter_metrics(StaticMetric)

    @property
    def composed_metrics(self) -> List[Type[ComposedMetric]]:
        return self._filter_metrics(ComposedMetric)

    @property
    def custom_metrics(self) -> List[Type[CustomMetric]]:
        return self._filter_metrics(CustomMetric)

    @property
    def query_metrics(self) -> List[Type[QueryMetric]]:
        return self._filter_metrics(QueryMetric)

    @staticmethod
    def get_col_metrics(metrics: List[Type[TMetric]]) -> List[Type[TMetric]]:
        """
        Filter list of metrics for column metrics with allowed types
        """
        return [metric for metric in metrics if metric.is_col_metric()]

    @property
    def sample(self):
        if not self._sample:
            self._sample = self._sampler.random_sample()

        return self._sample

    def validate_composed_metric(self) -> None:
        """
        Make sure that all composed metrics have
        the necessary ingredients defined in
        `required_metrics` attr
        """
        names = {metric.name() for metric in self.metrics}
        for metric in self.composed_metrics:
            if not set(metric.required_metrics()).issubset(names):
                raise MissingMetricException(
                    f"We need {metric.required_metrics()} for {metric.name}, but only got {names} in the profiler"
                )

    def run_static_metrics(self, col: Column):
        """
        Run the profiler and store its results

        This should only execute column metrics.

        If needed, we run on a random data sample.
        """
        logger.debug(f"Running SQL Profiler for {col.name}")

        col_metrics = self.get_col_metrics(self.static_metrics)

        if not col_metrics:
            return

        try:
            row = self.runner.select_first_from_sample(
                *[
                    metric(col).fn()
                    for metric in col_metrics
                    if not metric.is_window_metric()
                ]
            )
            self._column_results[col.name].update(dict(row))
        except (TimeoutError, Exception) as err:
            logger.warning(
                f"Error trying to compute column profile for {col.name} - {err}"
            )
            self.session.rollback()

    def run_table_metrics(self):
        """
        Run Table Static metrics

        Table metrics are always executed on the whole data.
        We will only sample column metrics, as they are usually
        the most expensive.
        """
        # Table metrics do not have column informed
        try:
            table_metrics = [
                metric for metric in self.static_metrics if not metric.is_col_metric()
            ]

            if not table_metrics:
                return

            row = self.runner.select_first_from_table(
                *[metric().fn() for metric in table_metrics]
            )
            if row:
                self._table_results.update(dict(row))
        except (TimeoutError, Exception) as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error while running table metric for: {self.table.__tablename__} - {err}"
            )
            self.session.rollback()

    def run_query_metrics(self, col: Column) -> None:
        """
        Run QueryMetrics
        """

        for metric in self.get_col_metrics(self.query_metrics):
            logger.debug(f"Running query metric {metric.name()} for {col.name}")
            try:
                col_metric = metric(col)
                metric_query = col_metric.query(
                    sample=self.sample, session=self.session
                )

                # We might not compute some metrics based on the column type.
                # In those cases, the `query` function returns None
                if not metric_query:
                    continue
                if col_metric.metric_type == dict:
                    query_res = self.runner.select_all_from_query(metric_query)
                    # query_res has the shape of List[Row], where each row is a dict,
                    # e.g., [{colA: 1, colB: 2},...]
                    # We are going to transform this into a Dict[List] by pivoting, so that
                    # data = {colA: [1,2,3], colB: [4,5,6]...}
                    data = {
                        k: [dic[k] for dic in query_res] for k in dict(query_res[0])
                    }
                    self._column_results[col.name].update({metric.name(): data})

                else:
                    row = self.runner.select_first_from_query(metric_query)
                    self._column_results[col.name].update(dict(row))

            except (TimeoutError, Exception) as err:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error computing query metric {metric.name()} for {self.table.__tablename__}.{col.name} - {err}"
                )
                self.session.rollback()

    def run_composed_metrics(self, col: Column):
        """
        Run this after the metrics have been computed

        Data should be saved under self.results
        """

        logger.debug("Running post Profiler...")

        current_col_results: Dict[str, Any] = self._column_results.get(col.name)
        if not current_col_results:
            logger.error(
                "We do not have any results to base our Composed Metrics. Stopping!"
            )
            return

        for metric in self.get_col_metrics(self.composed_metrics):
            # Composed metrics require the results as an argument
            logger.debug(f"Running composed metric {metric.name()} for {col.name}")

            self._column_results[col.name][metric.name()] = metric(col).fn(
                current_col_results
            )

    def run_window_metrics(self, col: Column):
        """
        Run windown metrics in isolation

        Args:
            col: column name
        """

        col_metrics = [
            metric
            for metric in self.get_col_metrics(self.static_metrics)
            if metric.is_window_metric()
        ]

        if not col_metrics:
            return None

        for metric in col_metrics:
            try:
                row = self.runner.select_first_from_sample(metric(col).fn())
                self._column_results[col.name].update(
                    dict(row)
                    if isinstance(row, Row)
                    else {
                        metric.name(): row
                    }  # Snowflake does not return a Row object when table is empty throwing an error
                )
            except (Exception) as err:
                logger.warning(
                    f"Error trying to compute column profile for {col.name} - {err}"
                )
                self.session.rollback()

    def execute_column(self, col: Column) -> None:
        """
        Run the profiler on all the columns that
        have been green-lighted.

        We can assume from this point onwards that
        columns are of allowed types
        """
        self.run_static_metrics(col)
        self.run_window_metrics(col)
        self.run_query_metrics(col)
        self.run_composed_metrics(col)

    def execute(self) -> "Profiler":
        """
        Run the whole profiling
        """

        logger.debug(f"Running profiler for {self.table.__tablename__}")

        self.run_table_metrics()

        for col in self.columns:
            logger.debug(
                f"Running profiler for {self.table.__tablename__}.{col.name} which is [{col.type}]"
            )

            # Skip not supported types
            if col.type.__class__ in NOT_COMPUTE:
                logger.debug(
                    f"Skipping profile computation for {col.name}. Unsupported type {col.type.__class__}"
                )
                continue

            # Init column results dict
            self._column_results[col.name] = {"name": col.name}

            try:
                self.execute_column(col)
            except Exception as exc:  # pylint: disable=broad-except
                logger.error(
                    f"Error trying to compute profile for {self.table.__tablename__}.{col.name} - {exc}"
                )
                self.session.rollback()

        return self

    def get_profile(self) -> TableProfile:
        """
        After executing the profiler, get all results
        and convert them to TableProfile.

        We store the results in the shape:

        _table_results
        {
            "columnCount": ...,
            "rowCount": ...,
        }

        _column_results
        {
            "column_name_A": {
                "metric1": ...,
                "metric2": ...,
            }
        }

        We need to transform it to TableProfile
        """
        try:

            # There are columns that we might have skipped from
            # computing metrics, if the type is not supported.
            # Let's filter those out.
            computed_profiles = [
                ColumnProfile(**self.column_results.get(col.name))
                for col in self.columns
                if self.column_results.get(col.name)
            ]

            profile = TableProfile(
                profileDate=self.profile_date.strftime("%Y-%m-%d"),
                columnCount=self._table_results.get("columnCount"),
                rowCount=self._table_results.get(RowCount.name()),
                columnNames=self._table_results.get(ColumnNames.name(), "").split(","),
                columnProfile=computed_profiles,
                profileQuery=self._profile_sample_query,
                profileSample=self._profile_sample,
            )

            return profile

        except ValidationError as err:
            logger.error(f"Cannot transform profiler results to TableProfile {err}")
            raise err

    @property
    def column_results(self):
        return self._column_results
