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

from metadata.generated.schema.entity.data.table import DataType, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.datalake.metadata import (
    DATALAKE_DATA_TYPES,
    ometa_to_dataframe,
)
from metadata.interfaces.datalake.mixins.pandas_mixin import PandasInterfaceMixin
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.profiler.datalake_sampler import DatalakeSampler
from metadata.profiler.profiler.interface.profiler_protocol import ProfilerProtocol
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_like_column import SQALikeColumn, Type

logger = profiler_interface_registry_logger()


class PandasProfilerInterface(ProfilerProtocol, PandasInterfaceMixin):
    """
    Interface to interact with registry supporting
    sqlalchemy.
    """

    _profiler_type: str = DatalakeConnection.__name__

    def __init__(
        self,
        service_connection_config,
        ometa_client,
        thread_count,
        entity,
        profile_sample_config,
        sample_query,
        table_partition_config=None,
        **kwargs,
    ):
        """Instantiate SQA Interface object"""
        self._thread_count = thread_count
        self.table_entity = entity
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config
        self.client = get_connection(self.service_connection_config).client
        self.processor_status = ProfilerProcessorStatus()
        self.processor_status.entity = (
            self.table_entity.fullyQualifiedName.__root__
            if self.table_entity.fullyQualifiedName
            else None
        )  # type: ignore

        self.profile_sample_config = profile_sample_config
        self.profile_query = sample_query
        self.table_partition_config = table_partition_config
        self._table = entity
        self.dfs = ometa_to_dataframe(
            config_source=self.service_connection_config.configSource,
            client=self.client,
            table=self.table,
        )
        if self.dfs and self.table_partition_config:
            self.dfs = [self.get_partitioned_df(df) for df in self.dfs]

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
        dfs: List,
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
            row = []
            for metric in metrics:
                for df in dfs:
                    row.append(
                        metric().df_fn(df.astype(object).where(pd.notnull(df), None))
                    )
            if row:
                if isinstance(row, list):
                    row_dict = {}
                    for index, table_metric in enumerate(metrics):
                        row_dict[table_metric.name()] = row[index]
                    return row_dict
                return dict(row)
            return None

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
        column,
        dfs,
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
            row = []
            for metric in metrics:
                for df in dfs:
                    row.append(
                        metric(column).df_fn(
                            df.astype(object).where(pd.notnull(df), None)
                        )
                    )
            row_dict = {}
            for index, column_metric in enumerate(metrics):
                row_dict[column_metric.name()] = row[index]
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
        column,
        dfs,
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
        for df in dfs:
            col_metric = metrics(column).df_fn(df)
        if not col_metric:
            return None
        return {metrics.name(): col_metric}

    # pylint: disable=unused-argument
    @_get_metrics.register(MetricTypes.Window.value)
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
        try:
            row = self._get_metrics(
                metric_type.value,
                metrics,
                session=self.client,
                dfs=self.dfs,
                column=column,
            )
        except Exception as exc:
            logger.error(exc)
            self.processor_status.failure(
                f"{column if column is not None else table}",
                "metric_type.value",
                f"{exc}",
            )
            row = None
        if column:
            column = column.name
        return row, column, metric_type.value

    def fetch_sample_data(self, table) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = DatalakeSampler(
            session=self.client,
            table=self.dfs,
            profile_sample_config=self.profile_sample_config,
            profile_sample_query=self.profile_query,
        )
        return sampler.fetch_dl_sample_data()

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
                    Type(
                        DATALAKE_DATA_TYPES.get(
                            df[column_name].dtypes.name, DataType.STRING.value
                        )
                    ),
                )
                for column_name in df.columns
            ]
        return []

    def close(self):
        """Nothing to close with pandas"""
        pass
