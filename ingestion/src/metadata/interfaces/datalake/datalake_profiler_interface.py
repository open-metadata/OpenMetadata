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
from typing import Dict, Union

from pydantic import BaseModel
from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import DataType, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    GCSConfig,
    S3Config,
)
from metadata.ingestion.api.processor import ProfilerProcessorStatus
from metadata.ingestion.source.database.datalake import DatalakeSource
from metadata.interfaces.profiler_protocol import (
    ProfilerInterfaceArgs,
    ProfilerProtocol,
)
from metadata.orm_profiler.metrics.datalake_metrics_computation_registry import (
    compute_metrics_registry,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.datalake_sampler import DatalakeSampler
from metadata.utils.connections import get_connection
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

        self.profile_sample = profiler_interface_args.table_sample_precentage
        self.profile_query = profiler_interface_args.table_sample_query
        self.partition_details = None
        self._table = profiler_interface_args.table_entity
        self.data_frame_list = self.ometa_to_dataframe(
            self.service_connection_config.configSource
        )

    def ometa_to_dataframe(self, config_source):
        if isinstance(config_source, GCSConfig):
            return DatalakeSource.get_gcs_files(
                client=self.client,
                key=self.table.name.__root__,
                bucket_name=self.table.databaseSchema.name,
            )
        if isinstance(config_source, S3Config):
            return DatalakeSource.get_s3_files(
                client=self.client,
                key=self.table.name.__root__,
                bucket_name=self.table.databaseSchema.name,
            )
        return None

    def compute_metrics(
        self,
        metric_funcs,
    ):
        """Run metrics in processor worker"""
        (
            metrics,
            metric_type,
            column,
            table,
        ) = metric_funcs
        logger.debug(f"Running profiler for {table}")
        try:

            row = compute_metrics_registry.registry[metric_type.value](
                metrics,
                session=self.client,
                data_frame_list=self.data_frame_list,
                column=column,
                processor_status=self.processor_status,
            )
        except Exception as err:
            logger.error(err)
            row = None
        if column:
            column = column.name
        return row, column

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
            profile_sample=self.profile_sample,
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
            self.compute_metrics(metric_funcs=metric_func)
            for metric_func in metric_funcs
        ]
        for metric_result in metric_list:
            profile, column = metric_result

            if not column:
                profile_results["table"].update(profile)
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
        return [
            ColumnBaseModel(
                name=column, datatype=self.data_frame_list[0][column].dtype.name
            )
            for column in self.data_frame_list[0].columns
        ]

    def close(self):
        pass


class ColumnBaseModel(BaseModel):
    name: str
    datatype: Union[DataType, str]
