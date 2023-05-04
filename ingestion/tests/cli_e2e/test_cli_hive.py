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
Hive E2E tests
"""

from typing import List

from metadata.generated.schema.entity.data.table import Histogram

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class HiveCliTest(CliCommonDB.TestSuite, SQACommonMethods):
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
        return 4

    def inserted_rows_count(self) -> int:
        return 100

    def view_column_lineage_count(self) -> int:
        """view was created from `CREATE VIEW xyz AS (SELECT * FROM abc)`
        which does not propagate column lineage
        """
        return None

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_hive.default.e2e_cli_tests.listing"

    @staticmethod
    def _fqn_deleted_table() -> str:
        return "e2e_hive.default.e2e_cli_tests.persons"

    @staticmethod
    def get_profiler_time_partition() -> dict:
        return {
            "fullyQualifiedName": "e2e_hive.default.e2e_cli_tests.listing",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "event_date",
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
        return ["iris", "listing"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["foo"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 5

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 3

    @staticmethod
    def expected_filtered_mix() -> int:
        return 3

    @staticmethod
    def get_profiler_time_partition_results() -> dict:
        return {
            "table_profile": {
                "columnCount": 9.0,
                "rowCount": 7.0,
            },
            "column_profile": [
                {
                    "totalprice": {
                        "distinctCount": 6.0,
                        "distinctProportion": 0.8571428571428571,
                        "duplicateCount": None,
                        "firstQuartile": -159.0,
                        "histogram": Histogram(
                            boundaries=[
                                "-336.75 to -59.17",
                                "-59.17 to 218.42",
                                "218.42 to 496.00",
                                "496.00 to 773.59",
                                "773.59 and up",
                            ],
                            frequencies=[4, 2, 0, 0, 1],
                        ),
                        "interQuartileRange": 265.5,
                        "max": 822.52,
                        "maxLength": None,
                        "mean": 44.70285714285714,
                        "median": -68.0,
                        "min": -336.75,
                        "minLength": None,
                        "missingCount": None,
                        "missingPercentage": None,
                        "nonParametricSkew": 0.31787292678406753,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "stddev": 354.5531803638524,
                        "sum": 313.0,
                        "thirdQuartile": 106.5,
                        "uniqueCount": 5.0,
                        "uniqueProportion": 0.7142857142857143,
                        "validCount": None,
                        "valuesCount": 7.0,
                        "valuesPercentage": None,
                        "variance": None,
                    }
                }
            ],
        }
