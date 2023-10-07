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
Abstract definition of each step
"""
from abc import ABC, abstractmethod
from typing import Any

from metadata.ingestion.api.step import BulkStep, IterStep, ReturnStep, StageStep
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class InvalidSourceException(Exception):
    """
    The source config is not getting the expected
    service connection
    """


class Source(IterStep, ABC):
    """
    Abstract source implementation. The workflow will run
    its next_record and pass them to the next step.
    """

    metadata: OpenMetadata
    connection_obj: Any
    service_connection: Any

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def test_connection(self) -> None:
        pass


class Sink(ReturnStep, ABC):
    """All Sinks must inherit this base class."""


class Processor(ReturnStep, ABC):
    """All Processor must inherit this base class"""


class Stage(StageStep, ABC):
    """All Stages must inherit this base class."""


class BulkSink(BulkStep, ABC):
    """All Stages must inherit this base class."""
