#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from metadata.data_quality.builders.validator_builder import (
    SourceType,
    ValidatorBuilder,
)
from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class PandasTestSuiteInterface(TestSuiteInterface, PandasInterfaceMixin):
    """
    Sequential interface protocol for testSuite and Profiler. This class
    implements specific operations needed to run profiler and test suite workflow
    against a Datalake source.
    """

    def __init__(
        self,
        service_connection_config: DatalakeConnection,
        ometa_client: OpenMetadata,
        sampler: SamplerInterface,
        table_entity: Table,
        **kwargs,
    ):
        super().__init__(
            service_connection_config,
            ometa_client,
            sampler,
            table_entity,
            **kwargs,
        )

        (
            self.sample_query,
            self.profile_sample_config,
            self.partition_details,
        ) = self._get_table_config()

        self.dataset = self.sampler.get_dataset()

    def _get_validator_builder(
        self, test_case: TestCase, entity_type: str
    ) -> ValidatorBuilder:
        return self.validator_builder_class(
            runner=self.dataset,
            test_case=test_case,
            entity_type=entity_type,
            source_type=SourceType.PANDAS,
        )
