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

from datetime import datetime, timezone
from typing import Optional, Union

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.orm.util import AliasedClass

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.interfaces.sqalchemy.mixins.sqa_mixin import SQAInterfaceMixin
from metadata.interfaces.test_suite_protocol import TestSuiteProtocol
from metadata.orm_profiler.api.models import ProfileSampleConfig
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.test_suite.validations.core import validation_enum_registry
from metadata.utils.constants import TEN_MIN
from metadata.utils.logger import test_suite_logger
from metadata.utils.timeout import cls_timeout

logger = test_suite_logger()


class SQATestSuiteInterface(SQAInterfaceMixin, TestSuiteProtocol):
    """
    Sequential interface protocol for testSuite and Profiler. This class
    implements specific operations needed to run profiler and test suite workflow
    against a SQAlchemy source.
    """

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        service_connection_config: DatabaseConnection,
        ometa_client: OpenMetadata,
        sqa_metadata_obj: Optional[MetaData] = None,
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        table_sample_query: str = None,
        table_partition_config: dict = None,
        table_entity: Table = None,
    ):
        self.ometa_client = ometa_client
        self.table_entity = table_entity
        self.service_connection_config = service_connection_config
        self.session = create_and_bind_session(
            get_connection(self.service_connection_config)
        )
        self.set_session_tag(self.session)

        self._table = self._convert_table_to_orm_object(sqa_metadata_obj)

        self.profile_sample_config = profile_sample_config
        self.table_sample_query = table_sample_query
        self.table_partition_config = (
            self.get_partition_details(table_partition_config)
            if not self.table_sample_query
            else None
        )

        self._sampler = self._create_sampler()
        self._runner = self._create_runner()

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
    def sampler(self) -> Sampler:
        """getter method for the Runner object

        Returns:
            Sampler: sampler object
        """
        return self._sampler

    def _create_sampler(self) -> Sampler:
        """Create sampler instance"""
        return Sampler(
            session=self.session,
            table=self.table,
            profile_sample_config=self.profile_sample_config,
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

    def run_test_case(
        self,
        test_case: TestCase,
    ) -> Optional[TestCaseResult]:
        """Run table tests where platformsTest=OpenMetadata

        Args:
            test_case: test case object to execute

        Returns:
            TestCaseResult object
        """

        try:
            return validation_enum_registry.registry[
                test_case.testDefinition.fullyQualifiedName
            ](
                self.runner,
                test_case=test_case,
                execution_date=datetime.now(tz=timezone.utc).timestamp(),
            )
        except KeyError as err:
            logger.warning(
                f"Test definition {test_case.testDefinition.fullyQualifiedName} not registered in OpenMetadata "
                f"TestDefintion registry. Skipping test case {test_case.name.__root__} - {err}"
            )
            return None
