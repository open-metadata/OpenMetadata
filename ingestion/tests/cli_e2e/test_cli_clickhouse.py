#  Copyright 2022 Collate
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
Test Clickhouse connector with CLI
"""
from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class ClickhouseCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE default.Persons2
        (

            `person_id` Int32,

            `LastName` String,

            `full_name` String,

            `Address` String,

            `City` String
        )
        ENGINE = Memory
        COMMENT 'TEST COMMENT';
    """
    create_view_query: str = """
        CREATE VIEW view_persons AS
            SELECT *
            FROM default.Persons2;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO Persons2 (person_id, full_name) VALUES (1,'Peter Parker');",
        "INSERT INTO Persons2 (person_id, full_name) VALUES (1, 'Clark Kent');",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS default.Persons2;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS default.view_persons;
    """

    @staticmethod
    def get_connector_name() -> str:
        return "clickhouse"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 49

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 2

    @staticmethod
    def fqn_created_table() -> str:
        return "local_clickhouse.default.default.persons2"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["default.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["test.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*Persons.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 0

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 48

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 48
