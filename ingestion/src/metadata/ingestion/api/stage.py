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
from dataclasses import dataclass
from typing import Generic

from metadata.ingestion.api.closeable import Closeable
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.status import Status


class StageStatus(Status):
    pass


@dataclass  # type: ignore[misc]
class Stage(Closeable, Generic[Entity], metaclass=ABCMeta):
    """
    Stage class
    """

    status: StageStatus

    def __init__(self):
        self.status = StageStatus()

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config: dict) -> "Stage":
        pass

    @abstractmethod
    def stage_record(self, record: Entity):
        pass

    def get_status(self) -> StageStatus:
        return self.status

    @abstractmethod
    def close(self) -> None:
        pass
