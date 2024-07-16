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

from typing import Union

from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.util import AliasedClass

from metadata.data_quality.builders.i_validator_builder import IValidatorBuilder
from metadata.data_quality.builders.sqa_validator_builder import SQAValidatorBuilder
from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.processor.runner import QueryRunner
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler
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
        table_entity: Table = None,
        sqa_metadata=None,
    ):
        self.ometa_client = ometa_client
        self.table_entity = table_entity
        self.service_connection_config = service_connection_config
        self.create_session()
        self._table = self._convert_table_to_orm_object(sqa_metadata)

        (
            self.table_sample_query,
            self.table_sample_config,
            self.table_partition_config,
        ) = self._get_table_config()

        self._sampler = self._create_sampler()
        self._runner = self._create_runner()

    def create_session(self):
        self.session = create_and_bind_session(
            get_ssl_connection(self.service_connection_config)
        )

    @property
    def sample(self) -> Union[DeclarativeMeta, AliasedClass]:
        """_summary_

        Returns:
            Union[DeclarativeMeta, AliasedClass]: _description_
        """
        if not self.sampler:
            raise RuntimeError(
                "You must create a sampler first `<instance>.create_sampler(...)`."
            )

        return self.sampler.random_sample()

    @property
    def runner(self) -> QueryRunner:
        """getter method for the QueryRunner object

        Returns:
            QueryRunner: runner object
        """
        return self._runner

    @property
    def sampler(self) -> SQASampler:
        """getter method for the Runner object

        Returns:
            Sampler: sampler object
        """
        return self._sampler

    @property
    def table(self):
        """getter method for the table object

        Returns:
            Table: table object
        """
        return self._table

    def _create_sampler(self) -> SQASampler:
        """Create sampler instance"""
        from metadata.profiler.processor.sampler.sampler_factory import (  # pylint: disable=import-outside-toplevel
            sampler_factory_,
        )

        return sampler_factory_.create(
            self.service_connection_config.__class__.__name__,
            client=self.session,
            table=self.table,
            profile_sample_config=self.table_sample_config,
            partition_details=self.table_partition_config,
            profile_sample_query=self.table_sample_query,
        )

    def _create_runner(self) -> None:
        """Create a QueryRunner Instance"""

        return cls_timeout(TEN_MIN)(
            QueryRunner(
                session=self.session,
                table=self.table,
                sample=self.sample,
                partition_details=self.table_partition_config,
                profile_sample_query=self.table_sample_query,
            )
        )

    def _get_validator_builder(
        self, test_case: TestCase, entity_type: str
    ) -> IValidatorBuilder:
        return SQAValidatorBuilder(self.runner, test_case, entity_type)
