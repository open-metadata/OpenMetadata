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
from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import (
    CustomMetricProfile,
    DataType,
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.metric_filter import MetricFilter
from metadata.utils.constants import COMPLEX_COLUMN_SEPARATOR, SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_interface_registry_logger()


class PandasProfilerInterface(ProfilerInterface, PandasInterfaceMixin):
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
        storage_config,
        profile_sample_config,
        source_config,
        sample_query,
        table_partition_config,
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        sample_data_count: int = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        """Instantiate Pandas Interface object"""

        super().__init__(
            service_connection_config,
            ometa_client,
            entity,
            storage_config,
            profile_sample_config,
            source_config,
            sample_query,
            table_partition_config,
            thread_count,
            timeout_seconds,
            sample_data_count,
            **kwargs,
        )

        self.client = self.connection.client
        self.dfs = self.return_ometa_dataframes_sampled(
            service_connection_config=self.service_connection_config,
            client=self.client._client,
            table=self.table_entity,
            profile_sample_config=profile_sample_config,
        )
        self.sampler = self._get_sampler()
        self.complex_dataframe_sample = deepcopy(
            self.sampler.random_sample(is_sampled=True)
        )
        self.complex_df()

    def complex_df(self):
        """Assign DataTypes to dataframe columns as per the parsed column type"""
        coltype_mapping_df = []
        data_formats = (
            GenericDataFrameColumnParser._data_formats  # pylint: disable=protected-access
        )
        for index, df in enumerate(self.complex_dataframe_sample):
            if index == 0:
                for col in self.table.columns:
                    coltype = next(
                        (
                            key
                            for key, value in data_formats.items()
                            if col.dataType == value
                        ),
                        None,
                    )
                    if coltype and col.dataType not in {DataType.JSON, DataType.ARRAY}:
                        coltype_mapping_df.append(coltype)
                    else:
                        coltype_mapping_df.append("object")

            try:
                self.complex_dataframe_sample[index] = df.astype(
                    dict(zip(df.keys(), coltype_mapping_df))
                )
            except (TypeError, ValueError) as err:
                self.complex_dataframe_sample[index] = df
                logger.warning(f"NaN/NoneType found in the Dataframe: {err}")
                break

    def _get_sampler(self):
        """Get dataframe sampler from config"""
        from metadata.profiler.processor.sampler.sampler_factory import (  # pylint: disable=import-outside-toplevel
            sampler_factory_,
        )

        return sampler_factory_.create(
            DatalakeConnection.__name__,
            client=self.client._client,  # pylint: disable=W0212
            table=self.dfs,
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )

    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner: List,
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
        import pandas as pd  # pylint: disable=import-outside-toplevel

        try:
            row_dict = {}
            df_list = [df.where(pd.notnull(df), None) for df in runner]
            for metric in metrics:
                row_dict[metric.name()] = metric().df_fn(df_list)
            return row_dict
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to compute profile for {exc}")
            raise RuntimeError(exc)

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: List,
        column,
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
        import pandas as pd  # pylint: disable=import-outside-toplevel

        row_dict = {}
        try:
            for metric in metrics:
                metric_resp = metric(column).df_fn(runner)
                row_dict[metric.name()] = (
                    None if pd.isnull(metric_resp) else metric_resp
                )
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\nError trying to compute profile for {exc}"
            )
            raise RuntimeError(exc)
        return row_dict

    def _compute_query_metrics(
        self,
        metric: Metrics,
        runner: List,
        column,
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
        col_metric = None
        col_metric = metric(column).df_fn(runner)
        if not col_metric:
            return None
        return {metric.name(): col_metric}

    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner: List,
        column,
        *args,
        **kwargs,
    ):
        """
        Given a list of metrics, compute the given results
        and returns the values
        """

        try:
            metric_values = {}
            for metric in metrics:
                metric_values[metric.name()] = metric(column).df_fn(runner)
            return metric_values if metric_values else None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            return None

    def _compute_system_metrics(
        self,
        metrics: Metrics,
        runner: List,
        *args,
        **kwargs,
    ):
        """
        Given a list of metrics, compute the given results
        and returns the values
        """
        return None  # to be implemented

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, *args, **kwargs
    ):
        """Compute custom metrics. For pandas source we expect expression
        to be a boolean value. We'll return the length of the dataframe

        Args:
            metrics (List[Metrics]): list of customMetrics
            runner (_type_): runner
        """
        if not metrics:
            return None

        custom_metrics = []

        for metric in metrics:
            try:
                row = sum(
                    len(df.query(metric.expression).index)
                    for df in runner
                    if len(df.query(metric.expression).index)
                )
                custom_metrics.append(
                    CustomMetricProfile(name=metric.name.root, value=row)
                )

            except Exception as exc:
                msg = f"Error trying to compute profile for custom metric: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(msg)
        if custom_metrics:
            return {"customMetrics": custom_metrics}
        return None

    def compute_metrics(
        self,
        metric_func: ThreadPoolMetrics,
    ):
        """Run metrics in processor worker"""
        logger.debug(f"Running profiler for {metric_func.table.name.root}")
        try:
            row = None
            if self.complex_dataframe_sample:
                row = self._get_metric_fn[metric_func.metric_type.value](
                    metric_func.metrics,
                    self.complex_dataframe_sample,
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
            self.status.scanned(f"{metric_func.table.name.root}.{column}")
        else:
            self.status.scanned(metric_func.table.name.root)
            column = None
        return row, column, metric_func.metric_type.value

    def fetch_sample_data(self, table, columns: SQALikeColumn) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = self._get_sampler()
        return sampler.fetch_sample_data(columns)

    def get_composed_metrics(
        self, column: Column, metric: Metrics, column_results: Dict
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metric: list of metrics to compute
            column_results: computed values for the column
        Returns:
            dictionary of results
        """
        try:
            return metric(column).fn(column_results)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            return None

    def get_hybrid_metrics(
        self, column: Column, metric: Metrics, column_results: Dict, **kwargs
    ):
        """Given a list of metrics, compute the given results
        and returns the values

        Args:
            column: the column to compute the metrics against
            metric: list of metrics to compute
            column_results: computed values for the column
        Returns:
            dictionary of results
        """
        try:
            return metric(column).df_fn(column_results, self.complex_dataframe_sample)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            return None

    def get_all_metrics(
        self,
        metric_funcs: List[ThreadPoolMetrics],
    ):
        """get all profiler metrics"""

        profile_results = {"table": {}, "columns": defaultdict(dict)}
        metric_list = [
            self.compute_metrics(metric_func)
            for metric_func in MetricFilter.filter_empty_metrics(metric_funcs)
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
                    if profile:
                        profile_results["columns"][column].update(
                            {
                                "name": column,
                                "timestamp": int(datetime.now().timestamp() * 1000),
                                **profile,
                            }
                        )
        return profile_results

    @property
    def table(self):
        """OM Table entity"""
        return self.table_entity

    def get_columns(self) -> List[Optional[SQALikeColumn]]:
        """Get SQALikeColumns for datalake to be passed for metric computation"""
        sqalike_columns = []
        if self.complex_dataframe_sample:
            for column_name in self.complex_dataframe_sample[0].columns:
                complex_col_name = None
                if COMPLEX_COLUMN_SEPARATOR in column_name:
                    complex_col_name = ".".join(
                        column_name.split(COMPLEX_COLUMN_SEPARATOR)[1:]
                    )
                    if complex_col_name:
                        for df in self.complex_dataframe_sample:
                            df.rename(
                                columns={column_name: complex_col_name}, inplace=True
                            )
                column_name = complex_col_name or column_name
                sqalike_columns.append(
                    SQALikeColumn(
                        column_name,
                        GenericDataFrameColumnParser.fetch_col_types(
                            self.complex_dataframe_sample[0], column_name
                        ),
                    )
                )
            return sqalike_columns
        return []

    def close(self):
        """Nothing to close with pandas"""
