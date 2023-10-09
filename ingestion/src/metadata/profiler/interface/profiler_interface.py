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

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union

from sqlalchemy import Column
from typing_extensions import Self

from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.api.models import ProfileSampleConfig, TableConfig
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.partition import get_partition_details


class ProfilerProcessorStatus(Status):
    """Keep track of the entity being processed"""

    entity: Optional[str] = None

    def scanned(self, record: Any) -> None:
        self.records.append(record)

    def failed_profiler(self, error: str, stack_trace: Optional[str] = None) -> None:
        self.failed(
            StackTraceError(
                name=self.entity if self.entity else "",
                error=error,
                stack_trace=stack_trace,
            )
        )


class ProfilerInterface(ABC):
    """Protocol interface for the profiler processor"""

    # pylint: disable=too-many-arguments,unused-argument
    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        profile_sample_config: Optional[ProfileSampleConfig],
        source_config: DatabaseServiceProfilerPipeline,
        sample_query: Optional[str],
        table_partition_config: Optional[PartitionProfilerConfig],
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        **kwargs,
    ):
        """Required attribute for the interface"""
        self._thread_count = thread_count
        self.table_entity = entity
        self.ometa_client = ometa_client
        self.source_config = source_config
        self.service_connection_config = service_connection_config
        self.connection = get_connection(self.service_connection_config)
        self.status = ProfilerProcessorStatus()
        try:
            fqn = self.table_entity.fullyQualifiedName
        except AttributeError:
            self.status.entity = None
        else:
            self.status.entity = fqn.__root__ if fqn else None
        self.profile_sample_config = profile_sample_config
        self.profile_query = sample_query
        self.partition_details = (
            table_partition_config if not self.profile_query else None
        )
        self.timeout_seconds = timeout_seconds

        self._get_metric_fn = {
            MetricTypes.Table.value: self._compute_table_metrics,
            MetricTypes.Static.value: self._compute_static_metrics,
            MetricTypes.Query.value: self._compute_query_metrics,
            MetricTypes.Window.value: self._compute_window_metrics,
            MetricTypes.System.value: self._compute_system_metrics,
        }

    @abstractmethod
    def _get_sampler(self):
        """Get the sampler"""
        raise NotImplementedError

    @classmethod
    def create(
        cls,
        entity: Table,
        entity_config: Optional[TableConfig],
        source_config: DatabaseServiceProfilerPipeline,
        service_connection_config,
        ometa_client: Optional[OpenMetadata],
        **kwargs,
    ) -> Self:
        """create class method is used to dispatch the profiler protocol to the
        correct object based on the service connection object

        Args:
            _profiler_type (str): service connection object str
            entity (Table): entity
            entity_config (Optional[TableConfig]): entity config object
            source_config (DatabaseServiceProfilerPipeline): source config object
            service_connection_config (_type_): connection for the service
            ometa_client (Optional[OpenMetadata]): ometa client object

        Raises:
            NotImplementedError: if the profiler type is not supported

        Returns:

        """
        thread_count = source_config.threadCount
        timeout_seconds = source_config.timeoutSeconds

        if not cls.get_profile_query(entity, entity_config):
            profile_sample_config = cls.get_profile_sample_config(
                entity, entity_config, source_config
            )
            table_partition_config = cls.get_partition_details(entity, entity_config)
            sample_query = None
        else:
            sample_query = cls.get_profile_query(entity, entity_config)
            profile_sample_config = None
            table_partition_config = None

        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            profile_sample_config=profile_sample_config,
            source_config=source_config,
            sample_query=sample_query,
            table_partition_config=table_partition_config,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            **kwargs,
        )

    @staticmethod
    def get_profile_sample_config(
        entity: Table,
        entity_config: Optional[TableConfig],
        source_config: DatabaseServiceProfilerPipeline,
    ) -> Optional[ProfileSampleConfig]:
        """_summary_
        Args:
            entity (Table): table entity object
            entity_config (Optional[TableConfig]): table config object from yaml/json file
        Returns:
            Optional[dict]: dict
        """
        if entity_config:
            return ProfileSampleConfig(
                profile_sample=entity_config.profileSample,
                profile_sample_type=entity_config.profileSampleType,
            )

        try:
            profile_sample = entity.tableProfilerConfig.profileSample
        except AttributeError:
            pass
        else:
            if profile_sample:
                return ProfileSampleConfig(
                    profile_sample=entity.tableProfilerConfig.profileSample,
                    profile_sample_type=entity.tableProfilerConfig.profileSampleType,
                )

        if source_config.profileSample:
            return ProfileSampleConfig(
                profile_sample=source_config.profileSample,
                profile_sample_type=source_config.profileSampleType,
            )

        return None

    @staticmethod
    def get_profile_query(
        entity: Table, entity_config: Optional[TableConfig]
    ) -> Optional[str]:
        """get profile query for sampling

        Args:
            entity (Table): table entity object
            entity_config (Optional[TableConfig]): entity configuration

        Returns:
            Optional[str]:
        """
        if entity_config:
            return entity_config.profileQuery

        if entity.tableProfilerConfig:
            return entity.tableProfilerConfig.profileQuery

        return None

    @staticmethod
    def get_partition_details(
        entity: Table,
        entity_config: Optional[TableConfig] = None,
    ) -> Optional[PartitionProfilerConfig]:
        """_summary_

        Args:
            entity (Table): table entity object
            entity_config (Optional[TableConfig]): entity configuration

        Returns:
            Optional[PartitionProfilerConfig]:
        """
        if entity_config:
            return entity_config.partitionConfig

        return get_partition_details(entity)

    @property
    @abstractmethod
    def table(self):
        """OM Table entity"""
        raise NotImplementedError

    @abstractmethod
    def _compute_table_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ):
        """Get metrics"""
        raise NotImplementedError

    @abstractmethod
    def _compute_static_metrics(
        self,
        metrics: List[Metrics],
        runner,
        *args,
        **kwargs,
    ):
        """Get metrics"""
        raise NotImplementedError

    @abstractmethod
    def _compute_query_metrics(
        self,
        metric: Metrics,
        runner,
        *args,
        **kwargs,
    ):
        """Get metrics"""
        raise NotImplementedError

    @abstractmethod
    def _compute_window_metrics(
        self,
        metrics: List[Metrics],
        runner: QueryRunner,
        *args,
        **kwargs,
    ):
        """Get metrics"""
        raise NotImplementedError

    @abstractmethod
    def _compute_system_metrics(
        self,
        metrics: Metrics,
        runner,
        *args,
        **kwargs,
    ):
        """Get metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_all_metrics(self, metric_funcs) -> dict:
        """run profiler metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_composed_metrics(
        self, column: Column, metric: Metrics, column_results: Dict
    ) -> dict:
        """run profiler metrics"""
        raise NotImplementedError

    @abstractmethod
    def get_hybrid_metrics(
        self, column: Column, metric: Metrics, column_results: Dict, **kwargs
    ) -> dict:
        """run profiler metrics"""
        raise NotImplementedError

    @abstractmethod
    def fetch_sample_data(self, table) -> TableData:
        """run profiler metrics"""
        raise NotImplementedError

    @abstractmethod
    def close(self):
        """Clean up profiler interface"""
        raise NotImplementedError
