#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
from datetime import datetime
from typing import Callable, Dict, List, Optional, Union

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import (
    CustomMetricProfile,
    DataType,
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.profiler_interface import (
    ProfilerInterface,
    ProfilerProcessorStatus,
)
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.metric_filter import MetricFilter
from metadata.profiler.processor.runner import PandasRunner
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.utils.constants import COMPLEX_COLUMN_SEPARATOR
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
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        source_config: DatabaseServiceProfilerPipeline,
        sampler: DatalakeSampler,
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        **kwargs,
    ):
        """Instantiate Pandas Interface object"""

        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            source_config=source_config,
            sampler=sampler,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            **kwargs,
        )

        self.client = self.sampler.client
        dataset = self.sampler.get_dataset()
        dataset = self._type_casted_dataset(dataset)
        self.dataset = PandasRunner(
            dataset=dataset, raw_dataset=self.sampler.raw_dataset
        )
        self.status = ProfilerProcessorStatus()
        self.column_names_cache = {}

    def _get_column_type_mapping(self) -> List[str]:
        """Compute column type mapping

        Returns:
            List[str]: list of column types
        """
        coltype_mapping = []
        data_formats = GenericDataFrameColumnParser._data_formats

        for col in self.table.columns:
            coltype = next(
                (key for key, value in data_formats.items() if col.dataType == value),
                None,
            )
            if coltype and col.dataType not in {DataType.JSON, DataType.ARRAY}:
                coltype_mapping.append(coltype)
            else:
                coltype_mapping.append("object")

        return coltype_mapping

    def _type_casted_dataset(self, original_dataset: Callable) -> Callable:
        """Type cast dataset columns as per the parsed column types

        Args:
            original_dataset (Callable): original dataset

        Returns:
            Callable: type casted dataset
        """
        coltype_mapping = self._get_column_type_mapping()

        def yield_type_casted_dfs():
            for df in original_dataset():
                try:
                    df = self._rename_complex_columns(df)
                    yield df.astype(dict(zip(df.keys(), coltype_mapping)))
                except (TypeError, ValueError) as err:
                    logger.warning(f"NaN/NoneType found in the Dataframe: {err}")
                    yield df

        return yield_type_casted_dfs

    def _rename_complex_columns(self, df):
        """Rename complex columns to match the column names in the table entity

        Args:
            df (pd.DataFrame): dataframe to rename columns

        Returns:
            pd.DataFrame: dataframe with renamed columns
        """
        if not self.column_names_cache:
            for column_name in df.columns:
                new_name = self._get_column_name(column_name)
                if new_name != column_name:
                    self.column_names_cache[column_name] = new_name

        if self.column_names_cache:
            df.rename(columns=self.column_names_cache, inplace=True)
        return df

    def _get_column_name(self, column_name: str) -> str:
        """Get the column name from the cache or compute it

        Args:
            column_name (str): original column name
        Returns:
            str: computed column name
        """
        complex_col_name = None
        if COMPLEX_COLUMN_SEPARATOR in column_name:
            complex_col_name = ".".join(column_name.split(COMPLEX_COLUMN_SEPARATOR)[1:])
        return complex_col_name or column_name

    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner: "PandasRunner",
        *args,
        **kwargs,
    ):
        """Given a list of metrics, compute the given results
        and returns the values. Table metrics are computed on the
        entire dataset omitting the sampling and partitioning

        Args:
            metrics: list of metrics to compute
        Returns:
            dictionnary of results
        """
        try:
            row_dict = {}
            for metric in metrics:
                row_dict[metric.name()] = metric().df_fn(runner)
            return row_dict
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to compute profile for {exc}")
            raise RuntimeError(exc)

    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner: "PandasRunner",
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
        runner: "PandasRunner",
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
        runner: "PandasRunner",
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
        runner: "PandasRunner",
        *args,
        **kwargs,
    ):
        """
        Given a list of metrics, compute the given results
        and returns the values
        """
        return None  # to be implemented

    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner: "PandasRunner", *args, **kwargs
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
                    for df in runner()
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
            if self.dataset is not None:
                row = self._get_metric_fn[metric_func.metric_type.value](
                    metric_func.metrics,
                    self.dataset,
                    column=metric_func.column,
                )

            if metric_func.column is not None:
                column = metric_func.column.name
                self.status.scanned(
                    f"{metric_func.table.name.root}.{column}__{metric_func.metric_type.value}"
                )
            else:
                self.status.scanned(
                    f"{metric_func.table.name.root}__{metric_func.metric_type.value}"
                )
                column = None

            return row, column, metric_func.metric_type.value

        except Exception as exc:
            name = f"{metric_func.column if metric_func.column is not None else metric_func.table}"
            error = f"{name} metric_type.value: {exc}"
            logger.error(error)
            self.status.failed_profiler(error, traceback.format_exc())
            return None, None, None

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

    def get_hybrid_metrics(self, column: Column, metric: Metrics, column_results: Dict):
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
            return metric(column).df_fn(column_results, self.dataset)
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
        if self.dataset is not None:
            first_df = next(self.dataset(), None)
            if first_df is None:
                return []

            for column_name in first_df.columns:
                sqalike_columns.append(
                    SQALikeColumn(
                        column_name,
                        GenericDataFrameColumnParser.fetch_col_types(
                            first_df, self._get_column_name(column_name)
                        ),
                    )
                )
            return sqalike_columns
        return []

    def close(self):
        """Nothing to close with pandas"""
