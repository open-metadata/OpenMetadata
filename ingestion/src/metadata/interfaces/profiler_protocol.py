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
from typing import Any, Dict, Optional, Union

from pydantic import BaseModel
from sqlalchemy import Column, MetaData

from metadata.generated.schema.entity.data.table import PartitionProfilerConfig, Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.api.models import ProfileSampleConfig
from metadata.orm_profiler.metrics.registry import Metrics


class ProfilerInterfaceArgs(BaseModel):
    """Profiler Interface Args Model"""

    service_connection_config: Any
    sqa_metadata_obj: Optional[MetaData]
    ometa_client: Optional[OpenMetadata]
    thread_count: Optional[float]
    table_entity: Optional[Union[Table, Any]]
    profile_sample_config: Optional[ProfileSampleConfig] = None
    table_sample_query: Optional[Union[int, str]]
    table_partition_config: Optional[PartitionProfilerConfig]
    timeout_seconds: Optional[int]

    class Config:
        arbitrary_types_allowed = True


class ProfilerProtocol(ABC):
    """Protocol interface for the profiler processor"""

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
    def fetch_sample_data(self, table) -> dict:
        """run profiler metrics"""
        raise NotImplementedError
