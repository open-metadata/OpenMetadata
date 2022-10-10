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
Abstract Source definition to build a Workflow
"""
import time
from abc import ABCMeta, abstractmethod
from typing import Any, Dict, Generic, Iterable, List

from pydantic import BaseModel

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.closeable import Closeable
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.status import Status


class InvalidSourceException(Exception):
    """
    The source config is not getting the expected
    service connection
    """


class SourceStatus(BaseModel, Status):
    """
    Class to handle processed records
    and success %
    """

    records = 0
    source_start_time = time.time()

    success: List[Any] = []
    failures: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []
    filtered: List[Dict[str, str]] = []

    def scanned(self, record: Any) -> None:
        self.records += 1
        self.success.append(record)

    def warning(self, key: str, reason: str) -> None:
        self.warnings.append({key: reason})

    def failure(self, key: str, reason: str) -> None:
        self.failures.append({key: reason})

    def filter(self, key: str, reason: str) -> None:
        self.filtered.append({key: reason})

    def calculate_success(self) -> float:
        source_sucess = max(
            len(self.success), 1
        )  # To avoid ZeroDivisionError using minimum value as 1
        source_failed = len(self.failures)
        return round(source_sucess * 100 / (source_sucess + source_failed), 2)


class Source(Closeable, Generic[Entity], metaclass=ABCMeta):
    """
    Abstract source implementation. The workflow will run
    its next_record and pass them to the next step.
    """

    @classmethod
    @abstractmethod
    def create(
        cls, config_dict: dict, metadata_config: OpenMetadataConnection
    ) -> "Source":
        pass

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def next_record(self) -> Iterable[Entity]:
        pass

    @abstractmethod
    def get_status(self) -> SourceStatus:
        pass

    @abstractmethod
    def test_connection(self) -> None:
        pass
