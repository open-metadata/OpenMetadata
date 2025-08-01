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
Oracle E2E tests
"""

from typing import List

import pytest

from metadata.ingestion.api.status import Status

from .base.e2e_types import E2EType
from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class OracleCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
       CREATE TABLE admin.admin_emp (
         empno      NUMBER(5) PRIMARY KEY,
         ename      VARCHAR2(15) NOT NULL,
         ssn        NUMBER(9),
         job        VARCHAR2(10),
         mgr        NUMBER(5),
         hiredate   DATE DEFAULT (sysdate),
         photo      BLOB,
         sal        NUMBER(7,2),
         hrly_rate  NUMBER(7,2) GENERATED ALWAYS AS (sal/2080),
         comm       NUMBER(7,2),
         comments   VARCHAR2(3277),
         status     VARCHAR2(10))
   TABLESPACE USERS
   STORAGE ( INITIAL 50K)
    """
    create_view_query: str = """
        CREATE OR REPLACE VIEW admin.admin_emp_view AS SELECT * FROM admin.admin_emp
    """

    insert_data_queries: List[str] = [
        """
        INSERT INTO admin.admin_emp (empno, ename, ssn, job, mgr, sal, comm, comments, status, photo) WITH names AS (
SELECT 1, 'John Doe', 12356789, 'Manager', 121, 5200.0, 5000.0, 'Amazing', 'Active', EMPTY_BLOB() FROM dual UNION ALL
SELECT 2, 'Jane Doe', 123467189, 'Clerk', 131, 503.0, 5000.0, 'Wow', 'Active', EMPTY_BLOB() FROM dual UNION ALL
SELECT 3, 'Jon Doe', 123562789, 'Assistant', 141, 5000.0, 5000.0, 'Nice', 'Active', EMPTY_BLOB() FROM dual
)
SELECT * from names
""",
        """
INSERT INTO admin.admin_emp (empno, ename, ssn, job, mgr, sal, comm, comments, status, photo) WITH names AS (
SELECT 4, 'Jon Doe', 13456789, 'Manager', 151, 5050.0, 5000.0, 'Excellent', 'Active',  UTL_RAW.CAST_TO_RAW('your_binary_data') FROM dual
)
SELECT * from names
""",
    ]

    drop_table_query: str = """
        DROP TABLE admin.admin_emp
    """

    drop_view_query: str = """
        DROP VIEW admin.admin_emp_view
    """

    def create_table_and_view(self) -> None:
        try:
            SQACommonMethods.create_table_and_view(self)
        except Exception:
            pass

    def delete_table_and_view(self) -> None:
        try:
            SQACommonMethods.delete_table_and_view(self)
        except Exception:
            pass

    @staticmethod
    def get_connector_name() -> str:
        return "oracle"

    @staticmethod
    def expected_tables() -> int:
        return 13

    @staticmethod
    def expected_profiled_tables() -> int:
        return 16

    def expected_sample_size(self) -> int:
        # For the admin_emp table
        return 4

    def view_column_lineage_count(self) -> int:
        """view was created from `CREATE VIEW xyz AS (SELECT * FROM abc)`
        which does not propagate column lineage
        """
        return 12

    def expected_lineage_node(self) -> str:
        return "e2e_oracle.default.admin.admin_emp_view"

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_oracle.default.admin.ADMIN_EMP"

    @staticmethod
    def _fqn_deleted_table() -> str:
        return "e2e_oracle.default.admin.ADMIN_EMP"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["^ADMIN$"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["ADMIN_EMP"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["customers"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 43

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 30

    @staticmethod
    def expected_filtered_mix() -> int:
        return 43

    @pytest.mark.order(2)
    def test_create_table_with_profiler(self) -> None:
        # delete table in case it exists
        self.delete_table_and_view()
        # create a table and a view
        self.create_table_and_view()
        # build config file for ingest
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_SCHEMA,
            {"includes": self.get_includes_schemas()},
        )
        # run ingest with new tables
        self.run_command()
        # build config file for profiler
        self.build_config_file(
            E2EType.PROFILER,
            # Otherwise the sampling here does not pick up rows
            extra_args={"profileSample": 1, "includes": self.get_includes_schemas()},
        )
        # run profiler with new tables
        result = self.run_command("profile")
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_table_with_profiler(source_status, sink_status)

    @pytest.mark.order(4)
    def test_delete_table_is_marked_as_deleted(self) -> None:
        """3. delete the new table + deploy marking tables as deleted

        We will perform the following steps:
            1. delete table created in previous test
            2. build config file for ingest
            3. run ingest `self.run_command()` defaults to `ingestion`
        """
        self.delete_table_and_view()
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_SCHEMA,
            {"includes": self.get_includes_schemas()},
        )
        result = self.run_command()

        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_delete_table_is_marked_as_deleted(source_status, sink_status)

    @pytest.mark.order(5)
    def test_schema_filter_includes(self) -> None:
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_MIX,
            {
                "schema": {"includes": self.get_includes_schemas()},
                "table": {
                    "includes": self.get_includes_tables(),
                },
            },
        )
        result = self.run_command()

        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_includes(source_status, sink_status)

    @pytest.mark.order(6)
    def test_schema_filter_excludes(self) -> None:
        pass

    @pytest.mark.order(7)
    def test_table_filter_includes(self) -> None:
        """6. Vanilla ingestion + include table filter pattern

        We will perform the following steps:
            1. build config file for ingest with filters
            2. run ingest `self.run_command()` defaults to `ingestion`
        """
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_MIX,
            {
                "schema": {"includes": self.get_includes_schemas()},
                "table": {"includes": self.get_includes_tables()},
            },
        )
        result = self.run_command()

        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_includes(source_status, sink_status)

    @pytest.mark.order(1)
    def test_vanilla_ingestion(self) -> None:
        """6. Vanilla ingestion

        We will perform the following steps:
            1. build config file for ingest with filters
            2. run ingest `self.run_command()` defaults to `ingestion`
        """
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_SCHEMA,
            {"includes": self.get_includes_schemas()},
        )
        # run ingest with new tables
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_for_vanilla_ingestion(source_status, sink_status)

    @pytest.mark.order(8)
    def test_table_filter_excludes(self) -> None:
        """7. Vanilla ingestion + exclude table filter pattern

        We will perform the following steps:
            1. build config file for ingest with filters
            2. run ingest `self.run_command()` defaults to `ingestion`
        """

        self.build_config_file(
            E2EType.INGEST_DB_FILTER_MIX,
            {
                "schema": {"includes": self.get_includes_schemas()},
                "table": {"excludes": self.get_excludes_tables()},
            },
        )

        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_excludes(source_status, sink_status)

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(source_status.warnings), 0)
        self.assertGreaterEqual(len(source_status.filtered), 29)
        self.assertGreaterEqual(
            (len(source_status.records) + len(source_status.updated_records)),
            self.expected_tables(),
        )
        self.assertEqual(len(sink_status.failures), 0)
        self.assertEqual(len(sink_status.warnings), 0)
        self.assertGreaterEqual(
            (len(sink_status.records) + len(sink_status.updated_records)),
            self.expected_tables(),
        )
