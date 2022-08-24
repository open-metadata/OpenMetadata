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
from typing import Optional

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.orm_profiler.api.models import ProfilerProcessorConfig


class InterfaceProtocol(ABC):
    """Protocol interface for the processor"""

    @abstractmethod
    def __init__(
        self,
        metadata_config: OpenMetadataConnection = None,
        profiler_config: ProfilerProcessorConfig = None,
        workflow_profile_sample: float = None,
        thread_count: int = 5,
        table: Table = None,
    ):
        """Required attribute for the interface"""
        raise NotImplementedError

    @abstractmethod
    def create_sampler(*args, **kwargs) -> None:
        """Method to instantiate a Sampler object"""
        raise NotImplementedError

    @abstractmethod
    def create_runner(*args, **kwargs) -> None:
        """Method to instantiate a Runner object"""
        raise NotImplementedError

    @abstractmethod
    def run_test_case(*args, **kwargs) -> Optional[TestCaseResult]:
        """run column data quality tests"""
        raise NotImplementedError
