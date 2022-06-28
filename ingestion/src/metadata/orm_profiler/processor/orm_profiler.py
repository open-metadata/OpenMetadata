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
from typing import Dict, List, Optional

from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest
from metadata.generated.schema.entity.data.table import Table, TableData, TableProfile
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.columnTest import ColumnTestCase
from metadata.generated.schema.tests.tableTest import TableTestCase
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.api.models import ProfilerProcessorConfig, ProfilerResponse
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiler.core import Profiler
from metadata.orm_profiler.profiler.default import DefaultProfiler, get_default_metrics
from metadata.orm_profiler.profiler.handle_partition import (
    get_partition_cols,
    is_partitioned,
)
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.orm_profiler.validations.core import validate
from metadata.orm_profiler.validations.models import TestDef
from metadata.utils.helpers import get_start_and_end

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
        config: ProfilerProcessorConfig,
        metadata_config: OpenMetadataConnection,
        session: Session,
    ):
        super().__init__()
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
        metadata_config: OpenMetadataConnection,
        **kwargs,
    ):
        """
        We expect to receive `session` inside kwargs
        """

        config = ProfilerProcessorConfig.parse_obj(config_dict)

        session = kwargs.get("session")
        if not session:
            raise ValueError(
                "Cannot initialise the ProfilerProcessor without an SQLAlchemy Session"
            )

        return cls(config, metadata_config, session=session)

    def get_table_profile_sample(self, table: Table) -> Optional[float]:
        """
        Pick the Table profileSample value, either from the test
        definition or the value from the instance.

        :param table: Table instance
        :return: profileSample value to use
        """
        if self.config.test_suite:
            # If the processed table has information about the profile_sample,
            # use that instead of the Entity stored profileSample
            my_record_tests = self.get_record_test_def(table)
            if my_record_tests and my_record_tests.profile_sample:
                return my_record_tests.profile_sample

        return table.profileSample or None

    def get_partition_details(
        self,
        orm: DeclarativeMeta,
        table: Table,
    ) -> Optional[Dict]:
        """Get partition details for the profiler if working with
        bigquery table

        Args:
            table: table entity
        Returns:
            None or Dict
        """

        if table.serviceType == DatabaseServiceType.BigQuery:
            if is_partitioned(self.session, orm):
                my_record_profile = (
                    self.get_record_test_def(table)
                    if self.config.test_suite and self.get_record_test_def(table)
                    else TestDef(table=table.fullyQualifiedName.__root__)
                )

                if my_record_profile.profile_sample_query:
                    return None

                start, end = get_start_and_end(
                    my_record_profile.partition_query_duration
                )
                partition_details = {
                    "partition_field": my_record_profile.partition_field
                    or get_partition_cols(self.session, orm),
                    "partition_start": start,
                    "partition_end": end,
                    "partition_values": my_record_profile.partition_values,
                }

                return partition_details

        return None

    def get_profile_sample_query(self, table: Table) -> Optional[str]:
        """Get sample query from the test definition. We first check
        if the profiler workflow config file contains a `profile_sample_query`
        in one of the test case. If not we'll check the table entity itself,
        first checking if the table entity has a tableProfile object and then
        if it has a `profileQuery` field.

        Args:
            table: table object
        Returns
            Optional[str]
        """
        if self.config.test_suite:
            test_record = self.get_record_test_def(table)
            if test_record:
                if test_record.clear_sample_query_from_entity:
                    self.metadata.update_profile_query(
                        fqn=table.fullyQualifiedName.__root__,
                        profileSample=self.get_table_profile_sample(table),
                    )
                    return None
                return test_record.profile_sample_query

        return table.profileQuery

    def build_profiler(
        self,
        orm: DeclarativeMeta,
        table: Table,
    ) -> Profiler:
        """
        Given a column from the entity, build the profiler.

        :param orm: Declarative Meta
        :param table: Table record being processed
        :return: Initialised Profiler
        """

        profile_sample = self.get_table_profile_sample(table)

        if not self.config.profiler:
            return DefaultProfiler(
                session=self.session,
                table=orm,
                profile_sample=profile_sample,
                partition_details=self.get_partition_details(orm, table),
                profile_sample_query=self.get_profile_sample_query(table),
            )

        # Here we will need to add the logic to pass kwargs to the metrics
        metrics = (
            [Metrics.get(name) for name in self.config.profiler.metrics]
            if self.config.profiler.metrics
            else get_default_metrics(orm)
        )

        return Profiler(
            *metrics,
            session=self.session,
            table=orm,
            profile_date=self.execution_date,
            profile_sample=profile_sample,
            timeout_seconds=self.config.profiler.timeout_seconds,
            partition_details=self.get_partition_details(orm, table),
            profile_sample_query=self.get_profile_sample_query(table),
        )

    def profile_entity(
        self,
        orm: DeclarativeMeta,
        table: Table,
    ) -> TableProfile:
        """
        Given a table, we will prepare the profiler for
        all its columns and return all the run profilers
        in a Dict in the shape {col_name: Profiler}

        Type of entity is DeclarativeMeta
        """
        if not isinstance(orm, DeclarativeMeta):
            raise ValueError(f"Entity {orm} should be a DeclarativeMeta.")

        # Prepare the profilers for all table columns
        profiler = self.build_profiler(orm, table=table)

        logger.info(f"Executing profilers for {table.fullyQualifiedName.__root__}...")
        profiler.execute()

        self.status.processed(table.fullyQualifiedName.__root__)
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
        in the shape of FQN.[column].test_type

        :param table: Table Entity
        :param test_type: We expected one test type per table & column
        :param column_name: Column name, if logging a column test
        :return: Unique name for this execution
        """
        col = f".{column_name}." if column_name else "."
        return table.fullyQualifiedName.__root__ + col + test_type

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
            profile_sample=self.get_table_profile_sample(table),
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
                testCaseStatus=TestCaseStatus.Aborted,
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
        self, orm: DeclarativeMeta, table: Table, profiler_results: TableProfile
    ) -> Optional[TestDef]:
        """
        Here we take care of new incoming tests in the workflow
        definition. Run them and prepare the new TestDef
        of the record, that will be sent to the sink to
        update the Table Entity.

        :param table: OpenMetadata Table Entity being processed
        :param orm: Declarative Meta
        :param profiler_results: TableProfile with computed metrics
        """

        logger.info(f"Checking validations for {table.fullyQualifiedName.__root__}...")

        # Check if I have tests for the table I am processing
        my_record_tests = self.get_record_test_def(table)

        if not my_record_tests:
            return None

        # Compute all validations against the profiler results
        table_tests = my_record_tests.table_tests or []
        column_tests = my_record_tests.column_tests or []

        for table_test in table_tests:
            test_case_result = self.run_table_test(
                table=table,
                orm_table=orm,
                test_case=table_test.testCase,
                profiler_results=profiler_results,
            )
            if test_case_result:
                table_test.result = test_case_result

        for column_test in column_tests:
            test_case_result = self.run_column_test(
                table=table,
                orm_table=orm,
                column=column_test.columnName,
                test_case=column_test.testCase,
                profiler_results=profiler_results,
            )
            if test_case_result:
                column_test.result = test_case_result

        return my_record_tests

    def get_record_test_def(self, table: Table) -> Optional[TestDef]:
        """
        Fetch a record from the Workflow JSON config
        if the processed table is informed there.

        :param table: Processed table
        :return: Test definition
        """
        my_record_tests = next(
            iter(
                test
                for test in self.config.test_suite.tests
                if test.table == table.fullyQualifiedName.__root__
            ),
            None,
        )
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
                profile_sample=config_tests.profile_sample,
                table_tests=config_tests.table_tests
                if config_tests.table_tests
                else [],
                column_tests=config_tests.column_tests
                if config_tests.column_tests
                else [],
            )
            if config_tests
            else TestDef(
                table=table.fullyQualifiedName.__root__, table_tests=[], column_tests=[]
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

    def fetch_sample_data(
        self,
        orm: DeclarativeMeta,
        table: Table,
    ) -> TableData:
        """
        Fetch the table data from a real sample
        :param orm: SQA ORM table
        :return: TableData
        """
        try:
            sampler = Sampler(
                session=self.session,
                table=orm,
                partition_details=self.get_partition_details(
                    orm,
                    table,
                ),
                profile_sample_query=self.get_profile_sample_query(table),
            )
            return sampler.fetch_sample_data()
        except Exception as err:
            logger.error(
                f"Could not obtain sample data from {orm.__tablename__} - {err}"
            )

    def process(
        self,
        record: Table,
        generate_sample_data: bool = True,
    ) -> ProfilerResponse:
        """
        Run the profiling and tests
        """
        # Convert entity to ORM. Fetch the db by ID to make sure we use the proper db name

        orm_table = ometa_to_orm(table=record, metadata=self.metadata)

        entity_profile = self.profile_entity(orm=orm_table, table=record)

        # First, check if we have any tests directly configured in the workflow
        config_tests = None
        if self.config.test_suite:
            config_tests = self.validate_config_tests(
                orm=orm_table, table=record, profiler_results=entity_profile
            )

        # Then, Check if the entity has any tests
        record_tests = self.validate_entity_tests(
            record, orm_table, entity_profile, config_tests
        )

        sample_data = (
            self.fetch_sample_data(orm=orm_table, table=record)
            if generate_sample_data
            else None
        )

        res = ProfilerResponse(
            table=record,
            profile=entity_profile,
            record_tests=record_tests,
            sample_data=sample_data,
        )

        return res

    def close(self):
        """
        Close all connections
        """
        self.metadata.close()

    def get_status(self) -> OrmProfilerStatus:
        return self.status
