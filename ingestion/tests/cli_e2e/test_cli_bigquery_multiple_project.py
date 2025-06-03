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
Test Bigquery connector with CLI
"""
from typing import List

from metadata.ingestion.api.status import Status

from .base.e2e_types import E2EType
from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class BigqueryCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS `modified-leaf-330420.do_not_touch`.orders (
            id int,
            order_name string
        )
    """

    create_view_query: str = """
       CREATE VIEW IF NOT EXISTS `modified-leaf-330420.do_not_touch.view_orders` AS
                     SELECT orders.id as id, orders.order_name as order_name
                       FROM `modified-leaf-330420`.do_not_touch.orders;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO `modified-leaf-330420.do_not_touch`.orders (id, order_name) VALUES (1,'XBOX');",
        "INSERT INTO `modified-leaf-330420.do_not_touch`.orders (id, order_name) VALUES (2,'PS');",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS `modified-leaf-330420.do_not_touch`.orders;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS `modified-leaf-330420.do_not_touch`.view_orders;
    """

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    def delete_table_rows(self) -> None:
        SQACommonMethods.run_delete_queries(self)

    def update_table_row(self) -> None:
        SQACommonMethods.run_update_queries(self)

    @staticmethod
    def get_connector_name() -> str:
        return "bigquery_multiple_project"

    @staticmethod
    def get_service_type() -> str:
        return "bigquery"

    @staticmethod
    def expected_tables() -> int:
        return 2

    def expected_sample_size(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 2

    def expected_lineage_node(self) -> str:
        return "local_bigquery_multiple.modified-leaf-330420.do_not_touch.view_orders"

    @staticmethod
    def _expected_profiled_tables() -> int:
        return 2

    @staticmethod
    def fqn_created_table() -> str:
        return "local_bigquery_multiple.modified-leaf-330420.do_not_touch.orders"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["do_not_touch"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["exclude_table"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["testtable"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 9

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 2

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 17

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 18

    @staticmethod
    def expected_filtered_mix() -> int:
        return 19

    @staticmethod
    def delete_queries() -> List[str]:
        return [
            """
            DELETE FROM `modified-leaf-330420.do_not_touch`.orders WHERE id IN (1)
            """,
        ]

    @staticmethod
    def update_queries() -> List[str]:
        return [
            """
            UPDATE `modified-leaf-330420.do_not_touch`.orders SET order_name = 'NINTENDO' WHERE id = 2
            """,
        ]

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertTrue(len(source_status.failures) == 0)
        self.assertTrue(len(source_status.warnings) == 0)
        self.assertTrue(len(source_status.filtered) >= 9)
        self.assertTrue(
            (len(source_status.records) + len(source_status.updated_records))
            >= self.expected_tables()
        )
        self.assertTrue(len(sink_status.failures) == 0)
        self.assertTrue(len(sink_status.warnings) == 0)
        self.assertTrue(
            (len(sink_status.records) + len(sink_status.updated_records))
            > self.expected_tables()
        )

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

    def test_schema_filter_excludes(self) -> None:
        self.build_config_file(
            E2EType.INGEST_DB_FILTER_MIX,
            {
                "schema": {"excludes": self.get_includes_schemas()},
                "table": {
                    "excludes": self.get_excludes_tables(),
                },
            },
        )
        result = self.run_command()

        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_schemas_excludes(source_status, sink_status)

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
                "table": {"excludes": self.get_includes_tables()},
            },
        )

        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_excludes(source_status, sink_status)
