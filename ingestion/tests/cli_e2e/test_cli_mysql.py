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
Test MySql connector with CLI
"""
from typing import List

from .common_e2e_sqa_mixins import SQACommonMethods
from .test_cli_db_base_common import CliCommonDB


class MysqlCliTest(CliCommonDB.TestSuite, SQACommonMethods):

    create_table_query: str = """
        CREATE TABLE persons (
            person_id int,
            full_name varchar(255)
        )
    """

    create_view_query: str = """
        CREATE VIEW view_persons AS
            SELECT *
            FROM openmetadata_db.persons;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO persons (person_id, full_name) VALUES (1,'Peter Parker');",
        "INSERT INTO persons (person_id, full_name) VALUES (1, 'Clark Kent');",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS openmetadata_db.persons;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS openmetadata_db.view_persons;
    """

    @staticmethod
    def get_connector_name() -> str:
        return "mysql"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 45

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 2

    @staticmethod
    def fqn_created_table() -> str:
        return "local_mysql.default.openmetadata_db.persons"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["openmetadata_db.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["entity_*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*bot.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 0

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 45

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 45
