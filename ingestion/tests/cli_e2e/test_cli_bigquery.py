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
Test Bigquery connector with CLI
"""
from typing import List

from .common_e2e_sqa_mixins import SQACommonMethods
from .test_cli_db_base_common import CliCommonDB


class BigqueryCliTest(CliCommonDB.TestSuite, SQACommonMethods):

    create_table_query: str = """
        CREATE TABLE orders (
            id int,
            order_name varchar(255)
        )
    """

    create_view_query: str = """
        CREATE VIEW view_orders AS
            SELECT *
            FROM openmetadata_db.orders;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO orders (id, order_name) VALUES (1,'XBOX');",
        "INSERT INTO persons (id, order_name) VALUES (2, 'PS5');",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS openmetadata_db.orders;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS openmetadata_db.view_orders;
    """

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def get_connector_name() -> str:
        return "bigquery"

    @staticmethod
    def expected_tables() -> int:
        return 4

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    @staticmethod
    def fqn_created_table() -> str:
        return "local_bigquery.default.openmetadata_db.persons"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["testschema"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["testtable"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["exclude_table"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 2

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 2

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 2

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 2

    @staticmethod
    def expected_filtered_mix() -> int:
        return 4
