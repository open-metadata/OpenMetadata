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
from typing import Dict, Optional, Union

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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfileSampleConfig, TableConfig
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.partition import get_partition_details


class ProfilerProtocol(ABC):
    """Protocol interface for the profiler processor"""

    _profiler_type: Optional[str] = None
    subclasses = {}

    def __init_subclass__(cls, *args, **kwargs) -> None:
        """Hook to map subclass objects to profiler type"""
        super().__init_subclass__(*args, **kwargs)
        cls.subclasses[cls._profiler_type] = cls

    @classmethod
    def create(
        cls,
        _profiler_type: str,
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
        if _profiler_type not in cls.subclasses:
            raise NotImplementedError(
                f"We could not find the profiler that satisfies the type {_profiler_type}"
            )

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

        return cls.subclasses[_profiler_type](
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            thread_count=thread_count,
            entity=entity,
            source_config=source_config,
            profile_sample_config=profile_sample_config,
            sample_query=sample_query,
            table_partition_config=table_partition_config,
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

    @abstractmethod
    def __init__(
        self,
        ometa_client: OpenMetadata,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
    ):
        """Required attribute for the interface"""
        raise NotImplementedError

    @property
    @abstractmethod
    def table(self):
        """OM Table entity"""
        raise NotImplementedError

    @abstractmethod
    def _get_metrics(self, *args, **kwargs):
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
