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
from typing import Optional, Union

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class TestSuiteProtocol(ABC):
    """Protocol interface for the processor"""

    @abstractmethod
    def __init__(
        self,
        ometa_client: OpenMetadata = None,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection] = None,
    ):
        """Required attribute for the interface"""
        raise NotImplementedError

    @abstractmethod
    def run_test_case(self, test_case: TestCase) -> Optional[TestCaseResult]:
        """run column data quality tests"""
        raise NotImplementedError
