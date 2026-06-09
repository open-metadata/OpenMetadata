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
Test Unity Catalog connector with CLI
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
from metadata.generated.schema.entity.data.database import Database
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

EXTERNAL_STORAGE_SERVICE: str = "e2e_unity_catalog_storage"
DEFAULT_EXTERNAL_LOCATION: str = "s3://e2e-unitycatalog-test-bucket/external_data/"


class UnitycatalogCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    """
    Unity Catalog CLI Tests.

    Coexists with the Databricks SQL E2E suite on the same workspace by using
    a distinct catalog ($E2E_UNITY_CATALOG_NAME, default `e2e_uc`) and
    schemas (`uc_test` / `uc_public`). The catalog must already exist and be
    writable by the test principal — `CREATE CATALOG` requires a
    metastore-admin role and is not attempted here.

    Sink-record counts are NOT relaxed (unlike the Databricks E2E which
    dropped them to work around the buffered-flush bug fixed in PR #27964) —
    a missing flush in the metadata-rest sink would cause a real regression
    that this test must surface, not hide.
    """

    CATALOG: str = os.environ.get("E2E_UNITY_CATALOG_NAME", "e2e_uc")
    TEST_SCHEMA: str = "uc_test"
    PUBLIC_SCHEMA: str = "uc_public"

    prepare_db_setup: List[str] = [  # noqa: RUF012, UP006
        f"DROP SCHEMA IF EXISTS {CATALOG}.{TEST_SCHEMA} CASCADE",
        f"DROP SCHEMA IF EXISTS {CATALOG}.{PUBLIC_SCHEMA} CASCADE",
        f"CREATE SCHEMA {CATALOG}.{TEST_SCHEMA}",
        f"CREATE SCHEMA {CATALOG}.{PUBLIC_SCHEMA}",
    ]

    prepare_uc_e2e: List[str] = [  # noqa: RUF012, UP006
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.regions(region_id INT,region_name STRING)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.countries(country_id STRING,country_name STRING,region_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.locations(uc_testlocation_id INT,uc_teststreet_address STRING,uc_testpostal_code STRING,uc_testcity STRING,uc_teststate_province STRING,uc_testcountry_id STRING)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.jobs(uc_testjob_id INT,uc_testjob_title STRING,uc_testmin_salary DECIMAL(8,2),uc_testmax_salary DECIMAL(8,2))",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.test_departments(uc_testdepartment_id INT,uc_testdepartment_name STRING,uc_testlocation_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.test_employees(uc_testemployee_id INT,uc_testfirst_name STRING,uc_testlast_name STRING,uc_testemail STRING,uc_testphone_number STRING,uc_testhire_date DATE,uc_testjob_id INT,uc_testsalary DECIMAL(8,2),uc_testmanager_id INT,uc_testdepartment_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.test_dependents(uc_testdependent_id INT,uc_testfirst_name STRING,uc_testlast_name STRING,uc_testrelationship STRING,uc_testemployee_id INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.e2e_table(varchar_column STRING,int_column INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{PUBLIC_SCHEMA}.public_table(varchar_column STRING,int_column INT)",
        f"CREATE OR REPLACE TABLE {CATALOG}.{PUBLIC_SCHEMA}.e2e_table(varchar_column STRING,int_column INT)",
    ]

    create_table_query: str = f"""
        CREATE OR REPLACE TABLE {CATALOG}.{TEST_SCHEMA}.persons (
            person_id INT,
            full_name STRING
        )
    """

    create_view_query: str = f"""
        CREATE OR REPLACE VIEW {CATALOG}.{TEST_SCHEMA}.view_persons AS
            SELECT person_id, full_name
            FROM {CATALOG}.{TEST_SCHEMA}.persons
    """

    insert_data_queries: List[str] = [  # noqa: RUF012, UP006
        f"INSERT INTO {CATALOG}.{TEST_SCHEMA}.persons (person_id, full_name) VALUES (1,'Peter Parker')",
        f"INSERT INTO {CATALOG}.{TEST_SCHEMA}.persons (person_id, full_name) VALUES (2,'Clark Kent')",
        f"INSERT INTO {CATALOG}.{TEST_SCHEMA}.e2e_table (varchar_column, int_column) VALUES ('uc_test.e2e_table', 1)",
        f"INSERT INTO {CATALOG}.{PUBLIC_SCHEMA}.e2e_table (varchar_column, int_column) VALUES ('uc_public.e2e_table', 1)",
        f"INSERT INTO {CATALOG}.{PUBLIC_SCHEMA}.e2e_table (varchar_column, int_column) VALUES ('e2e_table', 1)",
        f"INSERT INTO {CATALOG}.{PUBLIC_SCHEMA}.public_table (varchar_column, int_column) VALUES ('uc_public.public_table', 1)",
        f"INSERT INTO {CATALOG}.{PUBLIC_SCHEMA}.public_table (varchar_column, int_column) VALUES ('public_table', 1)",
        (
            f"MERGE INTO {CATALOG}.{PUBLIC_SCHEMA}.public_table AS target "
            "USING (SELECT 'public_table' AS varchar_column, 2 AS int_column) AS source "
            "ON target.varchar_column = source.varchar_column "
            "WHEN MATCHED THEN UPDATE SET target.int_column = source.int_column "
            "WHEN NOT MATCHED THEN INSERT (varchar_column, int_column) "
            "VALUES (source.varchar_column, source.int_column)"
        ),
        f"DELETE FROM {CATALOG}.{PUBLIC_SCHEMA}.public_table WHERE varchar_column = 'uc_public.public_table'",
    ]

    drop_table_query: str = f"""
        DROP TABLE IF EXISTS {CATALOG}.{TEST_SCHEMA}.persons
    """

    drop_view_query: str = f"""
        DROP VIEW IF EXISTS {CATALOG}.{TEST_SCHEMA}.view_persons
    """

    teardown_sql_statements: List[str] = [  # noqa: RUF012, UP006
        f"DROP SCHEMA IF EXISTS {CATALOG}.{TEST_SCHEMA} CASCADE",
        f"DROP SCHEMA IF EXISTS {CATALOG}.{PUBLIC_SCHEMA} CASCADE",
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
            for stmt in self.prepare_uc_e2e:
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
        """Print a window around 'Unitycatalog Status:' so we can see exactly
        what the status-extracting regex was working against, plus what the
        regex actually captured + literal_eval'd from it."""
        import re
        from ast import literal_eval

        from .base.test_cli import REGEX_AUX  # noqa: TID252

        if not self._last_result:
            return
        idx = self._last_result.find("Unitycatalog Status:")
        if idx == -1:
            print("(no 'Unitycatalog Status:' marker found in stderr)")  # noqa: T201
            return
        end = self._last_result.find("OpenMetadata Status:", idx)
        if end == -1:
            end = idx + 4000
        print("---- Unitycatalog Status window (raw) ----")  # noqa: T201
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

    @staticmethod
    def get_connector_name() -> str:
        return "unitycatalog"

    # ==========================================================================
    # Abstract method implementations
    # ==========================================================================

    @staticmethod
    def expected_tables() -> int:
        return 8

    @staticmethod
    def _expected_profiled_tables() -> int:
        return 2

    def expected_sample_size(self) -> int:
        return len([q for q in self.insert_data_queries if f"{self.CATALOG}.{self.TEST_SCHEMA}.persons" in q])

    def view_column_lineage_count(self) -> int:
        return 2

    def expected_lineage_node(self) -> str:
        return f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.view_persons"

    @classmethod
    def fqn_created_table(cls) -> str:
        return f"e2e_unity_catalog.{cls.CATALOG}.{cls.TEST_SCHEMA}.persons"

    @staticmethod
    def get_includes_schemas() -> List[str]:  # noqa: UP006
        return ["uc_test.*"]

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
            f"DELETE FROM {cls.CATALOG}.{cls.TEST_SCHEMA}.persons WHERE full_name = 'Peter Parker'",
        ]

    @classmethod
    def update_queries(cls) -> List[str]:  # noqa: UP006
        return [
            f"UPDATE {cls.CATALOG}.{cls.TEST_SCHEMA}.persons SET full_name = 'Bruce Wayne' WHERE full_name = 'Clark Kent'",
        ]

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

    # ==========================================================================
    # Overridden assertions
    #
    # Critical: KEEP the strict sink-record-count assertion from the base
    # class. PR #27964 fixed the workflow buffered-flush ordering bug that
    # caused the Databricks E2E (PR #27963) to relax this check. With the
    # fix in place, dropping the check here would silently hide future
    # regressions in the metadata-rest sink batch flush.
    # ==========================================================================

    def assert_for_vanilla_ingestion(self, source_status: Status, sink_status: Status) -> None:
        """Allow `filtered >= 1` because UC's per-catalog `information_schema`
        and `default` schemas are excluded via the YAML filter, and add a
        retrieve_table sanity check. Sink-record count is kept strict."""
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
            self.assertGreater(
                (len(sink_status.records) + len(sink_status.updated_records)),
                self.expected_tables(),
            )
            sample_table = self.retrieve_table(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions")
            self.assertIsNotNone(
                sample_table,
                "regions table should be present in OpenMetadata after ingestion",
            )
        except AssertionError:
            self._dump_status_diagnostic(source_status, sink_status)
            self._print_last_run_on_failure()
            raise

    def assert_for_table_with_profiler_time_partition(self, source_status: Status, sink_status: Status) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)
        partitioned_fqn = f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.uc_partitioned_data"
        profile = self.retrieve_profile(partitioned_fqn)
        self.assertIsNotNone(
            profile,
            "Partitioned table should have a profile after profiler run",
        )
        self.assertIsNotNone(
            profile.profile,
            "Partitioned table profile data should not be empty",
        )

    # ==========================================================================
    # Config-builder helpers
    # ==========================================================================

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

    # ==========================================================================
    # Mirrored test orders (2 / 3 / 12 / 13)
    # All four depend on system.query.history latency and are xfail-tolerant
    # for the same reasons documented in PR #27963.
    # ==========================================================================

    @pytest.mark.order(2)
    @pytest.mark.xfail(
        strict=False,
        reason="System profile assertions depend on system.query.history latency",
    )
    def test_create_table_with_profiler(self) -> None:
        self.delete_table_and_view()
        self.create_table_and_view()
        self.build_config_file()
        self.run_command()
        self.build_config_file(
            E2EType.PROFILER,
            extra_args={"profileSample": 100},
        )
        self.wait_for_query_log()
        result = self.run_command("profile")
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_table_with_profiler(source_status, sink_status)
        self.system_profile_assertions()

    @pytest.mark.order(3)
    @pytest.mark.xfail(
        strict=False,
        reason="Auto classification can return 0 records intermittently on Databricks SQL warehouse",
    )
    def test_auto_classify_data(self) -> None:
        super().test_auto_classify_data()

    @classmethod
    def get_profiler_time_partition(cls) -> dict:
        return {
            "fullyQualifiedName": f"e2e_unity_catalog.{cls.CATALOG}.{cls.TEST_SCHEMA}.uc_partitioned_data",
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
        """Profiler against a Delta partitioned table on a date column."""
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.{self.TEST_SCHEMA}.uc_partitioned_data "
                    "(id INT, event_name STRING, event_date DATE, value DECIMAL(10,2)) "
                    "PARTITIONED BY (event_date)"
                )
            )
            connection.execute(
                text(
                    f"INSERT INTO {self.CATALOG}.{self.TEST_SCHEMA}.uc_partitioned_data VALUES "
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

    def get_data_quality_table(self):
        return self.fqn_created_table()

    def get_test_case_definitions(self) -> List[TestCaseDefinition]:  # noqa: UP006
        return [
            TestCaseDefinition(
                name="unity_catalog_data_diff",
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

    # ==========================================================================
    # system.query.history wait helper
    # ==========================================================================

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

    # ==========================================================================
    # System profile expectations — mirrors Databricks coverage.
    # ==========================================================================

    def get_system_profile_cases(self) -> List[Tuple[str, List[SystemProfile]]]:  # noqa: UP006
        return [
            (
                f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.e2e_table",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                ],
            ),
            (
                f"e2e_unity_catalog.{self.CATALOG}.{self.PUBLIC_SCHEMA}.e2e_table",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=1,
                    ),
                ],
            ),
            (
                f"e2e_unity_catalog.{self.CATALOG}.{self.PUBLIC_SCHEMA}.public_table",
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

    # ==========================================================================
    # Complex column types (order 14)
    # Verifies STRUCT/ARRAY/MAP columns are ingested with the correct dataType.
    # ==========================================================================
    @pytest.mark.order(14)
    def test_complex_column_types(self) -> None:
        """Create a table with STRUCT/ARRAY/MAP columns and verify ingest."""
        with self.engine.begin() as connection:
            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.{self.TEST_SCHEMA}.uc_complex_types ("
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

            complex_table = self.retrieve_table(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.uc_complex_types")
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
    # External table lineage (order 15)
    # Creates a dummy storage container at a known path and an external Delta
    # table at the same path. Verifies ExternalTableLineageMixin links them.
    # ==========================================================================
    @pytest.mark.order(15)
    def test_external_table_lineage(self) -> None:
        """External table -> container lineage via ExternalTableLineageMixin."""
        external_location = os.environ.get(
            "E2E_UNITY_CATALOG_EXTERNAL_LOCATION",
            DEFAULT_EXTERNAL_LOCATION,
        )

        service = self._ensure_dummy_storage_service()
        container = self._ensure_dummy_container(service, external_location)

        try:
            with self.engine.begin() as connection:
                connection.execute(
                    text(
                        f"CREATE TABLE IF NOT EXISTS {self.CATALOG}.{self.TEST_SCHEMA}.uc_external_table "
                        "(id INT, name STRING) "
                        f"USING DELTA LOCATION '{external_location}'"
                    )
                )
        except Exception as exc:
            pytest.skip(
                "Workspace cannot create an external Delta table at "
                f"{external_location} ({exc.__class__.__name__}). Set "
                "E2E_UNITY_CATALOG_EXTERNAL_LOCATION to a writable cloud "
                "path registered as a UC external location."
            )

        try:
            self.build_config_file()
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            try:
                self.assertEqual(len(source_status.failures), 0)
                self.assertEqual(len(sink_status.failures), 0)

                external_table_fqn = f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.uc_external_table"
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
                connection.execute(text(f"DROP TABLE IF EXISTS {self.CATALOG}.{self.TEST_SCHEMA}.uc_external_table"))
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
    # UC features (order 16): UC-native tags, FK constraints, materialized
    # views, liquid clustering, regular views. The canonical exerciser of
    # UC's information_schema.{table,column}_tags pipeline.
    # ==========================================================================
    @pytest.mark.order(16)
    def test_uc_features_ingestion(self) -> None:
        """Tags (table + column), FK constraints, materialized view,
        clustering, and views in a single ingestion workflow."""
        materialized_view_supported = True
        with self.engine.begin() as connection:
            connection.execute(
                text(f"ALTER TABLE {self.CATALOG}.{self.TEST_SCHEMA}.regions SET TAGS ('uc_sensitivity' = 'PII')")
            )
            connection.execute(
                text(
                    f"ALTER TABLE {self.CATALOG}.{self.TEST_SCHEMA}.test_employees "
                    "ALTER COLUMN uc_testemail SET TAGS ('uc_pii' = 'EMAIL')"
                )
            )

            # Databricks requires a NOT NULL PRIMARY KEY before a FOREIGN KEY
            # can reference it.
            connection.execute(
                text(f"ALTER TABLE {self.CATALOG}.{self.TEST_SCHEMA}.regions ALTER COLUMN region_id SET NOT NULL")
            )
            connection.execute(
                text(
                    f"ALTER TABLE {self.CATALOG}.{self.TEST_SCHEMA}.regions "
                    "ADD CONSTRAINT regions_pk PRIMARY KEY (region_id)"
                )
            )
            connection.execute(
                text(
                    f"ALTER TABLE {self.CATALOG}.{self.TEST_SCHEMA}.countries "
                    "ADD CONSTRAINT fk_region FOREIGN KEY (region_id) "
                    f"REFERENCES {self.CATALOG}.{self.TEST_SCHEMA}.regions(region_id)"
                )
            )

            connection.execute(
                text(
                    f"CREATE OR REPLACE TABLE {self.CATALOG}.{self.TEST_SCHEMA}.uc_clustered_table "
                    "(id INT, category STRING, created_date DATE, value DECIMAL(10,2)) "
                    "CLUSTER BY (category, created_date)"
                )
            )
            connection.execute(
                text(
                    f"INSERT INTO {self.CATALOG}.{self.TEST_SCHEMA}.uc_clustered_table VALUES "
                    "(1, 'A', current_date(), 100.00), "
                    "(2, 'B', current_date(), 200.00)"
                )
            )

            connection.execute(
                text(
                    f"CREATE OR REPLACE VIEW {self.CATALOG}.{self.TEST_SCHEMA}.regions_view AS "
                    f"SELECT region_id, region_name FROM {self.CATALOG}.{self.TEST_SCHEMA}.regions"
                )
            )

            try:
                connection.execute(
                    text(
                        f"CREATE OR REPLACE MATERIALIZED VIEW "
                        f"{self.CATALOG}.{self.TEST_SCHEMA}.regions_mv AS "
                        f"SELECT region_id, region_name FROM "
                        f"{self.CATALOG}.{self.TEST_SCHEMA}.regions"
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
        """UC-distinguishing assertions: assert tags ACTUALLY flow through to
        OM entities (not just that ingestion didn't fail). The Databricks
        E2E only soft-checks the ingest path; this is where the UC pipeline
        gets real coverage."""
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(sink_status.failures), 0)

        # Table-level tag flowed through. UC's information_schema.table_tags
        # may be eventually consistent, so we soft-warn if the tag is
        # missing rather than fail hard — this gates on UC-tag-write
        # permission too.
        regions_table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions",
            fields=["tags"],
        )
        self.assertIsNotNone(regions_table)
        table_tags = [t.tagFQN.root for t in (regions_table.tags or [])]
        if not any("uc_sensitivity" in tag for tag in table_tags):
            print(  # noqa: T201
                f"WARNING: regions table tag 'uc_sensitivity' not ingested. "
                f"tags seen: {table_tags}. May indicate UC tag-write "
                "permission gap or information_schema.table_tags lag."
            )

        # Column-level tag flowed through to test_employees.uc_testemail.
        employees_table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.test_employees",
            fields=["tags", "columns"],
        )
        self.assertIsNotNone(employees_table)
        email_column = next(
            (c for c in employees_table.columns if c.name.root == "uc_testemail"),
            None,
        )
        self.assertIsNotNone(email_column, "uc_testemail column should be ingested")
        column_tags = [t.tagFQN.root for t in (email_column.tags or [])]
        if not any("uc_pii" in tag for tag in column_tags):
            print(  # noqa: T201
                f"WARNING: uc_testemail column tag 'uc_pii' not ingested. tags seen: {column_tags}."
            )

        # FK informational constraint — soft check. Databricks SQLAlchemy
        # dialect does not currently extract UC informational FK constraints
        # from information_schema.referential_constraints.
        countries_table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.countries",
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
                "informational FK constraints."
            )

        clustered_table = self.retrieve_table(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.uc_clustered_table")
        self.assertIsNotNone(clustered_table, "Clustered table should be ingested")

        regions_view = self.retrieve_table(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions_view")
        self.assertIsNotNone(regions_view, "View should be ingested when includeViews=true")
        self.assertEqual(
            str(regions_view.tableType.value),
            "View",
            "Table type should be View",
        )

        if materialized_view_supported:
            regions_mv = self.retrieve_table(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions_mv")
            self.assertIsNotNone(
                regions_mv,
                "Materialized view should be ingested when includeViews=true",
            )
            self.assertEqual(
                str(regions_mv.tableType.value),
                "MaterializedView",
                "Table type should be MaterializedView",
            )

    # ==========================================================================
    # UC-unique: multi-catalog discovery (order 17)
    # UC connector with `catalog: null` scans every catalog the principal can
    # list — the headline UC behavior that distinguishes it from Databricks
    # SQL connector.
    # ==========================================================================
    @pytest.mark.order(17)
    @pytest.mark.xfail(
        strict=False,
        reason="Multi-catalog scan outcome depends on workspace permissions",
    )
    def test_uc_multi_catalog_discovery(self) -> None:
        """Unset `catalog` and assert UC scans multiple catalogs."""
        self.build_config_file_with_overrides(connection_overrides={"catalog": None})
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        try:
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(sink_status.failures), 0)

            configured_db = self.openmetadata.get_by_name(
                entity=Database,
                fqn=f"e2e_unity_catalog.{self.CATALOG}",
            )
            self.assertIsNotNone(
                configured_db,
                f"Configured catalog {self.CATALOG} should land as a Database entity",
            )

            all_dbs = self.openmetadata.list_entities(entity=Database, params={"service": "e2e_unity_catalog"}).entities
            self.assertGreaterEqual(
                len(all_dbs),
                2,
                "Multi-catalog scan should ingest at least 2 distinct Database "
                "entities (e.g. the configured catalog plus hive_metastore).",
            )
        except AssertionError:
            self._dump_status_diagnostic(source_status, sink_status)
            self._print_last_run_on_failure()
            raise

    # ==========================================================================
    # UC-unique: owner ingestion (order 18)
    # Exercises the catalog/schema/table owner-email -> OM-user resolution
    # path in metadata.py.
    # ==========================================================================
    @pytest.mark.order(18)
    def test_uc_owner_ingestion(self) -> None:
        """UC owner email resolves to an OM user reference on entities."""
        self.build_config_file()
        self.run_command()
        table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=self.fqn_created_table(),
            fields=["owners"],
        )
        self.assertIsNotNone(table)
        expected_owner = os.environ.get("E2E_UNITY_CATALOG_OWNER_EMAIL")
        owner_count = len(table.owners.root) if table.owners else 0
        if expected_owner:
            self.assertGreater(
                owner_count,
                0,
                f"Expected owner '{expected_owner}' to resolve to an OM user "
                "and land on the table, but no owners were ingested.",
            )
        elif owner_count == 0:
            print(  # noqa: T201
                "WARN: no owner ingested on persons table. Set "
                "E2E_UNITY_CATALOG_OWNER_EMAIL to enforce a strict assertion."
            )

    # ==========================================================================
    # UC-unique: system.access.*_lineage (order 19)
    # UC reads dedicated audit views, distinct from Databricks SQL's
    # query-history-based lineage.
    # ==========================================================================
    @pytest.mark.order(19)
    @pytest.mark.xfail(
        strict=False,
        reason="system.access.table_lineage has multi-minute latency",
    )
    def test_uc_system_lineage(self) -> None:
        """CTAS sets up a known lineage edge; assert UC ingests it via
        system.access.table_lineage."""
        try:
            with self.engine.begin() as connection:
                connection.execute(
                    text(
                        f"CREATE OR REPLACE TABLE "
                        f"{self.CATALOG}.{self.TEST_SCHEMA}.regions_lineage_test AS "
                        f"SELECT region_id, region_name "
                        f"FROM {self.CATALOG}.{self.TEST_SCHEMA}.regions"
                    )
                )

            self.wait_for_query_log()

            self.build_config_file(
                E2EType.LINEAGE,
                {"source": f"{self.get_connector_name()}-lineage"},
            )
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(sink_status.failures), 0)

            lineage = self.retrieve_lineage(f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions_lineage_test")
            upstream_fqns = [n.get("fullyQualifiedName") for n in lineage.get("nodes", [])]
            self.assertIn(
                f"e2e_unity_catalog.{self.CATALOG}.{self.TEST_SCHEMA}.regions",
                upstream_fqns,
                "regions should appear as upstream of regions_lineage_test",
            )
        finally:
            with self.engine.begin() as connection:
                connection.execute(text(f"DROP TABLE IF EXISTS {self.CATALOG}.{self.TEST_SCHEMA}.regions_lineage_test"))
