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
Test MySql connector with CLI
"""
from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class MysqlCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS persons (
        id INT NOT NULL AUTO_INCREMENT,
        varchar_col VARCHAR(255),
        text_col TEXT,
        tinyint_col TINYINT,
        smallint_col SMALLINT,
        mediumint_col MEDIUMINT,
        int_col INT,
        bigint_col BIGINT,
        float_col FLOAT(5,2),
        double_col DOUBLE(5,2),
        decimal_col DECIMAL(5,2),
        date_col DATE,
        datetime_col DATETIME,
        timestamp_col TIMESTAMP,
        time_col TIME,
        year_col YEAR,
        binary_col BINARY(3),
        varbinary_col VARBINARY(3),
        blob_col BLOB(3),
        text2_col TEXT(3),
        enum_col ENUM('value1','value2'),
        set_col SET('value1','value2'),
        PRIMARY KEY (id)
        );
    """

    create_view_query: str = """
        CREATE VIEW view_persons AS
            SELECT *
            FROM openmetadata_db.persons;
    """

    insert_data_queries: List[str] = [
        """
            INSERT INTO persons (id, varchar_col, text_col, tinyint_col, smallint_col, mediumint_col, int_col, bigint_col, float_col, double_col, decimal_col, date_col, datetime_col, timestamp_col, time_col, year_col, binary_col,varbinary_col,blob_col,text2_col,enum_col,set_col) VALUES
            (1,'value1','text1',1,2,3,4,5,6.1,7.2,'8.3', '2023-07-13', '2023-07-13 06:04:45', '2023-07-13 06:04:45', '06:06:45', 2023,X'010203',X'010203',X'010203','text2', 'value1','value1,value2')""",
        """
            INSERT INTO persons (id, varchar_col, text_col, tinyint_col, smallint_col, mediumint_col, int_col, bigint_col, float_col, double_col, decimal_col, date_col, datetime_col, timestamp_col, time_col, year_col, binary_col,varbinary_col,blob_col,text2_col,enum_col,set_col) VALUES
            (2,'value2','text2',11,-12,-13,-14,-15,-16.1,-17.2,'18.3', '2023-09-13', '2023-09-13 06:04:45', '2023-09-13 06:10:45', '06:04:45', 2023,X'040506',X'040506',X'040506','text3', 'value2','value1');
        """,
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
        return 49

    def expected_sample_size(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 22

    def expected_lineage_node(self) -> str:
        return "local_mysql.default.openmetadata_db.view_persons"

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
        return 136

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 136
