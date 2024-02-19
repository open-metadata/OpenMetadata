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

from metadata.generated.schema.entity.data.database import (
    Database,
    DatabaseProfilerConfig,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema,
    DatabaseSchemaProfilerConfig,
)
from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    SampleDataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.profiler.api.models import (
    DatabaseAndSchemaConfig,
    ProfilerProcessorConfig,
    ProfileSampleConfig,
    TableConfig,
)
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
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
                stackTrace=stack_trace,
            )
        )


# pylint: disable=too-many-instance-attributes
class ProfilerInterface(ABC):
    """Protocol interface for the profiler processor"""

    # pylint: disable=too-many-arguments,unused-argument
    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        storage_config: SampleDataStorageConfig,
        profile_sample_config: Optional[ProfileSampleConfig],
        source_config: DatabaseServiceProfilerPipeline,
        sample_query: Optional[str],
        table_partition_config: Optional[PartitionProfilerConfig],
        thread_count: int = 5,
        timeout_seconds: int = 43200,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        """Required attribute for the interface"""
        self._thread_count = thread_count
        self.table_entity = entity
        self.storage_config = storage_config
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
        self.sample_data_count = sample_data_count

        self._get_metric_fn = {
            MetricTypes.Table.value: self._compute_table_metrics,
            MetricTypes.Static.value: self._compute_static_metrics,
            MetricTypes.Query.value: self._compute_query_metrics,
            MetricTypes.Window.value: self._compute_window_metrics,
            MetricTypes.System.value: self._compute_system_metrics,
            MetricTypes.Custom.value: self._compute_custom_metrics,
        }

    @abstractmethod
    def _get_sampler(self):
        """Get the sampler"""
        raise NotImplementedError

    # pylint: disable=too-many-locals
    @classmethod
    def create(
        cls,
        entity: Table,
        database_schema: DatabaseSchema,
        database: Database,
        database_service: DatabaseService,
        entity_config: Optional[TableConfig],
        profiler_config: Optional[ProfilerProcessorConfig],
        source_config: DatabaseServiceProfilerPipeline,
        service_connection_config,
        ometa_client: Optional[OpenMetadata],
        **kwargs,
    ) -> "ProfilerInterface":
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
        database_profiler_config = cls.get_database_profiler_config(
            database_entity=database
        )
        schema_profiler_config = cls.get_schema_profiler_config(
            schema_entity=database_schema
        )
        storage_config = cls.get_storage_config_for_table(
            entity=entity,
            schema_profiler_config=schema_profiler_config,
            database_profiler_config=database_profiler_config,
            db_service=database_service,
            profiler_config=profiler_config,
        )

        if not cls.get_profile_query(entity, entity_config):
            profile_sample_config = cls.get_profile_sample_config(
                entity,
                schema_profiler_config,
                database_profiler_config,
                entity_config,
                source_config,
            )
            table_partition_config = cls.get_partition_details(entity, entity_config)
            sample_query = None
        else:
            sample_query = cls.get_profile_query(entity, entity_config)
            profile_sample_config = None
            table_partition_config = None

        sample_data_count = cls.get_sample_data_count_config(
            entity,
            schema_profiler_config,
            database_profiler_config,
            entity_config,
            source_config,
        )
        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            storage_config=storage_config,
            profile_sample_config=profile_sample_config,
            source_config=source_config,
            sample_query=sample_query,
            table_partition_config=table_partition_config,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            sample_data_count=sample_data_count,
            **kwargs,
        )

    @staticmethod
    def get_schema_profiler_config(
        schema_entity: Optional[DatabaseSchema],
    ) -> DatabaseSchemaProfilerConfig:
        if schema_entity and schema_entity.databaseSchemaProfilerConfig:
            return schema_entity.databaseSchemaProfilerConfig
        return None

    @staticmethod
    def get_database_profiler_config(
        database_entity: Optional[Database],
    ) -> DatabaseProfilerConfig:
        if database_entity and database_entity.databaseProfilerConfig:
            return database_entity.databaseProfilerConfig
        return None

    @staticmethod
    def _get_sample_storage_config(
        config: Union[
            DatabaseSchemaProfilerConfig,
            DatabaseProfilerConfig,
            DatabaseAndSchemaConfig,
        ]
    ):
        if (
            config
            and config.sampleDataStorageConfig
            and config.sampleDataStorageConfig.config
        ):
            return config.sampleDataStorageConfig.config
        return None

    @staticmethod
    def get_storage_config_for_table(
        entity: Table,
        schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
        database_profiler_config: Optional[DatabaseProfilerConfig],
        db_service: Optional[DatabaseService],
        profiler_config: ProfilerProcessorConfig,
    ) -> Optional[SampleDataStorageConfig]:
        """Get config for a specific entity

        Args:
            entity: table entity
        """
        for schema_config in profiler_config.schemaConfig:
            if (
                schema_config.fullyQualifiedName.__root__
                == entity.databaseSchema.fullyQualifiedName
                and ProfilerInterface._get_sample_storage_config(schema_config)
            ):
                return ProfilerInterface._get_sample_storage_config(schema_config)

        for database_config in profiler_config.databaseConfig:
            if (
                database_config.fullyQualifiedName.__root__
                == entity.database.fullyQualifiedName
                and ProfilerInterface._get_sample_storage_config(database_config)
            ):
                return ProfilerInterface._get_sample_storage_config(database_config)

        if ProfilerInterface._get_sample_storage_config(schema_profiler_config):
            return ProfilerInterface._get_sample_storage_config(schema_profiler_config)

        if ProfilerInterface._get_sample_storage_config(database_profiler_config):
            return ProfilerInterface._get_sample_storage_config(
                database_profiler_config
            )

        try:
            return db_service.connection.config.sampleDataStorageConfig.config
        except AttributeError:
            pass

        return None

    @staticmethod
    def get_profile_sample_config(
        entity: Table,
        schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
        database_profiler_config: Optional[DatabaseProfilerConfig],
        entity_config: Optional[Union[TableConfig, DatabaseAndSchemaConfig]],
        source_config: DatabaseServiceProfilerPipeline,
    ) -> Optional[ProfileSampleConfig]:
        """_summary_
        Args:
            entity (Table): table entity object
            entity_config (Optional[TableConfig]): table config object from yaml/json file
        Returns:
            Optional[dict]: dict
        """
        for config in (
            entity_config,
            entity.tableProfilerConfig,
            schema_profiler_config,
            database_profiler_config,
            source_config,
        ):
            try:
                if config and config.profileSample:
                    return ProfileSampleConfig(
                        profile_sample=config.profileSample,
                        profile_sample_type=config.profileSampleType,
                    )
            except AttributeError:
                pass

        return None

    @staticmethod
    def get_sample_data_count_config(
        entity: Table,
        schema_profiler_config: Optional[DatabaseSchemaProfilerConfig],
        database_profiler_config: Optional[DatabaseProfilerConfig],
        entity_config: Optional[TableConfig],
        source_config: DatabaseServiceProfilerPipeline,
    ) -> Optional[int]:
        """_summary_
        Args:
            entity_config (Optional[TableConfig]): table config object from yaml/json file
            source_config DatabaseServiceProfilerPipeline: profiler pipeline details
        Returns:
            Optional[int]: int
        """

        for config in (
            entity_config,
            entity.tableProfilerConfig,
            schema_profiler_config,
            database_profiler_config,
        ):
            if config and config.sampleDataCount:
                return config.sampleDataCount

        return source_config.sampleDataCount

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
    ) -> Dict[str, Any]:
        """Get metrics
        Return:
            Dict[str, Any]: dict of metrics tio be merged into the final column profile. Keys need to be compatible with
            the `metadata.generated.schema.entity.data.table.ColumnProfile` schema.
        """
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
    def _compute_custom_metrics(
        self, metrics: List[CustomMetric], runner, *args, **kwargs
    ):
        """Compute custom metrics"""
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
    def fetch_sample_data(self, table, columns: List[Column]) -> TableData:
        """run profiler metrics"""
        raise NotImplementedError

    @abstractmethod
    def close(self):
        """Clean up profiler interface"""
        raise NotImplementedError

    @abstractmethod
    def get_columns(self):
        """get columns"""
        raise NotImplementedError
