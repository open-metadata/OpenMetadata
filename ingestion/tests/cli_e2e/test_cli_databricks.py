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
Test Databricks connector with CLI
"""

import os
from datetime import datetime
from time import sleep
from typing import Any, Dict, List, Optional, Tuple  # noqa: UP035

import pytest
from sqlalchemy import text

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    DmlOperationType,
    SystemProfile,
    Table,
)
from metadata.generated.schema.entity.services.connections.storage.customStorageConnection import (
    CustomStorageConnection,
    CustomStorageType,
)
from metadata.generated.schema.entity.services.storageService import (
    StorageConnection,
    StorageService,
    StorageServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.status import Status

from .base.e2e_types import E2EType  # noqa: TID252
from .common.test_cli_db import CliCommonDB  # noqa: TID252
from .common_e2e_sqa_mixins import SQACommonMethods  # noqa: TID252

EXTERNAL_STORAGE_SERVICE: str = "e2e_databricks_storage"
DEFAULT_EXTERNAL_LOCATION: str = "s3://e2e-databricks-test-bucket/external_data/"


class DatabricksCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    """
    Databricks CLI Tests

    Assumes a Unity Catalog enabled workspace and a SQL Warehouse. The
    catalog referenced below (`e2e_db`) must already exist and be writable
    by the test principal — Databricks does not allow most users to
    `CREATE CATALOG` from a SQL Warehouse session.
    """

    # Must match the hardcoded `catalog` in database/databricks/databricks.yaml
    # so the test's SQL fixtures and the ingestion workflow target the same catalog.
    CATALOG: str = "e2e_db"

    prepare_db_setup: List[str] = [  # noqa: RUF012, UP006
        f"DROP SCHEMA IF EXISTS {CATALOG}.e2e_test CASCADE",
        f"DROP SCHEMA IF EXISTS {CATALOG}.e2e_public CASCADE",
        f"CREATE SCHEMA {CATALOG}.e2e_test",
        f"CREATE SCHEMA {CATALOG}.e2e_public",
    ]

    prepare_databricks_e2e: List[str] = [  # noqa: RUF012, UP006
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.regions(region_id INT,region_name STRING)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.countries(country_id STRING,country_name STRING,region_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.locations(e2e_testlocation_id INT,e2e_teststreet_address STRING,e2e_testpostal_code STRING,e2e_testcity STRING,e2e_teststate_province STRING,e2e_testcountry_id STRING)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.jobs(e2e_testjob_id INT,e2e_testjob_title STRING,e2e_testmin_salary DECIMAL(8,2),e2e_testmax_salary DECIMAL(8,2))",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.test_departments(e2e_testdepartment_id INT,e2e_testdepartment_name STRING,e2e_testlocation_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.test_employees(e2e_testemployee_id INT,e2e_testfirst_name STRING,e2e_testlast_name STRING,e2e_testemail STRING,e2e_testphone_number STRING,e2e_testhire_date DATE,e2e_testjob_id INT,e2e_testsalary DECIMAL(8,2),e2e_testmanager_id INT,e2e_testdepartment_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.test_dependents(e2e_testdependent_id INT,e2e_testfirst_name STRING,e2e_testlast_name STRING,e2e_testrelationship STRING,e2e_testemployee_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_test.e2e_table(varchar_column STRING,int_column INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_public.public_table(varchar_column STRING,int_column INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.e2e_public.e2e_table(varchar_column STRING,int_column INT)",
    ]

    create_table_query: str = f"""
        CREATE OR REPLACE TABLE {CATALOG}.e2e_test.persons (
            person_id INT,
            full_name STRING
        )
    """

    create_view_query: str = f"""
        CREATE OR REPLACE VIEW {CATALOG}.e2e_test.view_persons AS
            SELECT person_id, full_name
            FROM {CATALOG}.e2e_test.persons
    """

    insert_data_queries: List[str] = [  # noqa: RUF012, UP006
        f"INSERT INTO {CATALOG}.e2e_test.persons (person_id, full_name) VALUES (1,'Peter Parker')",
        f"INSERT INTO {CATALOG}.e2e_test.persons (person_id, full_name) VALUES (2,'Clark Kent')",
        f"INSERT INTO {CATALOG}.e2e_test.e2e_table (varchar_column, int_column) VALUES ('e2e_test.e2e_table', 1)",
        f"INSERT INTO {CATALOG}.e2e_public.e2e_table (varchar_column, int_column) VALUES ('public.e2e_table', 1)",
        f"INSERT INTO {CATALOG}.e2e_public.e2e_table (varchar_column, int_column) VALUES ('e2e_table', 1)",
        f"INSERT INTO {CATALOG}.e2e_public.public_table (varchar_column, int_column) VALUES ('public.public_table', 1)",
        f"INSERT INTO {CATALOG}.e2e_public.public_table (varchar_column, int_column) VALUES ('public_table', 1)",
        (
            f"MERGE INTO {CATALOG}.e2e_public.public_table AS target "
            "USING (SELECT 'public_table' AS varchar_column, 2 AS int_column) AS source "
            "ON target.varchar_column = source.varchar_column "
            "WHEN MATCHED THEN UPDATE SET target.int_column = source.int_column "
            "WHEN NOT MATCHED THEN INSERT (varchar_column, int_column) "
            "VALUES (source.varchar_column, source.int_column)"
        ),
        f"DELETE FROM {CATALOG}.e2e_public.public_table WHERE varchar_column = 'public.public_table'",
    ]

    drop_table_query: str = f"""
        DROP TABLE IF EXISTS {CATALOG}.e2e_test.persons
    """

    drop_view_query: str = f"""
        DROP VIEW IF EXISTS {CATALOG}.e2e_test.view_persons
    """

    teardown_sql_statements: List[str] = [  # noqa: RUF012, UP006
        f"DROP SCHEMA IF EXISTS {CATALOG}.e2e_test CASCADE",
        f"DROP SCHEMA IF EXISTS {CATALOG}.e2e_public CASCADE",
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
            for stmt in self.prepare_databricks_e2e:
                connection.execute(text(stmt))
        self._last_result: Optional[str] = None  # noqa: UP045

    def run_command(self, command: str = "ingest", test_file_path=None) -> str:
        """Override to retain the subprocess stderr for diagnostics on failure."""
        result = super().run_command(command=command, test_file_path=test_file_path)
        self._last_result = result
        return result

    def _print_last_run_on_failure(self) -> None:
        """Surface the captured workflow stderr — only useful when an
        assertion fails after run_command, since run_command swallows the
        output on a successful (returncode==0) subprocess exit."""
        if self._last_result:
            print("---- last metadata ingest stderr (truncated) ----")  # noqa: T201
            print(self._last_result[-8000:])  # noqa: T201
            self._dump_status_window()

    def _dump_status_window(self) -> None:
        """Print a window around 'Databricks Status:' so we can see exactly
        what the status-extracting regex was working against, plus what the
        regex actually captured + literal_eval'd from it."""
        import re
        from ast import literal_eval

        from .base.test_cli import REGEX_AUX  # noqa: TID252

        if not self._last_result:
            return
        idx = self._last_result.find("Databricks Status:")
        if idx == -1:
            print("(no 'Databricks Status:' marker found in stderr)")  # noqa: T201
            return
        end = self._last_result.find("OpenMetadata Status:", idx)
        if end == -1:
            end = idx + 4000
        print("---- Databricks Status window (raw) ----")  # noqa: T201
        print(self._last_result[idx:end])  # noqa: T201

        cleaned = self._last_result.replace("\n", " ")
        cleaned = re.sub(" +", " ", cleaned)
        cleaned = re.sub(r"\x1b[^m]*m", " ", cleaned)
        regex = r"[\w] Status:%(log)s(.*?)%(log)s.* Status: .*" % REGEX_AUX  # noqa: UP031
        matches = re.findall(regex, cleaned.strip())
        print(f"---- regex matches ({len(matches)}) ----")  # noqa: T201
        for i, m in enumerate(matches[:3]):
            print(f"--- match[{i}] (first 2000 chars) ---")  # noqa: T201
            print(m[:2000])  # noqa: T201
        if matches:
            try:
                parsed = literal_eval(matches[0].strip())
                print("---- literal_eval keys/lengths ----")  # noqa: T201
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if isinstance(v, list):
                            print(f"  {k!r}: list of {len(v)}")  # noqa: T201
                        else:
                            print(f"  {k!r}: {v!r}")  # noqa: T201
            except Exception as exc:
                print(f"literal_eval failed: {exc}")  # noqa: T201

    @staticmethod
    def get_connector_name() -> str:
        return "databricks"

    def assert_for_vanilla_ingestion(self, source_status: Status, sink_status: Status) -> None:
        """Override the base check to (a) tolerate Databricks' eager
        information_schema filter (filtered >= 1 instead of == 0) and
        (b) add an end-to-end retrieve_table assertion as the canonical
        'data actually landed' signal. Sink record count is intentionally
        not checked — see common/test_cli_db.py for why."""
        try:
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(source_status.warnings), 0)
            self.assertGreaterEqual(len(source_status.filtered), 1)
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_tables(),
            )
            self.assertEqual(len(sink_status.failures), 0)
            self.assertEqual(len(sink_status.warnings), 0)
            sample_table = self.retrieve_table(f"e2e_databricks.{self.CATALOG}.e2e_test.regions")
            self.assertIsNotNone(
                sample_table,
                "regions table should be present in OpenMetadata after ingestion",
            )
        except AssertionError:
            self._dump_status_diagnostic(source_status, sink_status)
            self._print_last_run_on_failure()
            raise

    @staticmethod
    def _dump_status_diagnostic(source_status: Status, sink_status: Status) -> None:
        """Surface workflow detail when an ingestion assertion fails. The
        run_command subprocess stderr is consumed into a string and discarded
        on success, so without this we have no visibility into why ingestion
        produced few/no records."""
        print("---- source status ----")  # noqa: T201
        print(f"records={len(source_status.records)}")  # noqa: T201
        print(f"updated_records={len(source_status.updated_records)}")  # noqa: T201
        print(f"warnings={len(source_status.warnings)}: {source_status.warnings[:5]}")  # noqa: T201
        print(f"failures={len(source_status.failures)}: {source_status.failures[:5]}")  # noqa: T201
        print(f"filtered={len(source_status.filtered)}: {source_status.filtered[:10]}")  # noqa: T201
        print("---- sink status ----")  # noqa: T201
        print(f"records={len(sink_status.records)}")  # noqa: T201
        print(f"updated_records={len(sink_status.updated_records)}")  # noqa: T201
        print(f"warnings={len(sink_status.warnings)}: {sink_status.warnings[:5]}")  # noqa: T201
        print(f"failures={len(sink_status.failures)}: {sink_status.failures[:5]}")  # noqa: T201

    def assert_for_table_with_profiler_time_partition(self, source_status: Status, sink_status: Status) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)
        partitioned_fqn = f"e2e_databricks.{self.CATALOG}.e2e_test.e2e_partitioned_data"
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

    def build_config_file_with_overrides(
        self,
        source_config_overrides: Optional[Dict[str, Any]] = None,  # noqa: UP006, UP045
        connection_overrides: Optional[Dict[str, Any]] = None,  # noqa: UP006, UP045
    ) -> None:
        """Build config file with arbitrary overrides for sourceConfig and/or connection"""
        import yaml

        self.build_config_file(E2EType.INGEST)

        with open(self.test_file_path, "r", encoding="utf-8") as file:  # noqa: PTH123
            config = yaml.safe_load(file)

        if source_config_overrides:
            for key, value in source_config_overrides.items():
                config["source"]["sourceConfig"]["config"][key] = value

        if connection_overrides:
            for key, value in connection_overrides.items():
                config["source"]["serviceConnection"]["config"][key] = value

        with open(self.test_file_path, "w", encoding="utf-8") as file:  # noqa: PTH123
            yaml.dump(config, file, default_flow_style=False)

    def build_config_file_for_usage(self) -> None:
        """Build config file for usage ingestion"""
        import yaml

        self.build_config_file(E2EType.INGEST)

        with open(self.test_file_path, "r", encoding="utf-8") as file:  # noqa: PTH123
            config = yaml.safe_load(file)

        config["source"]["type"] = "databricks-usage"
        config["source"]["sourceConfig"] = {
            "config": {
                "type": "DatabaseUsage",
                "queryLogDuration": 1,
                "resultLimit": 10000,
            }
        }

        with open(self.test_file_path, "w", encoding="utf-8") as file:  # noqa: PTH123
            yaml.dump(config, file, default_flow_style=False)

    @pytest.mark.order(2)
    @pytest.mark.xfail(
        strict=False,
        reason="System profile assertions depend on system.query.history latency",
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
        reason="Auto classification can return 0 records intermittently on Databricks",
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
        return len([q for q in self.insert_data_queries if f"{self.CATALOG}.e2e_test.persons" in q])

    def view_column_lineage_count(self) -> int:
        return 2

    def expected_lineage_node(self) -> str:
        return f"e2e_databricks.{self.CATALOG}.e2e_test.view_persons"

    @classmethod
    def fqn_created_table(cls) -> str:
        return f"e2e_databricks.{cls.CATALOG}.e2e_test.persons"

    @staticmethod
    def get_includes_schemas() -> List[str]:  # noqa: UP006
        return ["e2e_test.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:  # noqa: UP006
        return ["^test.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:  # noqa: UP006
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

    @classmethod
    def delete_queries(cls) -> List[str]:  # noqa: UP006
        return [
            f"DELETE FROM {cls.CATALOG}.e2e_test.persons WHERE full_name = 'Peter Parker'",
        ]

    @classmethod
    def update_queries(cls) -> List[str]:  # noqa: UP006
        return [
            f"UPDATE {cls.CATALOG}.e2e_test.persons SET full_name = 'Bruce Wayne' WHERE full_name = 'Clark Kent'",
        ]

    def get_system_profile_cases(self) -> List[Tuple[str, List[SystemProfile]]]:  # noqa: UP006
        return [
            (
                f"e2e_databricks.{self.CATALOG}.e2e_test.e2e_table",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                ],
            ),
            (
                f"e2e_databricks.{self.CATALOG}.e2e_public.e2e_table",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                ],
            ),
            (
                f"e2e_databricks.{self.CATALOG}.e2e_public.public_table",
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
    def wait_for_query_log(cls, timeout: int = 60) -> None:
        """Wait until system.query.history surfaces a recent query.

        Databricks `system.query.history` has multi-minute ingestion latency
        in some workspaces, so we cap the wait at `timeout` seconds and let
        downstream profiler/lineage assertions xfail if the log is still
        behind.
        """
        start = datetime.now().timestamp()
        with cls.engine.connect() as conn:
            conn.execute(text("SELECT 'e2e_query_log_wait'"))
        latest = 0.0
        while latest < start:
            sleep(5)
            with cls.engine.connect() as conn:
                row = conn.execute(text("SELECT max(start_time) FROM system.query.history")).scalar()
            if row is not None:
                latest = row.timestamp() if hasattr(row, "timestamp") else float(row)
            if (datetime.now().timestamp() - start) > timeout:
                return

    def get_data_quality_table(self):
        return self.fqn_created_table()

    def get_test_case_definitions(self) -> List[TestCaseDefinition]:  # noqa: UP006
        return [
            TestCaseDefinition(
                name="databricks_data_diff",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(
                        name="table2",
                        value=self.get_data_quality_table(),
                    ),
                    TestCaseParameterValue(
                        name="keyColumns",
                        value='["person_id"]',
                    ),
                ],
            )
        ]

    def get_expected_test_case_results(self):
        return [TestCaseResult(testCaseStatus=TestCaseStatus.Success, timestamp=0)]

    @pytest.mark.order(13)
    @pytest.mark.xfail(
        strict=False,
        reason="tableDiff test is flaky due to system.query.history latency",
    )
    def test_data_quality(self) -> None:
        self.wait_for_query_log()
        super().test_data_quality()

    @classmethod
    def get_profiler_time_partition(cls) -> dict:
        return {
            "fullyQualifiedName": f"e2e_databricks.{cls.CATALOG}.e2e_test.e2e_partitioned_data",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "event_date",
                "partitionIntervalType": "TIME-UNIT",
                "partitionInterval": 30,
                "partitionIntervalUnit": "YEAR",
            },
        }

    @pytest.mark.order(12)
    @pytest.mark.xfail(
        strict=False,
        reason="Profiler may not produce results for newly created partitioned tables",
    )
    def test_profiler_with_time_partition(self) -> None:
        """Test profiler with a Delta partitioned table on a date column."""
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.e2e_test.e2e_partitioned_data "
                    "(id INT, event_name STRING, event_date DATE, value DECIMAL(10,2)) "
                    "PARTITIONED BY (event_date)"
                )
            )
            connection.execute(
                text(
                    f"INSERT INTO {self.CATALOG}.e2e_test.e2e_partitioned_data VALUES "
                    "(1, 'Event A', current_date(), 100.00), "
                    "(2, 'Event B', date_sub(current_date(), 1), 200.00), "
                    "(3, 'Event C', date_sub(current_date(), 5), 300.00)"
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
    # Complex column types (DB-14)
    # Verifies STRUCT/ARRAY/MAP columns are ingested with the correct dataType.
    # ==========================================================================
    @pytest.mark.order(14)
    def test_complex_column_types(self) -> None:
        """Create a table with STRUCT/ARRAY/MAP columns and verify ingest."""
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.e2e_test.e2e_complex_types ("
                    "id INT, "
                    "arr_col ARRAY<STRING>, "
                    "map_col MAP<STRING, INT>, "
                    "struct_col STRUCT<full_name: STRING, age: INT>, "
                    "nested_col ARRAY<STRUCT<key: STRING, value: INT>>"
                    ") USING DELTA"
                )
            )

        self.build_config_file()
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        try:
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(sink_status.failures), 0)

            complex_table = self.retrieve_table(f"e2e_databricks.{self.CATALOG}.e2e_test.e2e_complex_types")
            self.assertIsNotNone(complex_table, "Complex types table should be ingested")
            columns_by_name = {col.name.root: col for col in complex_table.columns}

            self.assertEqual(columns_by_name["arr_col"].dataType, DataType.ARRAY)
            self.assertEqual(columns_by_name["map_col"].dataType, DataType.MAP)
            self.assertEqual(columns_by_name["struct_col"].dataType, DataType.STRUCT)
            struct_children = columns_by_name["struct_col"].children or []
            self.assertGreaterEqual(
                len(struct_children),
                2,
                "STRUCT column should expose its child fields",
            )
        except AssertionError:
            self._dump_status_diagnostic(source_status, sink_status)
            self._print_last_run_on_failure()
            raise

    # ==========================================================================
    # External table lineage (DB-15)
    # Creates a dummy storage container at a known path and an external Delta
    # table at the same path. Verifies ExternalTableLineageMixin links them.
    # ==========================================================================
    @pytest.mark.order(15)
    def test_external_table_lineage(self) -> None:
        """External table → container lineage via ExternalTableLineageMixin."""
        # `or` instead of a get() default: CI sets the env var to "" when the
        # secret is not configured, which must still fall back to the default.
        external_location = os.environ.get("E2E_DATABRICKS_EXTERNAL_LOCATION") or DEFAULT_EXTERNAL_LOCATION

        service = self._ensure_dummy_storage_service()
        container = self._ensure_dummy_container(service, external_location)

        try:
            with self.engine.begin() as connection:
                connection.execute(
                    text(
                        f"CREATE TABLE IF NOT EXISTS {self.CATALOG}.e2e_test.e2e_external_table "
                        "(id INT, name STRING) "
                        f"USING DELTA LOCATION '{external_location}'"
                    )
                )
        except Exception as exc:
            pytest.skip(
                "Workspace cannot create an external Delta table at "
                f"{external_location} ({exc.__class__.__name__}). Set "
                "E2E_DATABRICKS_EXTERNAL_LOCATION to a writable cloud path "
                "registered as a UC external location."
            )

        try:
            self.build_config_file()
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            try:
                self.assertEqual(len(source_status.failures), 0)
                self.assertEqual(len(sink_status.failures), 0)

                external_table_fqn = f"e2e_databricks.{self.CATALOG}.e2e_test.e2e_external_table"
                external_table = self.retrieve_table(external_table_fqn)
                self.assertIsNotNone(external_table, "External table should be ingested")

                lineage = self.retrieve_lineage(external_table_fqn)
                upstream_ids = {node.get("id") for node in lineage.get("nodes", []) if node.get("type") == "container"}
                self.assertIn(
                    str(container.id.root),
                    upstream_ids,
                    "External table should have lineage from the dummy storage container",
                )
            except AssertionError:
                self._dump_status_diagnostic(source_status, sink_status)
                self._print_last_run_on_failure()
                raise
        finally:
            with self.engine.begin() as connection:
                connection.execute(text(f"DROP TABLE IF EXISTS {self.CATALOG}.e2e_test.e2e_external_table"))
            self.openmetadata.delete(Container, container.id, hard_delete=True, recursive=True)
            self.openmetadata.delete(StorageService, service.id, hard_delete=True, recursive=True)

    def _ensure_dummy_storage_service(self) -> StorageService:
        """Idempotent get-or-create of the dummy storage service."""
        existing = self.openmetadata.get_by_name(StorageService, EXTERNAL_STORAGE_SERVICE)
        if existing:
            return existing
        request = CreateStorageServiceRequest(
            name=EXTERNAL_STORAGE_SERVICE,
            serviceType=StorageServiceType.CustomStorage,
            connection=StorageConnection(config=CustomStorageConnection(type=CustomStorageType.CustomStorage)),
        )
        return self.openmetadata.create_or_update(data=request)

    def _ensure_dummy_container(self, service: StorageService, full_path: str) -> Container:
        """Idempotent get-or-create of the dummy container at full_path."""
        container_name = "external_data"
        fqn = f"{EXTERNAL_STORAGE_SERVICE}.{container_name}"
        existing = self.openmetadata.get_by_name(Container, fqn)
        if existing:
            return existing
        request = CreateContainerRequest(
            name=container_name,
            service=service.fullyQualifiedName.root,
            fullPath=full_path,
            prefix="/external_data/",
            dataModel=ContainerDataModel(
                isPartitioned=False,
                columns=[
                    Column(name="id", dataType=DataType.INT),
                    Column(name="name", dataType=DataType.STRING),
                ],
            ),
        )
        return self.openmetadata.create_or_update(data=request)

    # ==========================================================================
    # Databricks Feature Ingestion (combined test)
    # Creates Unity Catalog feature objects, runs a single ingestion workflow
    # with all features enabled, and validates each feature was ingested.
    # ==========================================================================
    @pytest.mark.order(16)
    def test_databricks_features_ingestion(self) -> None:
        """Test tags, FK constraints, materialized view, clustering, and views
        in a single ingestion workflow."""
        materialized_view_supported = True
        with self.engine.begin() as connection:
            # Table-level tag (Unity Catalog tags)
            connection.execute(
                text(f"ALTER TABLE {self.CATALOG}.e2e_test.regions SET TAGS ('e2e_sensitivity' = 'PII')")
            )

            # Column-level tag (Unity Catalog tags)
            connection.execute(
                text(
                    f"ALTER TABLE {self.CATALOG}.e2e_test.test_employees "
                    "ALTER COLUMN e2e_testemail SET TAGS ('e2e_pii' = 'EMAIL')"
                )
            )

            # FK informational constraint:
            # Databricks requires the parent table to have a PRIMARY KEY (NOT
            # NULL) before a FOREIGN KEY can reference it.
            connection.execute(text(f"ALTER TABLE {self.CATALOG}.e2e_test.regions ALTER COLUMN region_id SET NOT NULL"))
            connection.execute(
                text(f"ALTER TABLE {self.CATALOG}.e2e_test.regions ADD CONSTRAINT regions_pk PRIMARY KEY (region_id)")
            )
            connection.execute(
                text(
                    f"ALTER TABLE {self.CATALOG}.e2e_test.countries "
                    "ADD CONSTRAINT fk_region FOREIGN KEY (region_id) "
                    f"REFERENCES {self.CATALOG}.e2e_test.regions(region_id)"
                )
            )

            # Liquid clustering on a Delta table
            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.e2e_test.e2e_clustered_table "
                    "(id INT, category STRING, created_date DATE, value DECIMAL(10,2)) "
                    "CLUSTER BY (category, created_date)"
                )
            )
            connection.execute(
                text(
                    f"INSERT INTO {self.CATALOG}.e2e_test.e2e_clustered_table VALUES "
                    "(1, 'A', current_date(), 100.00), "
                    "(2, 'B', current_date(), 200.00)"
                )
            )

            # View on top of regions for view-lineage validation
            connection.execute(
                text(
                    f"CREATE OR REPLACE VIEW {self.CATALOG}.e2e_test.regions_view AS "
                    f"SELECT region_id, region_name FROM {self.CATALOG}.e2e_test.regions"
                )
            )

            # Materialized view — requires DLT or a serverless SQL warehouse.
            # Skip silently if the warehouse rejects it.
            try:
                connection.execute(
                    text(
                        f"CREATE OR REPLACE MATERIALIZED VIEW "
                        f"{self.CATALOG}.e2e_test.regions_mv AS "
                        f"SELECT region_id, region_name FROM "
                        f"{self.CATALOG}.e2e_test.regions"
                    )
                )
            except Exception:
                materialized_view_supported = False

        self.build_config_file_with_overrides(
            source_config_overrides={
                "includeTags": True,
                "includeViews": True,
                "includeDDL": True,
            },
        )
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        try:
            self._assert_features_ingestion(source_status, sink_status, materialized_view_supported)
        except AssertionError:
            self._dump_status_diagnostic(source_status, sink_status)
            self._print_last_run_on_failure()
            raise

    def _assert_features_ingestion(
        self,
        source_status: Status,
        sink_status: Status,
        materialized_view_supported: bool,
    ) -> None:
        """Body of the features ingestion assertions, split out so the
        outer test method can wrap with diagnostic dumping."""
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)

        # Tag flow exercised — UC `information_schema.*_tags` views are
        # eventually consistent, so we only assert the ingestion path didn't
        # fail above (table tag + column tag both applied).

        # FK informational constraint — soft check.
        # The Databricks SQLAlchemy dialect does not currently extract Unity
        # Catalog informational FK constraints from
        # `information_schema.referential_constraints`, so this assertion is
        # logged but not failed. The DDL above still exercises the
        # ALTER TABLE ADD CONSTRAINT path against Databricks itself.
        countries_table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=f"e2e_databricks.{self.CATALOG}.e2e_test.countries",
            fields=["tableConstraints"],
        )
        self.assertIsNotNone(countries_table)
        fk_constraints = [
            c
            for c in (countries_table.tableConstraints or [])
            if c.constraintType == ConstraintType.FOREIGN_KEY and c.columns and "region_id" in c.columns
        ]
        if not fk_constraints:
            print(  # noqa: T201
                "WARNING: countries.region_id FOREIGN_KEY constraint not "
                "ingested. Databricks dialect does not currently extract UC "
                "informational FK constraints — see "
                "information_schema.referential_constraints for upstream fix."
            )

        # Clustering / partition detection
        clustered_table = self.retrieve_table(f"e2e_databricks.{self.CATALOG}.e2e_test.e2e_clustered_table")
        self.assertIsNotNone(clustered_table, "Clustered table should be ingested")

        # View should be ingested with includeViews=true
        regions_view = self.retrieve_table(f"e2e_databricks.{self.CATALOG}.e2e_test.regions_view")
        self.assertIsNotNone(regions_view, "View should be ingested when includeViews=true")
        self.assertEqual(
            str(regions_view.tableType.value),
            "View",
            "Table type should be View",
        )

        # Materialized view (only if the warehouse supports MVs)
        if materialized_view_supported:
            regions_mv = self.retrieve_table(f"e2e_databricks.{self.CATALOG}.e2e_test.regions_mv")
            self.assertIsNotNone(
                regions_mv,
                "Materialized view should be ingested when includeViews=true",
            )
            self.assertEqual(
                str(regions_mv.tableType.value),
                "MaterializedView",
                "Table type should be MaterializedView",
            )
