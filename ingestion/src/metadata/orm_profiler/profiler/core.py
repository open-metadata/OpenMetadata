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
from __future__ import annotations

import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Generic, List, Optional, Set, Tuple, Type

from pydantic import ValidationError
from sqlalchemy import Column
from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ColumnProfile,
    ColumnProfilerConfig,
    SystemProfile,
    TableProfile,
)
from metadata.interfaces.profiler_protocol import ProfilerProtocol
from metadata.orm_profiler.api.models import ProfilerResponse
from metadata.orm_profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    MetricTypes,
    QueryMetric,
    StaticMetric,
    SystemMetric,
    TMetric,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.metrics.static.row_count import RowCount
from metadata.orm_profiler.orm.registry import NOT_COMPUTE, NOT_COMPUTE_OM
from metadata.utils.column_base_model import ColumnBaseModel
from metadata.utils.logger import profiler_logger

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
    - A profiler_interface, used to run the profiler against a source.
    - An ORM Table. One profiler attacks one table at a time.
    - A tuple of metrics, from which we will construct queries.
    """

    def __init__(
        self,
        *metrics: Type[TMetric],
        profiler_interface: ProfilerProtocol,
        profile_date: datetime = datetime.now(tz=timezone.utc).timestamp(),
        include_columns: Optional[List[ColumnProfilerConfig]] = None,
        exclude_columns: Optional[List[str]] = None,
    ):
        """
        :param metrics: Metrics to run. We are receiving the uninitialized classes
        :param profiler_interface: Where to run the queries
        :param table: DeclarativeMeta containing table info
        :param ignore_cols: List of columns to ignore when computing the profile
        :param profile_sample: % of rows to use for sampling column metrics
        """

        self.profiler_interface = profiler_interface
        self.include_columns = include_columns
        self.exclude_columns = exclude_columns
        self._metrics = metrics
        self._profile_date = profile_date
        self.profile_sample_config = self.profiler_interface.profile_sample_config

        self.validate_composed_metric()

        # Initialize profiler results
        self._table_results: Dict[str, Any] = {}
        self._column_results: Dict[str, Any] = {}
        self._system_results: Optional[List[Dict]] = []

        # We will get columns from the property
        self._columns: Optional[List[Column]] = None
        self.data_frame_list = None

    @property
    def table(self) -> DeclarativeMeta:
        return self.profiler_interface.table

    @property
    def metrics(self) -> Tuple[Type[TMetric], ...]:
        return self._metrics

    @property
    def ignore_cols(self) -> List[str]:
        return self._get_excluded_columns()

    @property
    def use_cols(self) -> List[Column]:
        """
        Columns to use.

        If it is informed, we'll use them as columns
        instead of picking up all table's columns
        and ignoring the specified ones.
        """
        return self._get_included_columns()

    @property
    def profile_date(self) -> datetime:
        return self._profile_date

    @property
    def columns(self) -> List[Column]:
        """
        Return the list of columns to profile
        by skipping the columns to ignore.
        """

        if self._columns:
            return self._columns

        if self._get_included_columns():
            self._columns = [
                column
                for column in self.profiler_interface.get_columns()
                if column.name in self._get_included_columns()
            ]

        if not self._get_included_columns():
            self._columns = [
                column
                for column in self._columns or self.profiler_interface.get_columns()
                if column.name not in self._get_excluded_columns()
            ]

        return self._columns

    def _get_excluded_columns(self) -> Optional[Set[str]]:
        """Get excluded  columns for table being profiled"""
        if self.exclude_columns:
            return set(self.exclude_columns)
        return {}

    def _get_included_columns(self) -> Optional[Set[str]]:
        """Get include columns for table being profiled"""
        if self.include_columns:
            return {include_col.columnName for include_col in self.include_columns}
        return {}

    def _filter_metrics(self, _type: Type[TMetric]) -> List[Type[TMetric]]:
        """
        Filter metrics by type
        """
        return [metric for metric in self.metrics if issubclass(metric, _type)]

    def _check_profile_and_handle(
        self, profile: CreateTableProfileRequest
    ) -> CreateTableProfileRequest:
        """Check if the profile data are empty. if empty then raise else return

        Args:
            profile (CreateTableProfileRequest): profile data

        Raises:
            Exception: that will be caught in the workflow and add the entity to failure source and processor status

        Returns:
            CreateTableProfileRequest:
        """
        for attrs, val in profile.tableProfile:
            if attrs not in {"timestamp", "profileSample", "profileSampleType"} and val:
                return profile

        for col_element in profile.columnProfile:
            for attrs, val in col_element:
                if attrs not in {"timestamp", "name"} and val:
                    return profile

        raise Exception(
            f"No profile data computed for {self.profiler_interface.table_entity.fullyQualifiedName.__root__}"
        )

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

    @property
    def system_metrics(self) -> List[Type[SystemMetric]]:
        return self._filter_metrics(SystemMetric)

    def get_col_metrics(
        self, metrics: List[Type[TMetric]], column: Optional[Column] = None
    ) -> List[Type[TMetric]]:
        """
        Filter list of metrics for column metrics with allowed types
        """

        if column is None:
            return [metric for metric in metrics if metric.is_col_metric()]

        if (
            self.profiler_interface.table_entity.tableProfilerConfig
            and self.profiler_interface.table_entity.tableProfilerConfig.includeColumns
        ):
            metric_names = next(
                (
                    include_columns.metrics
                    for include_columns in self.profiler_interface.table_entity.tableProfilerConfig.includeColumns
                    if include_columns.columnName == column.name
                ),
                None,
            )

            if metric_names:
                metrics = [
                    Metric.value
                    for Metric in Metrics
                    if Metric.value.name() in metric_names
                ]

        return [metric for metric in metrics if metric.is_col_metric()]

    @property
    def sample(self):
        """Return the sample used for the profiler"""
        return self.profiler_interface.sample

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

            self._column_results[col.name][
                metric.name()
            ] = self.profiler_interface.get_composed_metrics(
                col,
                metric,
                current_col_results,
            )

    def _prepare_table_metrics(self) -> List:
        """prepare table metrics"""
        table_metrics = [
            metric
            for metric in self.static_metrics
            if (not metric.is_col_metric() and not metric.is_system_metrics())
        ]

        if table_metrics:
            return [
                (
                    table_metrics,  # metric functions
                    MetricTypes.Table,  # metric type for function mapping
                    None,  # column name
                    self.table,  # table name
                ),
            ]
        return []

    def _prepare_system_metrics(self) -> List:
        """prepare system metrics"""
        system_metrics = self.system_metrics

        if system_metrics:
            return [
                (
                    system_metric,  # metric functions
                    MetricTypes.System,  # metric type for function mapping
                    None,  # column name
                    self.table,  # table name
                )
                for system_metric in system_metrics
            ]

        return []

    def _prepare_column_metrics(self) -> List:
        """prepare column metrics"""
        columns = [
            column
            for column in self.columns
            if isinstance(column, Column)
            and column.type.__class__ not in NOT_COMPUTE
            or isinstance(column, ColumnBaseModel)
            and column.datatype not in NOT_COMPUTE_OM
        ]

        column_metrics_for_thread_pool = [
            *[
                (
                    self.get_col_metrics(self.static_metrics, column),
                    MetricTypes.Static,
                    column,
                    self.table,
                )
                for column in columns
            ],
            *[
                (
                    metric,
                    MetricTypes.Query,
                    column,
                    self.table,
                )
                for column in self.columns
                for metric in self.get_col_metrics(self.query_metrics, column)
            ],
            *[
                (
                    metric,
                    MetricTypes.Window,
                    column,
                    self.table,
                )
                for column in self.columns
                for metric in [
                    metric
                    for metric in self.get_col_metrics(self.static_metrics, column)
                    if metric.is_window_metric()
                ]
            ],
        ]

        return column_metrics_for_thread_pool

    def profile_entity(self) -> None:
        """Get all the metrics for a given table"""
        table_metrics = self._prepare_table_metrics()
        system_metrics = self._prepare_system_metrics()
        column_metrics = self._prepare_column_metrics()

        all_metrics = [
            *system_metrics,
            *table_metrics,
            *column_metrics,
        ]
        profile_results = self.profiler_interface.get_all_metrics(
            all_metrics,
        )
        self._table_results = profile_results["table"]
        self._column_results = profile_results["columns"]
        self._system_results = profile_results.get("system")

    def compute_metrics(self) -> Profiler:
        """Run the whole profiling using multithreading"""
        self.profile_entity()
        for column in self.columns:
            self.run_composed_metrics(column)

        return self

    def process(self, generate_sample_data: Optional[bool]) -> ProfilerResponse:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}
        """
        logger.info(
            f"Computing profile metrics for {self.profiler_interface.table_entity.fullyQualifiedName.__root__}..."
        )

        self.compute_metrics()
        if generate_sample_data:
            try:
                logger.info(
                    f"Fetching sample data for {self.profiler_interface.table_entity.fullyQualifiedName.__root__}..."
                )
                sample_data = self.profiler_interface.fetch_sample_data(self.table)
                logger.info(
                    "Successfully fetched sample data for "
                    f"{self.profiler_interface.table_entity.fullyQualifiedName.__root__}..."
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error fetching sample data: {err}")
                sample_data = None

        else:
            sample_data = None

        profile = self._check_profile_and_handle(self.get_profile())

        table_profile = ProfilerResponse(
            table=self.profiler_interface.table_entity,
            profile=profile,
            sample_data=sample_data,
        )

        return table_profile

    def get_profile(self) -> CreateTableProfileRequest:
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
            column_profile = [
                ColumnProfile(
                    **self.column_results.get(
                        col.name
                        if not isinstance(col.name, ColumnName)
                        else col.name.__root__
                    )
                )
                for col in self.columns
                if self.column_results.get(
                    col.name
                    if not isinstance(col.name, ColumnName)
                    else col.name.__root__
                )
            ]

            table_profile = TableProfile(
                timestamp=self.profile_date,
                columnCount=self._table_results.get("columnCount"),
                rowCount=self._table_results.get(RowCount.name()),
                profileSample=self.profile_sample_config.profile_sample
                if self.profile_sample_config
                else None,
                profileSampleType=self.profile_sample_config.profile_sample_type
                if self.profile_sample_config
                else None,
            )

            if self._system_results:
                system_profile = [
                    SystemProfile(**system_result)
                    for system_result in self._system_results
                ]
            else:
                system_profile = None

            return CreateTableProfileRequest(
                tableProfile=table_profile,
                columnProfile=column_profile,
                systemProfile=system_profile,
            )

        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Cannot transform profiler results to TableProfile: {err}")
            raise err

    @property
    def column_results(self):
        return self._column_results
