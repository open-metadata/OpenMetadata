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
Abstract Stage definition to build a Workflow
"""
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Generic, List

from metadata.ingestion.api.closeable import Closeable
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.status import Status


@dataclass
class StageStatus(Status):
    records_produced = 0

    records: List[str] = field(default_factory=list)
    warnings: Dict[str, List[str]] = field(default_factory=dict)
    failures: Dict[str, List[str]] = field(default_factory=dict)

    def records_status(self, record: Any) -> None:
        self.records.append(record)
        self.records_produced += 1

    def warning_status(self, key: str, reason: str) -> None:
        if key not in self.warnings:
            self.warnings[key] = []
        self.warnings[key].append(reason)

    def failure_status(self, key: str, reason: str) -> None:
        if key not in self.failures:
            self.failures[key] = []
        self.failures[key].append(reason)


@dataclass  # type: ignore[misc]
class Stage(Closeable, Generic[Entity], metaclass=ABCMeta):
    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config: dict) -> "Stage":
        pass

    @abstractmethod
    def stage_record(self, record: Entity):
        pass

    @abstractmethod
    def get_status(self) -> StageStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
