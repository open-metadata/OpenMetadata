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
from typing import Dict, Union

from sqlalchemy import Column

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.metrics.registry import Metrics


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
