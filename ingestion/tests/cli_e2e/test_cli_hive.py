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
Hive E2E tests
"""

from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class HiveCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    prepare_e2e: List[str] = [
        "DROP DATABASE IF EXISTS e2e_cli_tests CASCADE",
        "CREATE DATABASE e2e_cli_tests",
        """
        CREATE TABLE IF NOT EXISTS e2e_cli_tests.persons_profile (
            person_id int,
            full_name varchar(255),
            birthdate date
        )
        """,
        """
        INSERT INTO e2e_cli_tests.persons_profile (person_id, full_name, birthdate) VALUES
            (1,'Peter Parker', '2004-08-10'),
            (2,'Bruce Banner', '1988-12-18'),
            (3,'Steve Rogers', '1988-07-04'),
            (4,'Natasha Romanoff', '1997-12-03'),
            (5,'Wanda Maximoff', '1998-02-10'),
            (6,'Diana Prince', '1976-03-17')
        """,
    ]

    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS e2e_cli_tests.persons (
            person_id int,
            full_name varchar(255),
            birthdate date
        )
    """

    create_view_query: str = """
        CREATE OR REPLACE VIEW e2e_cli_tests.view_persons AS
            SELECT *
            FROM e2e_cli_tests.persons
    """

    insert_data_queries: List[str] = [
        """
    INSERT INTO e2e_cli_tests.persons (person_id, full_name, birthdate) VALUES
        (1,'Peter Parker', '2004-08-10'),
        (2,'Bruce Banner', '1988-12-18'),
        (3,'Steve Rogers', '1988-07-04'),
        (4,'Natasha Romanoff', '1997-12-03'),
        (5,'Wanda Maximoff', '1998-02-10'),
        (6,'Diana Prince', '1976-03-17')
    """
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS e2e_cli_tests.persons
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS e2e_cli_tests.view_persons
    """

    def setUp(self) -> None:
        with self.engine.connect() as connection:
            for sql_statements in self.prepare_e2e:
                connection.execute(sql_statements)

        self.create_table_and_view()

    def tearDown(self) -> None:
        self.delete_table_and_view()

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def get_connector_name() -> str:
        return "hive"

    @staticmethod
    def expected_tables() -> int:
        return 3

    def expected_sample_size(self) -> int:
        # For the persons table
        return 6

    def view_column_lineage_count(self) -> int:
        """view was created from `CREATE VIEW xyz AS (SELECT * FROM abc)`
        which does not propagate column lineage
        """
        return 3

    def expected_lineage_node(self) -> str:
        return "e2e_hive.default.e2e_cli_tests.view_persons"

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_hive.default.e2e_cli_tests.persons_profile"

    @staticmethod
    def _fqn_deleted_table() -> str:
        return "e2e_hive.default.e2e_cli_tests.view_persons"

    @staticmethod
    def get_profiler_time_partition() -> dict:
        return {
            "fullyQualifiedName": "e2e_hive.default.e2e_cli_tests.persons_profile",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "birthdate",
                "partitionIntervalType": "TIME-UNIT",
                "partitionInterval": 50,
                "partitionIntervalUnit": "YEAR",
            },
        }

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["e2e_cli_tests"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["persons"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["my_table"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 2

    @staticmethod
    def expected_filtered_mix() -> int:
        return 2

    @staticmethod
    def get_profiler_time_partition_results() -> dict:
        return {
            "table_profile": {
                "columnCount": 3.0,
                "rowCount": 6.0,
            },
            "column_profile": [
                {
                    "person_id": {
                        "valuesCount": 6,
                        "valuesPercentage": None,
                        "validCount": None,
                        "duplicateCount": None,
                        "nullCount": 0,
                        "nullProportion": 0,
                        "missingPercentage": None,
                        "missingCount": None,
                        "uniqueCount": 6,
                        "uniqueProportion": 1,
                        "distinctCount": 6,
                        "distinctProportion": 1,
                        "min": 1,
                        "max": 6,
                        "minLength": None,
                        "maxLength": None,
                        "mean": 3.5,
                        "sum": 21,
                        "stddev": 1.707825127659933,
                        "variance": None,
                        "median": 3.5,
                        "firstQuartile": 2.25,
                        "thirdQuartile": 4.75,
                        "interQuartileRange": 2.5,
                        "nonParametricSkew": 0,
                        "histogram": {
                            "boundaries": ["1.00 to 3.75", "3.75 and up"],
                            "frequencies": [3, 3],
                        },
                    }
                }
            ],
        }
