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
from typing import Any, Dict, Generic, List, Optional, Set, Tuple, Type, cast

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
    TableData,
    TableProfile,
)
from metadata.generated.schema.tests.customMetric import (
    CustomMetric as CustomMetricEntity,
)
from metadata.profiler.api.models import ProfilerResponse, ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import (
    ComposedMetric,
    CustomMetric,
    HybridMetric,
    MetricTypes,
    QueryMetric,
    StaticMetric,
    SystemMetric,
    TMetric,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.profiler.orm.registry import NOT_COMPUTE
from metadata.profiler.processor.sample_data_handler import upload_sample_data
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
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
        profiler_interface: ProfilerInterface,
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
        self._profile_date = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
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
                return

        for col_element in profile.columnProfile:
            for attrs, val in col_element:
                if attrs not in {"timestamp", "name"} and val is not None:
                    return

        raise RuntimeError(
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

    @property
    def hybrid_metric(self) -> List[Type[HybridMetric]]:
        return self._filter_metrics(HybridMetric)

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
        ) or (self.include_columns):
            # include_columns is set from the `tableConfig` of the `ProfilerProcessorConfig` in the CLI config
            # while `self.profiler_interface.table_entity.tableProfilerConfig.includeColumns` is set from the entity
            # definition in the metadata service. This gets set either from the UI or the profiler entity page. Config
            # ran from the CLI takes precedence over the entity definition.
            columns = (
                self.include_columns
                if self.include_columns
                else self.profiler_interface.table_entity.tableProfilerConfig.includeColumns
            )
            columns = cast(List[ColumnProfilerConfig], columns)
            metric_names = next(
                (
                    include_columns.metrics
                    for include_columns in columns
                    if include_columns.columnName == column.name
                ),
                None,
            )

            if metric_names:
                metric_names = {
                    mtrc.lower() for mtrc in metric_names
                }  # case insensitice
                metrics = [
                    Metric.value
                    for Metric in Metrics
                    if Metric.value.name().lower() in metric_names
                    and Metric.value in metrics
                ]

        return [metric for metric in metrics if metric.is_col_metric()]

    def get_custom_metrics(
        self, column_name: Optional[str] = None
    ) -> Optional[List[CustomMetricEntity]]:
        """Get custom metrics for a table or column

        Args:
            column (Optional[str]): optional column name. If None will fetch table level custom metrics

        Returns:
            List[str]
        """
        if column_name is None:
            return self.profiler_interface.table_entity.customMetrics or None

        # if we have a column we'll get the custom metrics for this column
        column = next(
            (
                clmn
                for clmn in self.profiler_interface.table_entity.columns
                if clmn.name.__root__ == column_name
            ),
            None,
        )
        if column:
            return column.customMetrics or None
        return None

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
            logger.debug(
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

    def run_hybrid_metrics(self, col: Column):
        """Run hybrid metrics

        Args:
            col (Column): column to run distribution metrics on
        """
        logger.debug("Running distribution metrics...")
        current_col_results: Dict[str, Any] = self._column_results.get(col.name)
        if not current_col_results:
            logger.debug(
                "We do not have any results to base our Hybrid Metrics. Stopping!"
            )
            return
        for metric in self.get_col_metrics(self.hybrid_metric, col):
            logger.debug(f"Running hybrid metric {metric.name()} for {col.name}")
            self._column_results[col.name][
                metric.name()
            ] = self.profiler_interface.get_hybrid_metrics(
                col,
                metric,
                current_col_results,
                table=self.table,
            )

    def _prepare_table_metrics(self) -> List:
        """prepare table metrics"""
        metrics = []
        table_metrics = [
            metric
            for metric in self.static_metrics
            if (not metric.is_col_metric() and not metric.is_system_metrics())
        ]

        custom_table_metrics = self.get_custom_metrics()

        if table_metrics:
            metrics.extend(
                [
                    ThreadPoolMetrics(
                        metrics=table_metrics,
                        metric_type=MetricTypes.Table,
                        column=None,
                        table=self.table,
                    )
                ]
            )

        if custom_table_metrics:
            metrics.extend(
                [
                    ThreadPoolMetrics(
                        metrics=custom_table_metrics,
                        metric_type=MetricTypes.Custom,
                        column=None,
                        table=self.table,
                    )
                ]
            )

        return metrics

    def _prepare_system_metrics(self) -> List:
        """prepare system metrics"""
        system_metrics = self.system_metrics

        if system_metrics:
            return [
                ThreadPoolMetrics(
                    metrics=system_metric,  # metric functions
                    metric_type=MetricTypes.System,  # metric type for function mapping
                    column=None,  # column name
                    table=self.table,  # table name
                )
                for system_metric in system_metrics
            ]

        return []

    def _prepare_column_metrics(self) -> List:
        """prepare column metrics"""
        columns = [
            column
            for column in self.columns
            if column.type.__class__.__name__ not in NOT_COMPUTE
        ]
        column_metrics_for_thread_pool = []
        static_metrics = [
            ThreadPoolMetrics(
                metrics=[
                    metric
                    for metric in self.get_col_metrics(self.static_metrics, column)
                    if not metric.is_window_metric()
                ],
                metric_type=MetricTypes.Static,
                column=column,
                table=self.table,
            )
            for column in columns
        ]
        query_metrics = [
            ThreadPoolMetrics(
                metrics=metric,
                metric_type=MetricTypes.Query,
                column=column,
                table=self.table,
            )
            for column in columns
            for metric in self.get_col_metrics(self.query_metrics, column)
        ]
        window_metrics = [
            ThreadPoolMetrics(
                metrics=[
                    metric
                    for metric in self.get_col_metrics(self.static_metrics, column)
                    if metric.is_window_metric()
                ],
                metric_type=MetricTypes.Window,
                column=column,
                table=self.table,
            )
            for column in columns
        ]

        # we'll add the system metrics to the thread pool computation
        for metric_type in [static_metrics, query_metrics, window_metrics]:
            column_metrics_for_thread_pool.extend(metric_type)

        # we'll add the custom metrics to the thread pool computation
        for column in columns:
            custom_metrics = self.get_custom_metrics(column.name)
            if custom_metrics:
                column_metrics_for_thread_pool.append(
                    ThreadPoolMetrics(
                        metrics=custom_metrics,
                        metric_type=MetricTypes.Custom,
                        column=column,
                        table=self.table,
                    )
                )

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
            self.run_hybrid_metrics(column)

        return self

    def process(
        self,
        generate_sample_data: Optional[bool],
    ) -> ProfilerResponse:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}
        """
        logger.debug(
            f"Computing profile metrics for {self.profiler_interface.table_entity.fullyQualifiedName.__root__}..."
        )

        self.compute_metrics()
        if generate_sample_data:
            sample_data = self.generate_sample_data()
        else:
            sample_data = None

        profile = self.get_profile()
        self._check_profile_and_handle(profile)

        table_profile = ProfilerResponse(
            table=self.profiler_interface.table_entity,
            profile=profile,
            sample_data=sample_data,
        )

        return table_profile

    def generate_sample_data(self) -> Optional[TableData]:
        """Fetch and ingest sample data

        Returns:
            TableData: sample data
        """
        try:
            logger.debug(
                "Fetching sample data for "
                f"{self.profiler_interface.table_entity.fullyQualifiedName.__root__}..."  # type: ignore
            )
            table_data = self.profiler_interface.fetch_sample_data(
                self.table, self.columns
            )
            upload_sample_data(
                data=table_data, profiler_interface=self.profiler_interface
            )
            table_data.rows = table_data.rows[
                : min(
                    SAMPLE_DATA_DEFAULT_COUNT, self.profiler_interface.sample_data_count
                )
            ]
            return table_data
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching sample data: {err}")
            return None

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
                createDateTime=self._table_results.get("createDateTime"),
                sizeInByte=self._table_results.get("sizeInBytes"),
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

    def close(self):
        """clean up profiler after processing"""
        self.profiler_interface.close()
