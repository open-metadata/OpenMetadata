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

from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Iterable, List

from .closeable import Closeable
from .common import Record, WorkflowContext
from .status import Status


@dataclass
class SourceStatus(Status):
    records = 0

    warnings: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)

    def scanned(self, record: Record) -> None:
        self.records += 1

    def warning(self, key: str, reason: str) -> None:
        self.warnings.append({key: reason})

    def failure(self, key: str, reason: str) -> None:
        self.failures.append({key: reason})


@dataclass  # type: ignore[misc]
class Source(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ) -> "Source":
        pass

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def next_record(self) -> Iterable[Record]:
        pass

    @abstractmethod
    def get_status(self) -> SourceStatus:
        pass
