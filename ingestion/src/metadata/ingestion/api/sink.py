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
Abstract Sink definition to build a Workflow
"""
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, List

from pydantic import BaseModel

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.closeable import Closeable
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.status import Status


class SinkStatus(BaseModel, Status):
    records: List[str] = []
    warnings: List[Any] = []
    failures: List[Any] = []

    def records_written(self, record: str) -> None:
        self.records.append(record)

    def warning(self, info: Any) -> None:
        self.warnings.append(info)

    def failure(self, info: Any) -> None:
        self.failures.append(info)


@dataclass  # type: ignore[misc]
class Sink(Closeable, Generic[Entity], metaclass=ABCMeta):
    """All Sinks must inherit this base class."""

    @classmethod
    @abstractmethod
    def create(
        cls, config_dict: dict, metadata_config: OpenMetadataConnection
    ) -> "Sink":
        pass

    @abstractmethod
    def write_record(self, record: Entity) -> None:
        # must call callback when done.
        pass

    @abstractmethod
    def get_status(self) -> SinkStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
