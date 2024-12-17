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
from typing import Any, Dict, List, Optional, Type, Union

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import SystemProfile, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.collaborative_super import Root
from metadata.utils.ssl_manager import get_ssl_connection


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


class ProfilerInterface(Root, ABC):
    """Protocol interface for the profiler processor"""

    def __init__(  # pylint: disable=too-many-arguments
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        source_config: DatabaseServiceProfilerPipeline,
        sampler: SamplerInterface,
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
        self.connection = get_ssl_connection(self.service_connection_config)
        self.status = ProfilerProcessorStatus()
        try:
            fqn = self.table_entity.fullyQualifiedName
        except AttributeError:
            self.status.entity = None
        else:
            self.status.entity = fqn.root if fqn else None
        self.sampler = sampler
        self.timeout_seconds = timeout_seconds

        self._get_metric_fn = {
            MetricTypes.Table.value: self._compute_table_metrics,
            MetricTypes.Static.value: self._compute_static_metrics,
            MetricTypes.Query.value: self._compute_query_metrics,
            MetricTypes.Window.value: self._compute_window_metrics,
            MetricTypes.System.value: self._compute_system_metrics,
            MetricTypes.Custom.value: self._compute_custom_metrics,
        }

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

    @classmethod
    def create(
        cls,
        entity: Table,
        source_config: DatabaseServiceProfilerPipeline,
        service_connection_config,
        sampler: SamplerInterface,
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

        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            source_config=source_config,
            sampler=sampler,
            thread_count=thread_count,
            timeout_seconds=timeout_seconds,
            **kwargs,
        )

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
        metrics: Type[System],
        runner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
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
        self, column: Column, metric: Metrics, column_results: Dict
    ) -> dict:
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
