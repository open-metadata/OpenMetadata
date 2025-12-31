#  Copyright 2025 Collate
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
StarRocks E2E CLI tests
"""
from typing import List

from .common.common_e2e_sqa_mixins import SQACommonMethods
from .common.test_cli_db import CliCommonDB


class StarRocksCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    """
    StarRocks CLI E2E test class
    """

    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS test_db.persons (
            id INT,
            varchar_col VARCHAR(255),
            int_col INT,
            bigint_col BIGINT,
            float_col FLOAT,
            double_col DOUBLE,
            decimal_col DECIMAL(10, 2),
            date_col DATE,
            datetime_col DATETIME,
            boolean_col BOOLEAN,
            json_col JSON
        ) ENGINE=OLAP
        PRIMARY KEY(id)
        DISTRIBUTED BY HASH(id) BUCKETS 3
        PROPERTIES ("replication_num" = "1");
    """

    create_view_query: str = """
        CREATE VIEW IF NOT EXISTS test_db.view_persons AS
        SELECT id, varchar_col, int_col FROM test_db.persons;
    """

    insert_data_queries: List[str] = [
        """INSERT INTO test_db.persons VALUES
            (1, 'Alice', 100, 1000000, 1.5, 2.5, 123.45, '2024-01-01', '2024-01-01 10:00:00', true, '{"key": "value1"}')""",
        """INSERT INTO test_db.persons VALUES
            (2, 'Bob', 200, 2000000, 2.5, 3.5, 234.56, '2024-01-02', '2024-01-02 11:00:00', false, '{"key": "value2"}')""",
    ]

    drop_table_query: str = "DROP TABLE IF EXISTS test_db.persons;"
    drop_view_query: str = "DROP VIEW IF EXISTS test_db.view_persons;"

    @staticmethod
    def get_connector_name() -> str:
        return "starrocks"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 10

    def expected_sample_size(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 3

    def expected_lineage_node(self) -> str:
        return "local_starrocks.default.test_db.view_persons"

    @staticmethod
    def fqn_created_table() -> str:
        return "local_starrocks.default.test_db.persons"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["test_db.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["person*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*view.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 0

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 1
