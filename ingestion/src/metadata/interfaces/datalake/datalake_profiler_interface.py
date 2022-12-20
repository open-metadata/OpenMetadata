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
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.source.database.datalake import ometa_to_dataframe
from metadata.interfaces.profiler_protocol import (
    ProfilerInterfaceArgs,
    ProfilerProtocol,
)
from metadata.orm_profiler.metrics.core import MetricTypes
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.datalake_sampler import DatalakeSampler
from metadata.utils.column_base_model import ColumnBaseModel
from metadata.utils.connections import get_connection
from metadata.utils.dispatch import valuedispatch
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class DataLakeProfilerInterface(ProfilerProtocol):
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
        self.client = get_connection(self.service_connection_config).client
        self.processor_status = ProfilerProcessorStatus()
        self.processor_status.entity = (
            self.table_entity.fullyQualifiedName.__root__
            if self.table_entity.fullyQualifiedName
            else None
        )

        self.profile_sample_config = profiler_interface_args.profile_sample_config
        self.profile_query = profiler_interface_args.table_sample_query
        self.partition_details = None
        self._table = profiler_interface_args.table_entity
        self.data_frame_list = ometa_to_dataframe(
            config_source=self.service_connection_config.configSource,
            client=self.client,
            table=self.table,
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
        data_frame_list,
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
                for data_frame in data_frame_list:
                    row.append(
                        metric().dl_fn(
                            data_frame.astype(object).where(
                                pd.notnull(data_frame), None
                            )
                        )
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
        data_frame_list,
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
                for data_frame in data_frame_list:
                    row.append(
                        metric(column).dl_fn(
                            data_frame.astype(object).where(
                                pd.notnull(data_frame), None
                            )
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
        data_frame_list,
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
        for data_frame in data_frame_list:
            col_metric = metrics(column).dl_query(data_frame)
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
                data_frame_list=self.data_frame_list,
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
            table=self.data_frame_list,
            profile_sample=self.profile_sample_config,
            partition_details=self.partition_details,
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
        return ColumnBaseModel.col_base_model_list(self.data_frame_list)

    def close(self):
        pass
