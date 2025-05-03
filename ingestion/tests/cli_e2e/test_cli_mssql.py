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
MSSQL E2E tests
"""

from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class MSSQLCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = 'e2e_cli_tests' AND TABLE_NAME = 'persons')
            BEGIN
                CREATE TABLE e2e_cli_tests.dbo.persons (
                    person_id int,
                    full_name varchar(255),
                    birthdate date,
                    is_meeting_scheduled bit,
                )
            END
    """

    create_view_query: str = """
        CREATE OR ALTER VIEW view_persons AS
            SELECT *
            FROM e2e_cli_tests.dbo.persons;
    """

    insert_data_queries: List[str] = [
        """
    INSERT INTO persons (person_id, full_name, birthdate, is_meeting_scheduled) VALUES
        (1,'Peter Parker', '2004-08-10', 1),
        (2,'Bruce Banner', '1988-12-18', 1),
        (3,'Steve Rogers', '1988-07-04', 0),
        (4,'Natasha Romanoff', '1997-12-03', 1),
        (5,'Wanda Maximoff', '1998-02-10', 1),
        (6,'Diana Prince', '1976-03-17', 0);
    """
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS e2e_cli_tests.dbo.persons;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS view_persons;
    """

    def setUp(self) -> None:
        self.create_table_and_view()

    def tearDown(self) -> None:
        self.delete_table_and_view()

    @staticmethod
    def get_connector_name() -> str:
        return "mssql"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 1

    def expected_sample_size(self) -> int:
        return 6

    def view_column_lineage_count(self) -> int:
        return 4

    def expected_lineage_node(self) -> str:
        return "mssql.e2e_cli_tests.dbo.view_persons"

    @staticmethod
    def fqn_created_table() -> str:
        return "mssql.e2e_cli_tests.dbo.persons"

    @staticmethod
    def get_profiler_time_partition() -> dict:
        return {
            "fullyQualifiedName": "mssql.e2e_cli_tests.dbo.persons",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "birthdate",
                "partitionIntervalType": "TIME-UNIT",
                "partitionInterval": 30,
                "partitionIntervalUnit": "YEAR",
            },
        }

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["dbo"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["persons"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["foo"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 12

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 2

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_mix() -> int:
        return 14

    @staticmethod
    def get_profiler_time_partition_results() -> dict:
        return {
            "table_profile": {
                "columnCount": 4.0,
                "rowCount": 6.0,
            },
            "column_profile": [
                {
                    "person_id": {
                        "distinctCount": 3.0,
                        "distinctProportion": 1.0,
                        "duplicateCount": None,
                        "firstQuartile": 2.5,
                        "histogram": {
                            "boundaries": ["1.000 to 3.773", "3.773 and up"],
                            "frequencies": [1, 2],
                        },
                        "interQuartileRange": 2.0,
                        "max": 5.0,
                        "maxLength": None,
                        "mean": 3.333333,
                        "median": 4.0,
                        "min": 1.0,
                        "minLength": None,
                        "missingCount": None,
                        "missingPercentage": None,
                        "nonParametricSkew": -0.3922324663925032,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "stddev": 1.6996731711975948,
                        "sum": 10.0,
                        "thirdQuartile": 4.5,
                        "uniqueCount": 3.0,
                        "uniqueProportion": 1.0,
                        "validCount": None,
                        "valuesCount": 3.0,
                        "valuesPercentage": None,
                        "variance": None,
                    }
                }
            ],
        }
