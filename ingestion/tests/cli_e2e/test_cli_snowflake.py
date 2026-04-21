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
from typing import Any, Dict, List, Optional, Tuple

import pytest
from sqlalchemy import text

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    DmlOperationType,
    SystemProfile,
    Table,
)
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

    prepare_db_setup: List[str] = [
        "DROP DATABASE IF EXISTS E2E_DB;",
        "CREATE OR REPLACE DATABASE E2E_DB;",
    ]

    prepare_snowflake_e2e: List[str] = [
        "CREATE OR REPLACE SCHEMA E2E_DB.e2e_test;",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.regions(region_id INT PRIMARY KEY,region_name VARCHAR(25));",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.countries(country_id CHAR(2) PRIMARY KEY,country_name VARCHAR (40),region_id INT NOT NULL);",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.locations(e2e_testlocation_id INT PRIMARY KEY,e2e_teststreet_address VARCHAR (40),e2e_testpostal_code VARCHAR (12),e2e_testcity VARCHAR (30) NOT NULL,e2e_teststate_province VARCHAR (25),e2e_testcountry_id CHAR (2) NOT NULL);",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.jobs(e2e_testjob_id INT PRIMARY KEY,e2e_testjob_title VARCHAR (35) NOT NULL,e2e_testmin_salary DECIMAL (8, 2),e2e_testmax_salary DECIMAL (8, 2));",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.test_departments(e2e_testdepartment_id INT PRIMARY KEY,e2e_testdepartment_name VARCHAR (30) NOT NULL,e2e_testlocation_id INT);",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.test_employees(e2e_testemployee_id INT PRIMARY KEY,e2e_testfirst_name VARCHAR (20),e2e_testlast_name VARCHAR (25) NOT NULL,e2e_testemail VARCHAR (100) NOT NULL,e2e_testphone_number VARCHAR (20),e2e_testhire_date DATE NOT NULL,e2e_testjob_id INT NOT NULL,e2e_testsalary DECIMAL (8, 2) NOT NULL,e2e_testmanager_id INT,e2e_testdepartment_id INT);",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.test_dependents(e2e_testdependent_id INT PRIMARY KEY,e2e_testfirst_name VARCHAR (50) NOT NULL,e2e_testlast_name VARCHAR (50) NOT NULL,e2e_testrelationship VARCHAR (25) NOT NULL,e2e_testemployee_id INT NOT NULL);",
        "CREATE OR REPLACE TABLE E2E_DB.e2e_test.e2e_table(varchar_column VARCHAR(255),int_column INT);",
        "CREATE OR REPLACE TABLE E2E_DB.public.public_table(varchar_column VARCHAR(255),int_column INT);",
        "CREATE OR REPLACE TABLE E2E_DB.public.e2e_table(varchar_column VARCHAR(255),int_column INT);",
        "CREATE OR REPLACE TRANSIENT TABLE E2E_DB.e2e_test.transient_test_table(id INT, name VARCHAR(100));",
        "CREATE OR REPLACE TRANSIENT TABLE E2E_DB.e2e_test.transient_sample_table(id INT, value VARCHAR(255));",
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
            FROM E2E_DB.e2e_test.persons;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO E2E_DB.e2e_test.persons (person_id, full_name) VALUES (1,'Peter Parker');",
        "INSERT INTO E2E_DB.e2e_test.persons (person_id, full_name) VALUES (2, 'Clark Kent');",
        "INSERT INTO E2E_DB.e2e_test.e2e_table (varchar_column, int_column) VALUES ('e2e_test.e2e_table', 1);",
        "INSERT INTO E2E_DB.public.e2e_table (varchar_column, int_column) VALUES ('public.e2e_table', 1);",
        "INSERT INTO E2E_DB.public.e2e_table (varchar_column, int_column) VALUES ('e2e_table', 1);",
        "INSERT INTO E2E_DB.public.public_table (varchar_column, int_column) VALUES ('public.public_table', 1);",
        "INSERT INTO E2E_DB.public.public_table (varchar_column, int_column) VALUES ('public_table', 1);",
        "MERGE INTO E2E_DB.public.public_table AS target USING (SELECT 'public_table' as varchar_column, 2 as int_column) as source ON target.varchar_column = source.varchar_column WHEN MATCHED THEN UPDATE SET target.int_column = source.int_column WHEN NOT MATCHED THEN INSERT (varchar_column, int_column) VALUES (source.varchar_column, source.int_column);",
        "DELETE FROM E2E_DB.public.public_table WHERE varchar_column = 'public.public_table';",
        "INSERT INTO E2E_DB.e2e_test.transient_test_table (id, name) VALUES (1, 'Test Data');",
        "INSERT INTO E2E_DB.e2e_test.transient_sample_table (id, value) VALUES (1, 'Sample Value');",
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
        "DROP TABLE IF EXISTS E2E_DB.e2e_test.transient_test_table;",
        "DROP TABLE IF EXISTS E2E_DB.e2e_test.transient_sample_table;",
    ]

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with cls.engine.begin() as connection:
            for stmt in cls.teardown_sql_statements:
                connection.execute(text(stmt))

    def setUp(self) -> None:
        with self.engine.begin() as connection:
            for stmt in self.prepare_db_setup:
                connection.execute(text(stmt))
        with self.engine.begin() as connection:
            for stmt in self.prepare_snowflake_e2e:
                connection.execute(text(stmt))

    @staticmethod
    def get_connector_name() -> str:
        return "snowflake"

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertGreaterEqual(len(source_status.filtered), 1)
        self.assertGreaterEqual(
            (len(source_status.records) + len(source_status.updated_records)),
            self.expected_tables(),
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertGreaterEqual(
            (len(sink_status.records) + len(sink_status.updated_records)),
            self.expected_tables(),
        )

    def assert_for_table_with_profiler_time_partition(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)
        partitioned_fqn = "e2e_snowflake.E2E_DB.E2E_TEST.E2E_PARTITIONED_DATA"
        profile = self.retrieve_profile(partitioned_fqn)
        self.assertIsNotNone(
            profile,
            "Partitioned table should have a profile after profiler run",
        )
        self.assertIsNotNone(
            profile.profile,
            "Partitioned table profile data should not be empty",
        )

    def create_table_and_view(self) -> None:
        with self.engine.begin() as connection:
            connection.execute(text(self.create_table_query))
            for insert_query in self.insert_data_queries:
                connection.execute(text(insert_query))
            connection.execute(text(self.create_view_query))

    def delete_table_and_view(self) -> None:
        with self.engine.begin() as connection:
            connection.execute(text(self.drop_view_query))
            connection.execute(text(self.drop_table_query))

    def delete_table_rows(self) -> None:
        SQACommonMethods.run_delete_queries(self)

    def update_table_row(self) -> None:
        SQACommonMethods.run_update_queries(self)

    def build_config_file_with_transient_tables(self, include_transient: bool) -> None:
        """Build config file with includeTransientTables parameter set"""
        import yaml

        self.build_config_file(E2EType.INGEST)

        with open(self.test_file_path, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)

        config["source"]["serviceConnection"]["config"][
            "includeTransientTables"
        ] = include_transient

        with open(self.test_file_path, "w", encoding="utf-8") as file:
            yaml.dump(config, file, default_flow_style=False)

    @pytest.mark.order(2)
    @pytest.mark.xfail(
        strict=False,
        reason="System profile assertions are flaky due to ACCOUNT_USAGE latency",
    )
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

    @pytest.mark.order(3)
    @pytest.mark.xfail(
        strict=False,
        reason="Auto classification returns 0 records intermittently on Snowflake",
    )
    def test_auto_classify_data(self) -> None:
        super().test_auto_classify_data()

    @staticmethod
    def expected_tables() -> int:
        return 8

    @staticmethod
    def _expected_profiled_tables() -> int:
        return 2

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
    def fqn_transient_test_table() -> str:
        return "e2e_snowflake.E2E_DB.E2E_TEST.TRANSIENT_TEST_TABLE"

    @staticmethod
    def fqn_transient_sample_table() -> str:
        return "e2e_snowflake.E2E_DB.E2E_TEST.TRANSIENT_SAMPLE_TABLE"

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
    def wait_for_query_log(cls, timeout=60):
        start = datetime.now().timestamp()
        with cls.engine.connect() as conn:
            conn.execute(text("SELECT 'e2e_query_log_wait'"))
        latest = 0
        while latest < start:
            sleep(5)
            with cls.engine.connect() as conn:
                latest = (
                    conn.execute(
                        text(
                            'SELECT max(start_time) FROM "SNOWFLAKE"."ACCOUNT_USAGE"."QUERY_HISTORY"'
                        )
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

    @pytest.mark.order(13)
    @pytest.mark.xfail(
        strict=False,
        reason="tableDiff test is flaky due to ACCOUNT_USAGE latency",
    )
    def test_data_quality(self) -> None:
        self.wait_for_query_log()
        super().test_data_quality()

    @staticmethod
    def get_profiler_time_partition() -> dict:
        return {
            "fullyQualifiedName": "e2e_snowflake.E2E_DB.E2E_TEST.E2E_PARTITIONED_DATA",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "EVENT_DATE",
                "partitionIntervalType": "TIME-UNIT",
                "partitionInterval": 30,
                "partitionIntervalUnit": "YEAR",
            },
        }

    def build_config_file_for_usage(self) -> None:
        """Build config file for usage ingestion"""
        import yaml

        self.build_config_file(E2EType.INGEST)

        with open(self.test_file_path, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)

        config["source"]["type"] = "snowflake-usage"
        config["source"]["sourceConfig"] = {
            "config": {
                "type": "DatabaseUsage",
                "queryLogDuration": 1,
                "resultLimit": 10000,
            }
        }

        with open(self.test_file_path, "w", encoding="utf-8") as file:
            yaml.dump(config, file, default_flow_style=False)

    def build_config_file_with_overrides(
        self,
        source_config_overrides: Optional[Dict[str, Any]] = None,
        connection_overrides: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Build config file with arbitrary overrides for sourceConfig and/or connection"""
        import yaml

        self.build_config_file(E2EType.INGEST)

        with open(self.test_file_path, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file)

        if source_config_overrides:
            for key, value in source_config_overrides.items():
                config["source"]["sourceConfig"]["config"][key] = value

        if connection_overrides:
            for key, value in connection_overrides.items():
                config["source"]["serviceConnection"]["config"][key] = value

        with open(self.test_file_path, "w", encoding="utf-8") as file:
            yaml.dump(config, file, default_flow_style=False)

    @pytest.mark.order(14)
    def test_transient_tables_included(self) -> None:
        """Test that transient tables ARE ingested when includeTransientTables=true"""
        self.build_config_file_with_transient_tables(include_transient=True)

        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)

        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)

        transient_test_table = self.retrieve_table(self.fqn_transient_test_table())
        transient_sample_table = self.retrieve_table(self.fqn_transient_sample_table())

        self.assertIsNotNone(
            transient_test_table,
            "Transient test table should be ingested when includeTransientTables=true",
        )
        self.assertIsNotNone(
            transient_sample_table,
            "Transient sample table should be ingested when includeTransientTables=true",
        )

        self.assertEqual(
            str(transient_test_table.tableType.value),
            "Transient",
            "Table type should be Transient",
        )
        self.assertEqual(
            str(transient_sample_table.tableType.value),
            "Transient",
            "Table type should be Transient",
        )

        regular_table = self.retrieve_table("e2e_snowflake.E2E_DB.E2E_TEST.REGIONS")
        self.assertIsNotNone(
            regular_table,
            "Regular tables should still be ingested when includeTransientTables=false",
        )

    @pytest.mark.order(15)
    def test_transient_tables_excluded(self) -> None:
        """Test that transient tables are NOT ingested when includeTransientTables=false"""
        self.build_config_file_with_transient_tables(include_transient=False)

        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)

        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)

        transient_test_table = self.retrieve_table(self.fqn_transient_test_table())
        transient_sample_table = self.retrieve_table(self.fqn_transient_sample_table())

        self.assertIsNone(
            transient_test_table,
            "Transient test table should NOT be ingested when includeTransientTables=false",
        )
        self.assertIsNone(
            transient_sample_table,
            "Transient sample table should NOT be ingested when includeTransientTables=false",
        )

        regular_table = self.retrieve_table("e2e_snowflake.E2E_DB.E2E_TEST.REGIONS")
        self.assertIsNotNone(
            regular_table,
            "Regular tables should still be ingested when includeTransientTables=false",
        )

    # ==========================================================================
    # Profiler Time Partition (DB-12)
    # ==========================================================================
    @pytest.mark.order(12)
    @pytest.mark.xfail(
        strict=False,
        reason="Profiler may not produce results for newly created partitioned tables",
    )
    def test_profiler_with_time_partition(self) -> None:
        """Test profiler with time partition on a table with a date column"""
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE OR REPLACE TABLE E2E_DB.e2e_test.e2e_partitioned_data "
                    "(id INT, event_name VARCHAR(255), event_date DATE, "
                    "value DECIMAL(10,2))"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO E2E_DB.e2e_test.e2e_partitioned_data VALUES "
                    "(1, 'Event A', CURRENT_DATE, 100.00), "
                    "(2, 'Event B', DATEADD('DAY', -1, CURRENT_DATE), 200.00), "
                    "(3, 'Event C', DATEADD('DAY', -5, CURRENT_DATE), 300.00)"
                )
            )
        self.build_config_file()
        self.run_command()
        time_partition = self.get_profiler_time_partition()
        processor_config = self.get_profiler_processor_config(time_partition)
        self.build_config_file(
            E2EType.PROFILER_PROCESSOR,
            {
                "processor": processor_config,
                "includes": self.get_includes_schemas(),
            },
        )
        result = self.run_command("profile")
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_table_with_profiler_time_partition(source_status, sink_status)

    # ==========================================================================
    # Snowflake Feature Ingestion (combined test)
    # Creates all Snowflake-specific objects, runs a single ingestion workflow
    # with all features enabled, and validates each feature was ingested.
    # ==========================================================================
    @pytest.mark.order(16)
    def test_snowflake_features_ingestion(self) -> None:
        """Test stored procedures, tags, dynamic tables, streams, constraints,
        and clustering in a single ingestion workflow."""
        # -- 1. Create all Snowflake objects --
        # Stored procedure (requires raw connection for USE DATABASE)
        raw_conn = self.engine.raw_connection()
        try:
            cursor = raw_conn.cursor()
            cursor.execute(
                "CREATE OR REPLACE PROCEDURE E2E_DB.e2e_test.e2e_test_proc() "
                "RETURNS VARCHAR LANGUAGE JAVASCRIPT EXECUTE AS CALLER AS "
                "'return \"hello\";'"
            )
            cursor.close()
            raw_conn.commit()
        finally:
            raw_conn.close()

        with self.engine.begin() as connection:
            # Tag + apply to table
            connection.execute(
                text(
                    "CREATE OR REPLACE TAG E2E_DB.e2e_test.e2e_sensitivity "
                    "ALLOWED_VALUES 'PII', 'PUBLIC'"
                )
            )
            connection.execute(
                text(
                    "ALTER TABLE E2E_DB.e2e_test.regions SET TAG "
                    "E2E_DB.e2e_test.e2e_sensitivity = 'PII'"
                )
            )

            # Dynamic table
            warehouse = connection.execute(text("SELECT CURRENT_WAREHOUSE()")).scalar()
            connection.execute(
                text(
                    f"CREATE OR REPLACE DYNAMIC TABLE E2E_DB.e2e_test.e2e_dynamic_table "
                    f"TARGET_LAG = '1 hour' WAREHOUSE = \"{warehouse}\" "
                    f"AS SELECT region_id, region_name FROM E2E_DB.e2e_test.regions"
                )
            )

            # Stream
            connection.execute(
                text(
                    "CREATE OR REPLACE STREAM E2E_DB.e2e_test.e2e_stream "
                    "ON TABLE E2E_DB.e2e_test.regions"
                )
            )

            # FK constraint
            connection.execute(
                text(
                    "ALTER TABLE E2E_DB.e2e_test.countries ADD CONSTRAINT fk_region "
                    "FOREIGN KEY (region_id) "
                    "REFERENCES E2E_DB.e2e_test.regions(region_id)"
                )
            )

            # Clustered table
            connection.execute(
                text(
                    "CREATE OR REPLACE TABLE E2E_DB.e2e_test.e2e_clustered_table "
                    "(id INT, category VARCHAR(100), created_date DATE, "
                    "value DECIMAL(10,2)) CLUSTER BY (category, created_date)"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO E2E_DB.e2e_test.e2e_clustered_table VALUES "
                    "(1, 'A', CURRENT_DATE, 100.00), "
                    "(2, 'B', CURRENT_DATE, 200.00)"
                )
            )

        # -- 2. Run a single ingestion with all features enabled --
        self.build_config_file_with_overrides(
            source_config_overrides={
                "includeStoredProcedures": True,
                "includeTags": True,
            },
            connection_overrides={
                "includeStreams": True,
            },
        )
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)

        # -- 3. Validate each feature --
        # Stored procedure — queried from ACCOUNT_USAGE.PROCEDURES which
        # has ~2 hour sync latency, so we only verify the ingestion ran
        # without failures (assertion above). The proc entity may not be
        # available immediately after creation.

        # Tags — queried from ACCOUNT_USAGE.TAG_REFERENCES which has
        # ~2 hour sync latency, so tag assertions are skipped here.
        # The includeTags config flag is still exercised above to verify
        # the ingestion path doesn't fail.

        # Dynamic table
        dynamic_table = self.retrieve_table(
            "e2e_snowflake.E2E_DB.E2E_TEST.E2E_DYNAMIC_TABLE"
        )
        self.assertIsNotNone(dynamic_table, "Dynamic table should be ingested")
        self.assertEqual(
            str(dynamic_table.tableType.value),
            "Dynamic",
            "Table type should be Dynamic",
        )

        # Stream
        stream = self.retrieve_table("e2e_snowflake.E2E_DB.E2E_TEST.E2E_STREAM")
        self.assertIsNotNone(
            stream, "Stream should be ingested when includeStreams=true"
        )

        # FK constraint — tableConstraints is a lazy field, request it explicitly
        countries_table = self.openmetadata.get_by_name(
            entity=Table,
            fqn="e2e_snowflake.E2E_DB.E2E_TEST.COUNTRIES",
            fields=["tableConstraints"],
        )
        self.assertIsNotNone(countries_table)
        regions_table = self.retrieve_table("e2e_snowflake.E2E_DB.E2E_TEST.REGIONS")
        self.assertIsNotNone(regions_table)
        self.assertIsNotNone(
            countries_table.tableConstraints,
            "COUNTRIES should have table constraints ingested",
        )
        fk_constraints = [
            c
            for c in countries_table.tableConstraints
            if c.constraintType == ConstraintType.FOREIGN_KEY
            and c.columns
            and "REGION_ID" in c.columns
        ]
        self.assertGreater(
            len(fk_constraints),
            0,
            "COUNTRIES.REGION_ID should have a FOREIGN_KEY constraint referencing REGIONS",
        )
        referred = fk_constraints[0].referredColumns or []
        self.assertTrue(
            any("REGIONS.REGION_ID" in r.root for r in referred),
            f"FK should reference REGIONS.REGION_ID, got: {[r.root for r in referred]}",
        )

        # Clustering / partition detection
        clustered_table = self.retrieve_table(
            "e2e_snowflake.E2E_DB.E2E_TEST.E2E_CLUSTERED_TABLE"
        )
        self.assertIsNotNone(clustered_table, "Clustered table should be ingested")
        self.assertIsNotNone(
            clustered_table.tablePartition,
            "Table should have partition details from clustering key",
        )
        self.assertGreater(
            len(clustered_table.tablePartition.columns),
            0,
            "Should have at least one partition column",
        )
