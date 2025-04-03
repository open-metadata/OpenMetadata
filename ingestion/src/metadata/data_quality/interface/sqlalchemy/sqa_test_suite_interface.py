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

from typing import Union

from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.util import AliasedClass

from metadata.data_quality.builders.validator_builder import (
    SourceType,
    ValidatorBuilder,
)
from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import TEN_MIN
from metadata.utils.logger import test_suite_logger
from metadata.utils.ssl_manager import get_ssl_connection
from metadata.utils.timeout import cls_timeout

logger = test_suite_logger()


class SQATestSuiteInterface(SQAInterfaceMixin, TestSuiteInterface):
    """
    Sequential interface protocol for testSuite and Profiler. This class
    implements specific operations needed to run profiler and test suite workflow
    against a SQAlchemy source.
    """

    def __init__(
        self,
        service_connection_config: DatabaseConnection,
        ometa_client: OpenMetadata,
        sampler: SamplerInterface,
        table_entity: Table = None,
        **kwargs,
    ):
        super().__init__(
            service_connection_config, ometa_client, sampler, table_entity, **kwargs
        )
        self.source_type = SourceType.SQL
        self.create_session()

        (
            self.table_sample_query,
            self.table_sample_config,
            self.table_partition_config,
        ) = self._get_table_config()

        self._runner = self._create_runner()

    def create_session(self):
        self.session = create_and_bind_session(
            get_ssl_connection(self.service_connection_config)
        )

    @property
    def dataset(self) -> Union[DeclarativeMeta, AliasedClass]:
        """_summary_

        Returns:
            Union[DeclarativeMeta, AliasedClass]: _description_
        """
        if not self.sampler:
            raise RuntimeError(
                "You must create a sampler first `<instance>.create_sampler(...)`."
            )

        return self.sampler.get_dataset()

    @property
    def runner(self) -> QueryRunner:
        """getter method for the QueryRunner object

        Returns:
            QueryRunner: runner object
        """
        return self._runner

    def _create_runner(self) -> QueryRunner:
        """Create a QueryRunner Instance"""

        return cls_timeout(TEN_MIN)(
            QueryRunner(
                session=self.session,
                dataset=self.dataset,
                raw_dataset=self.sampler.raw_dataset,
                partition_details=self.table_partition_config,
                profile_sample_query=self.table_sample_query,
            )
        )

    def _get_validator_builder(
        self, test_case: TestCase, entity_type: str
    ) -> ValidatorBuilder:
        return self.validator_builder_class(
            runner=self.runner,
            test_case=test_case,
            entity_type=entity_type,
            source_type=self.source_type,
        )
