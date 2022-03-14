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
Defines the ORM Profiler processor

For each table, we compute its profiler
and run the validations.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.columnTest import ColumnTestCase
from metadata.generated.schema.tests.tableTest import TableTestCase
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.orm_profiler.api.models import ProfilerProcessorConfig, ProfilerResponse
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiles.core import Profiler
from metadata.orm_profiler.profiles.default import DefaultProfiler
from metadata.orm_profiler.validations.core import validate
from metadata.orm_profiler.validations.models import TestDef, TestSuite

logger = logging.getLogger("ORM Profiler Workflow")


@dataclass
class OrmProfilerStatus(ProcessorStatus):
    """
    Keep track of the profiler execution
    """

    tests: List[str] = field(default_factory=list)

    def tested(self, record: str) -> None:
        self.tests.append(record)
        logger.info(f"Table tested: {record}")


class OrmProfilerProcessor(Processor[Table]):
    """
    For each table, run the profiler and validations.

    We won't return Entity, but the executed Profiler
    and Validation objects.
    """

    config: ProfilerProcessorConfig
    status: OrmProfilerStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: ProfilerProcessorConfig,
        metadata_config: MetadataServerConfig,
        session: Session,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = OrmProfilerStatus()
        self.session = session

        self.report = {"tests": {}}

        self.execution_date = datetime.now()

        # OpenMetadata client to fetch tables
        self.metadata = OpenMetadata(self.metadata_config)

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata_config_dict: dict,
        ctx: WorkflowContext,
        **kwargs,
    ):
        """
        We expect to receive `session` inside kwargs
        """

        config = ProfilerProcessorConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)

        session = kwargs.get("session")
        if not session:
            raise ValueError(
                "Cannot initialise the ProfilerProcessor without an SQLAlchemy Session"
            )

        return cls(ctx, config, metadata_config, session=session)

    def build_profiler(self, orm: DeclarativeMeta) -> Profiler:
        """
        Given a column from the entity, build the profiler

        table is of type DeclarativeMeta
        """
        if not self.config.profiler:
            return DefaultProfiler(session=self.session, table=orm)

        # Here we will need to add the logic to pass kwargs to the metrics
        metrics = [Metrics.get(name) for name in self.config.profiler.metrics]

        return Profiler(
            *metrics,
            session=self.session,
            table=orm,
            profile_date=self.execution_date,
        )

    def profile_entity(self, orm: DeclarativeMeta, table: Table) -> TableProfile:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        # Prepare the profilers for all table columns
        profiler = self.build_profiler(orm)

        logger.info(f"Executing profilers for {table.fullyQualifiedName}...")
        profiler.execute()

        self.status.processed(table.fullyQualifiedName)
        return profiler.get_profile()

    def log_test_result(self, name: str, result: TestCaseResult) -> None:
        """
        Log test case results
        """
        self.status.tested(name)
        if not result.testCaseStatus == TestCaseStatus.Success:
            self.status.failure(f"{name}: {result.result}")

    @staticmethod
    def get_test_name(table: Table, test_type: str, column_name: str = None):
        """
        Build a unique identifier to log the test
        in the shape of FQDN.[column].test_type

        :param table: Table Entity
        :param test_type: We expected one test type per table & column
        :param column_name: Column name, if logging a column test
        :return: Unique name for this execution
        """
        col = f".{column_name}." if column_name else "."
        return table.fullyQualifiedName + col + test_type

    def run_table_test(
        self,
        table: Table,
        orm_table: DeclarativeMeta,
        test_case: TableTestCase,
        profiler_results: TableProfile,
    ) -> Optional[TestCaseResult]:
        """
        Run & log the table test against the TableProfile.

        :param table: Table Entity being processed
        :param orm_table: Declarative Meta
        :param test_case: Table Test Case to run
        :param profiler_results: Table profiler with informed metrics
        :return: TestCaseResult
        """
        test_name = self.get_test_name(
            table=table, test_type=test_case.tableTestType.value
        )
        if test_name in self.status.tests:
            logger.info(
                f"Test {test_name} has already been computed in this execution."
            )
            return None

        test_case_result: TestCaseResult = validate(
            test_case.config,
            table_profile=profiler_results,
            execution_date=self.execution_date,
            session=self.session,
            table=orm_table,
        )
        self.log_test_result(name=test_name, result=test_case_result)
        return test_case_result

    def run_column_test(
        self,
        table: Table,
        orm_table: DeclarativeMeta,
        column: str,
        test_case: ColumnTestCase,
        profiler_results: TableProfile,
    ) -> Optional[TestCaseResult]:
        """
        Run & log the column test against the ColumnProfile

        :param table: Table Entity being processed
        :param orm_table: Declarative Meta
        :param column: Column being tested
        :param test_case: Column Test Case to run
        :param profiler_results: Table profiler with informed metrics
        :return: TestCaseResult
        """
        test_name = self.get_test_name(
            table=table, test_type=test_case.columnTestType.value, column_name=column
        )
        if test_name in self.status.tests:
            logger.info(
                f"Test {test_name} has already been computed in this execution."
            )
            return None

        # Check if we computed a profile for the required column
        col_profiler_res = next(
            iter(
                col_profiler
                for col_profiler in profiler_results.columnProfile
                if col_profiler.name == column
            ),
            None,
        )
        if col_profiler_res is None:
            msg = (
                f"Cannot find a profiler that computed the column {column}"
                + f" Skipping validation {test_name}"
            )
            self.status.failure(msg)
            return TestCaseResult(
                executionTime=self.execution_date.timestamp(),
                status=TestCaseStatus.Aborted,
                result=msg,
            )

        test_case_result: TestCaseResult = validate(
            test_case.config,
            col_profile=col_profiler_res,
            execution_date=self.execution_date,
            session=self.session,
            table=orm_table,
        )
        self.log_test_result(name=test_name, result=test_case_result)
        return test_case_result

    def validate_config_tests(
        self, table: Table, orm_table: DeclarativeMeta, profiler_results: TableProfile
    ) -> Optional[TestDef]:
        """
        Here we take care of new incoming tests in the workflow
        definition. Run them and prepare the new TestDef
        of the record, that will be sent to the sink to
        update the Table Entity.

        :param table: OpenMetadata Table Entity being processed
        :param orm_table: Declarative Meta
        :param profiler_results: TableProfile with computed metrics
        """

        logger.info(f"Checking validations for {table.fullyQualifiedName}...")

        test_suite: TestSuite = self.config.test_suite

        # Check if I have tests for the table I am processing
        my_record_tests = next(
            iter(
                test
                for test in test_suite.tests
                if test.table == table.fullyQualifiedName
            ),
            None,
        )

        if not my_record_tests:
            return None

        # Compute all validations against the profiler results
        for table_test in my_record_tests.table_tests:
            test_case_result = self.run_table_test(
                table=table,
                orm_table=orm_table,
                test_case=table_test.testCase,
                profiler_results=profiler_results,
            )
            if test_case_result:
                table_test.result = test_case_result

        for column_test in my_record_tests.column_tests:
            test_case_result = self.run_column_test(
                table=table,
                orm_table=orm_table,
                column=column_test.columnName,
                test_case=column_test.testCase,
                profiler_results=profiler_results,
            )
            if test_case_result:
                column_test.result = test_case_result

        return my_record_tests

    def validate_entity_tests(
        self,
        table: Table,
        orm_table: DeclarativeMeta,
        profiler_results: TableProfile,
        config_tests: Optional[TestDef],
    ) -> Optional[TestDef]:
        """
        This method checks the tests that are
        configured at entity level, i.e., have been
        stored via the API at some other point in time.

        If we find a test that has already been run
        from the workflow config, we will skip it
        and trust the workflow input.

        :param table: OpenMetadata Table Entity being processed
        :param orm_table: Declarative Meta
        :param profiler_results: TableProfile with computed metrics
        :param config_tests: Results of running the configuration tests
        """

        # We need to keep track of all ran tests, so let's initialize
        # a TestDef class with either what we have from the incoming
        # config, or leaving it empty.
        # During the Entity processing, we will add here
        # any tests we discover from the Entity side.
        record_tests = (
            TestDef(
                table=config_tests.table,
                table_tests=config_tests.table_tests
                if config_tests.table_tests
                else [],
                column_tests=config_tests.column_tests
                if config_tests.column_tests
                else [],
            )
            if config_tests
            else TestDef(
                table=table.fullyQualifiedName, table_tests=[], column_tests=[]
            )
        )

        # Note that the tests configured in the Entity as `TableTest` and
        # `ColumnTest`. However, to PUT the results we need the API form:
        # `CreateTableTestRequest` and `CreateColumnTestRequest`.
        # We will convert the found tests before running them.

        # Fetch all table tests, if any
        table_tests = (
            table_test for table_test in (table.tableTests or [])
        )  # tableTests are optional, so it might be a list or None
        for table_test in table_tests:
            test_case_result = self.run_table_test(
                table=table,
                orm_table=orm_table,
                test_case=table_test.testCase,
                profiler_results=profiler_results,
            )
            if test_case_result:
                create_table_test = CreateTableTestRequest(
                    description=table_test.description,
                    testCase=table_test.testCase,
                    executionFrequency=table_test.executionFrequency,
                    owner=table_test.owner,
                    result=test_case_result,
                )
                record_tests.table_tests.append(create_table_test)

        # For all columns, check if any of them has tests and fetch them
        col_tests = (
            col_test
            for col in table.columns
            for col_test in (
                col.columnTests or []
            )  # columnTests is optional, so it might be a list or None
            if col.columnTests
        )
        for column_test in col_tests:
            if column_test:
                test_case_result = self.run_column_test(
                    table=table,
                    orm_table=orm_table,
                    column=column_test.columnName,
                    test_case=column_test.testCase,
                    profiler_results=profiler_results,
                )
                if test_case_result:
                    create_column_test = CreateColumnTestRequest(
                        columnName=column_test.columnName,
                        description=column_test.description,
                        testCase=column_test.testCase,
                        executionFrequency=column_test.executionFrequency,
                        owner=column_test.owner,
                        result=test_case_result,
                    )
                    record_tests.column_tests.append(create_column_test)

        return record_tests

    def process(self, record: Table) -> ProfilerResponse:
        """
        Run the profiling and tests
        """
        # Convert entity to ORM. Fetch the db by ID to make sure we use the proper db name
        database = self.metadata.get_by_id(
            entity=Database, entity_id=record.database.id
        )
        orm_table = ometa_to_orm(table=record, database=database)

        entity_profile = self.profile_entity(orm_table, record)

        # First, check if we have any tests directly configured in the workflow
        config_tests = None
        if self.config.test_suite:
            config_tests = self.validate_config_tests(record, orm_table, entity_profile)

        # Then, Check if the entity has any tests
        record_tests = self.validate_entity_tests(
            record, orm_table, entity_profile, config_tests
        )

        res = ProfilerResponse(
            table=record,
            profile=entity_profile,
            record_tests=record_tests,
        )

        return res

    def close(self):
        """
        Close all connections
        """
        self.metadata.close()
        self.session.close()

    def get_status(self) -> OrmProfilerStatus:
        return self.status
