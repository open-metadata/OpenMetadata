#  Copyright 2022 Collate
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
Test Snowflake connector with CLI
"""
from datetime import datetime
from time import sleep
from typing import List, Tuple

import pytest

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.status import Status

from .base.e2e_types import E2EType
from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class SnowflakeCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    """
    Snowflake CLI Tests
    """

    prepare_snowflake_e2e: List[str] = [
        "DROP DATABASE IF EXISTS E2E_DB;",
        "CREATE OR REPLACE DATABASE E2E_DB;",
        "USE E2E_DB;",
        "CREATE OR REPLACE SCHEMA e2e_test;",
        "CREATE OR REPLACE TABLE e2e_test.regions(region_id INT PRIMARY KEY,region_name VARCHAR(25));",
        "CREATE OR REPLACE TABLE e2e_test.countries(country_id CHAR(2) PRIMARY KEY,country_name VARCHAR (40),region_id INT NOT NULL);",
        "CREATE OR REPLACE TABLE e2e_test.locations(e2e_testlocation_id INT PRIMARY KEY,e2e_teststreet_address VARCHAR (40),e2e_testpostal_code VARCHAR (12),e2e_testcity VARCHAR (30) NOT NULL,e2e_teststate_province VARCHAR (25),e2e_testcountry_id CHAR (2) NOT NULL);",
        "CREATE OR REPLACE TABLE e2e_test.jobs(e2e_testjob_id INT PRIMARY KEY,e2e_testjob_title VARCHAR (35) NOT NULL,e2e_testmin_salary DECIMAL (8, 2),e2e_testmax_salary DECIMAL (8, 2));",
        "CREATE OR REPLACE TABLE e2e_test.test_departments(e2e_testdepartment_id INT PRIMARY KEY,e2e_testdepartment_name VARCHAR (30) NOT NULL,e2e_testlocation_id INT);",
        "CREATE OR REPLACE TABLE e2e_test.test_employees(e2e_testemployee_id INT PRIMARY KEY,e2e_testfirst_name VARCHAR (20),e2e_testlast_name VARCHAR (25) NOT NULL,e2e_testemail VARCHAR (100) NOT NULL,e2e_testphone_number VARCHAR (20),e2e_testhire_date DATE NOT NULL,e2e_testjob_id INT NOT NULL,e2e_testsalary DECIMAL (8, 2) NOT NULL,e2e_testmanager_id INT,e2e_testdepartment_id INT);",
        "CREATE OR REPLACE TABLE e2e_test.test_dependents(e2e_testdependent_id INT PRIMARY KEY,e2e_testfirst_name VARCHAR (50) NOT NULL,e2e_testlast_name VARCHAR (50) NOT NULL,e2e_testrelationship VARCHAR (25) NOT NULL,e2e_testemployee_id INT NOT NULL);",
        "CREATE OR REPLACE TABLE e2e_test.e2e_table(varchar_column VARCHAR(255),int_column INT);",
        "CREATE OR REPLACE TABLE public.public_table(varchar_column VARCHAR(255),int_column INT);",
        "CREATE OR REPLACE TABLE public.e2e_table(varchar_column VARCHAR(255),int_column INT);",
    ]

    create_table_query: str = """
        CREATE TABLE E2E_DB.e2e_test.persons (
            person_id int,
            full_name varchar(255)
        )
    """

    create_view_query: str = """
        CREATE VIEW E2E_DB.e2e_test.view_persons AS
            SELECT person_id, full_name
            FROM e2e_test.persons;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO E2E_DB.e2e_test.persons (person_id, full_name) VALUES (1,'Peter Parker');",
        "INSERT INTO E2E_DB.e2e_test.persons (person_id, full_name) VALUES (2, 'Clark Kent');",
        "INSERT INTO e2e_test.e2e_table (varchar_column, int_column) VALUES ('e2e_test.e2e_table', 1);",
        "INSERT INTO public.e2e_table (varchar_column, int_column) VALUES ('public.e2e_table', 1);",
        "INSERT INTO e2e_table (varchar_column, int_column) VALUES ('e2e_table', 1);",
        "INSERT INTO public.public_table (varchar_column, int_column) VALUES ('public.public_table', 1);",
        "INSERT INTO public_table (varchar_column, int_column) VALUES ('public_table', 1);",
        "MERGE INTO public_table USING (SELECT 'public_table' as varchar_column, 2 as int_column) as source ON public_table.varchar_column = source.varchar_column WHEN MATCHED THEN UPDATE SET public_table.int_column = source.int_column WHEN NOT MATCHED THEN INSERT (varchar_column, int_column) VALUES (source.varchar_column, source.int_column);",
        "DELETE FROM public_table WHERE varchar_column = 'public.public_table';",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS E2E_DB.e2e_test.persons;
    """

    drop_view_query: str = """
        DROP VIEW IF EXISTS E2E_DB.e2e_test.view_persons;
    """

    teardown_sql_statements: List[str] = [
        "DROP TABLE IF EXISTS E2E_DB.e2e_test.e2e_table;",
        "DROP TABLE IF EXISTS E2E_DB.public.e2e_table;",
        "DROP TABLE IF EXISTS E2E_DB.public.public_table;",
    ]

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with cls.engine.connect() as connection:
            for stmt in cls.teardown_sql_statements:
                connection.execute(stmt)

    def setUp(self) -> None:
        with self.engine.connect() as connection:
            for sql_statements in self.prepare_snowflake_e2e:
                connection.execute(sql_statements)

    @staticmethod
    def get_connector_name() -> str:
        return "snowflake"

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) == 1)
        self.assertGreaterEqual(
            (len(source_status.records) + len(source_status.updated_records)),
            self.expected_tables(),
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertGreater(
            (len(sink_status.records) + len(sink_status.updated_records)),
            self.expected_tables(),
        )

    def create_table_and_view(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(self.create_table_query)
            for insert_query in self.insert_data_queries:
                connection.execute(insert_query)
            connection.execute(self.create_view_query)
            connection.close()

    def delete_table_and_view(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(self.drop_view_query)
            connection.execute(self.drop_table_query)
            connection.close()

    def delete_table_rows(self) -> None:
        SQACommonMethods.run_delete_queries(self)

    def update_table_row(self) -> None:
        SQACommonMethods.run_update_queries(self)

    @pytest.mark.order(2)
    def test_create_table_with_profiler(self) -> None:
        # delete table in case it exists
        self.delete_table_and_view()
        # create a table and a view
        self.create_table_and_view()
        # build config file for ingest
        self.build_config_file()
        # run ingest with new tables
        self.run_command()
        # build config file for profiler
        self.build_config_file(
            E2EType.PROFILER,
            # Otherwise the sampling here does not pick up rows
            extra_args={"profileSample": 100},
        )
        # wait for query log to be updated
        self.wait_for_query_log()
        # run profiler with new tables
        result = self.run_command("profile")
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_table_with_profiler(source_status, sink_status)
        self.system_profile_assertions()

    @staticmethod
    def expected_tables() -> int:
        return 7

    def expected_sample_size(self) -> int:
        return len(
            [q for q in self.insert_data_queries if "E2E_DB.e2e_test.persons" in q]
        )

    def view_column_lineage_count(self) -> int:
        return 2

    def expected_lineage_node(self) -> str:
        return "e2e_snowflake.E2E_DB.E2E_TEST.VIEW_PERSONS"

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_snowflake.E2E_DB.E2E_TEST.PERSONS"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["e2e_test.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["^test.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*ons"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 2

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 8

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 7

    @staticmethod
    def delete_queries() -> List[str]:
        return [
            """
            DELETE FROM E2E_DB.E2E_TEST.PERSONS WHERE full_name = 'Peter Parker'
            """,
        ]

    @staticmethod
    def update_queries() -> List[str]:
        return [
            """
            UPDATE E2E_DB.E2E_TEST.PERSONS SET full_name = 'Bruce Wayne' WHERE full_name = 'Clark Kent'
            """,
        ]

    def get_system_profile_cases(self) -> List[Tuple[str, List[SystemProfile]]]:
        return [
            (
                "e2e_snowflake.E2E_DB.E2E_TEST.E2E_TABLE",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                ],
            ),
            (
                "e2e_snowflake.E2E_DB.PUBLIC.E2E_TABLE",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    )
                ],
            ),
            (
                "e2e_snowflake.E2E_DB.PUBLIC.PUBLIC_TABLE",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                    SystemProfile(
                        timestamp=Timestamp(root=1),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                    SystemProfile(
                        timestamp=Timestamp(root=2),
                        operation=DmlOperationType.UPDATE,
                        rowsAffected=1,
                    ),
                    SystemProfile(
                        timestamp=Timestamp(root=3),
                        operation=DmlOperationType.DELETE,
                        rowsAffected=1,
                    ),
                ],
            ),
        ]

    @classmethod
    def wait_for_query_log(cls, timeout=600):
        start = datetime.now().timestamp()
        cls.engine.execute("SELECT 'e2e_query_log_wait'")
        latest = 0
        while latest < start:
            sleep(5)
            latest = (
                cls.engine.execute(
                    'SELECT max(start_time) FROM "SNOWFLAKE"."ACCOUNT_USAGE"."QUERY_HISTORY"'
                )
                .scalar()
                .timestamp()
            )
            if (datetime.now().timestamp() - start) > timeout:
                raise TimeoutError(f"Query log not updated for {timeout} seconds")

    def get_data_quality_table(self):
        return self.fqn_created_table()

    def get_test_case_definitions(self) -> List[TestCaseDefinition]:
        return [
            TestCaseDefinition(
                name="snowflake_data_diff",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(
                        name="table2",
                        value=self.get_data_quality_table(),
                    ),
                    TestCaseParameterValue(
                        name="keyColumns",
                        value='["PERSON_ID"]',
                    ),
                ],
            )
        ]

    def get_expected_test_case_results(self):
        return [TestCaseResult(testCaseStatus=TestCaseStatus.Success, timestamp=0)]
