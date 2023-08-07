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
import traceback
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.profiler.interface.profiler_interface import ProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.sampler.sampler_factory import sampler_factory_
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.utils.datalake.datalake_utils import fetch_dataframe
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn, Type

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
        profile_sample_config,
        source_config,
        sample_query,
        table_partition_config,
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        **kwargs,
    ):
        """Instantiate Pandas Interface object"""

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
        )

        self.client = self.connection.client
        self._table = self.table_entity
        self.dfs = self._convert_table_to_list_of_dataframe_objects()

    def _convert_table_to_list_of_dataframe_objects(self):
        """From a table entity, return the corresponding dataframe object

        Returns:
            List[DataFrame]
        """
        data = fetch_dataframe(
            config_source=self.service_connection_config.configSource,
            client=self.client,
            file_fqn=DatalakeTableSchemaWrapper(
                key=self.table_entity.name.__root__,
                bucket_name=self.table_entity.databaseSchema.name,
            ),
            is_profiler=True,
        )

        if not data:
            raise TypeError(f"Couldn't fetch {self.table_entity.name.__root__}")
        return data

    def _get_sampler(self):
        """Get dataframe sampler from config"""
        return sampler_factory_.create(
            DatalakeConnection.__name__,
            client=self.client,
            table=self.dfs,
            profile_sample_config=self.profile_sample_config,
            partition_details=self.partition_details,
            profile_sample_query=self.profile_query,
        )

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
        dfs,
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
            df_list = [df.where(pd.notnull(df), None) for df in dfs]
            for metric in metrics:
                row_dict[metric.name()] = metric().df_fn(df_list)
            return row_dict
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error trying to compute profile for {exc}")
            raise RuntimeError(exc)

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Static.value)
    def _(
        self,
        metric_type: str,
        metrics: List[Metrics],
        dfs,
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

        try:
            row_dict = {}
            for metric in metrics:
                metric_resp = metric(column).df_fn(dfs)
                row_dict[metric.name()] = (
                    None if pd.isnull(metric_resp) else metric_resp
                )
            return row_dict
        except Exception as exc:
            logger.debug(
                f"{traceback.format_exc()}\nError trying to compute profile for {exc}"
            )
            raise RuntimeError(exc)

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Query.value)
    def _(
        self,
        metric_type: str,
        metrics: Metrics,
        dfs,
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
        col_metric = metrics(column).df_fn(dfs)
        if not col_metric:
            return None
        return {metrics.name(): col_metric}

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Window.value)
    def _(
        self,
        metric_type: str,
        metrics: Metrics,
        dfs,
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
                metric_values[metric.name()] = metric(column).df_fn(dfs)
            return metric_values if metric_values else None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            return None

    @_get_metrics.register(MetricTypes.System.value)
    def _(
        self,
        *args,
        **kwargs,
    ):
        """
        Given a list of metrics, compute the given results
        and returns the values
        """
        return None  # to be implemented

    def compute_metrics(
        self,
        metrics,
        metric_type,
        column,
        table,
    ):
        """Run metrics in processor worker"""
        logger.debug(f"Running profiler for {table}")
        sampler = self._get_sampler()
        dfs = sampler.random_sample()
        try:
            row = None
            if self.dfs:
                row = self._get_metrics(
                    metric_type.value,
                    metrics,
                    dfs,
                    session=self.client,
                    column=column,
                )
        except Exception as exc:
            name = f"{column if column is not None else table}"
            error = f"{name} metric_type.value: {exc}"
            logger.error(error)
            self.processor_status.failed_profiler(error, traceback.format_exc())
            row = None
        if column is not None:
            column = column.name
            self.processor_status.scanned(f"{table.name.__root__}.{column}")
        else:
            self.processor_status.scanned(table.name.__root__)
        return row, column, metric_type.value

    def fetch_sample_data(self, table) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = self._get_sampler()
        return sampler.fetch_sample_data()

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
            return metric(column).df_fn(column_results, self.dfs)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception computing metrics: {exc}")
            return None

    def get_all_metrics(
        self,
        metric_funcs: list,
    ):
        """get all profiler metrics"""

        profile_results = {"table": {}, "columns": defaultdict(dict)}
        metric_list = [
            self.compute_metrics(*metric_func) for metric_func in metric_funcs
        ]
        for metric_result in metric_list:
            profile, column, metric_type = metric_result
            if profile:
                if metric_type == MetricTypes.Table.value:
                    profile_results["table"].update(profile)
                if metric_type == MetricTypes.System.value:
                    profile_results["system"] = profile
                else:
                    if profile:
                        profile_results["columns"][column].update(
                            {
                                "name": column,
                                "timestamp": datetime.now(tz=timezone.utc).timestamp(),
                                **profile,
                            }
                        )
        return profile_results

    @property
    def table(self):
        """OM Table entity"""
        return self._table

    def get_columns(self):
        if self.dfs:
            df = self.dfs[0]
            return [
                SQALikeColumn(
                    column_name,
                    Type(DatalakeSource.fetch_col_types(df, column_name)),
                )
                for column_name in df.columns
            ]
        return []

    def close(self):
        """Nothing to close with pandas"""
