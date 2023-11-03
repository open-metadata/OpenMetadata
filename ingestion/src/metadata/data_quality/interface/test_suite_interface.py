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
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.utils.partition import get_partition_details


class TestSuiteInterface(ABC):
    """Abstract interface for the processor"""

    @abstractmethod
    def __init__(
        self,
        ometa_client: OpenMetadata,
        service_connection_config: DatabaseConnection,
        table_entity: Table,
    ):
        """Required attribute for the interface"""
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config
        self.table_entity = table_entity

    @abstractmethod
    def run_test_case(self, test_case: TestCase) -> Optional[TestCaseResult]:
        """run column data quality tests"""
        raise NotImplementedError

    def _get_sample_query(self) -> Optional[str]:
        """Get the sampling query for the data quality tests

        Args:
            entity (Table): _description_
        """
        if self.table_entity.tableProfilerConfig:
            return self.table_entity.tableProfilerConfig.profileQuery

        return None

    def _get_profile_sample(self) -> Optional[ProfileSampleConfig]:
        try:
            if self.table_entity.tableProfilerConfig.profileSample:
                return ProfileSampleConfig(
                    profile_sample=self.table_entity.tableProfilerConfig.profileSample,
                    profile_sample_type=self.table_entity.tableProfilerConfig.profileSampleType,
                )
        except AttributeError:
            # if tableProfilerConfig is None it will indicate that the table has not profiler config
            # hence we can return None
            return None
        return None

    def _get_table_config(self):
        """Get the sampling configuration for the data quality tests"""
        sample_query = self._get_sample_query()
        sample_config = None
        partition_config = None
        if not sample_query:
            sample_config = self._get_profile_sample()
            partition_config = get_partition_details(self.table_entity)

        return sample_query, sample_config, partition_config
