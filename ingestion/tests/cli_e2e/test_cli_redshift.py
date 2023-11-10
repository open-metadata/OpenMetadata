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
Redshift E2E tests
"""

from typing import List

from metadata.generated.schema.entity.data.table import Histogram

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class RedshiftCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS e2e_cli_tests.dbt_jaffle.persons (
            person_id int,
            full_name varchar(255),
            birthdate date
        )
    """

    create_view_query: str = """
        CREATE OR REPLACE VIEW e2e_cli_tests.dbt_jaffle.view_persons AS
            SELECT *
            FROM e2e_cli_tests.dbt_jaffle.persons;
    """

    insert_data_queries: List[str] = [
        """
    INSERT INTO e2e_cli_tests.dbt_jaffle.persons (person_id, full_name, birthdate) VALUES
        (1,'Peter Parker', '2004-08-10'),
        (2,'Bruce Banner', '1988-12-18'),
        (3,'Steve Rogers', '1988-07-04'),
        (4,'Natasha Romanoff', '1997-12-03'),
        (5,'Wanda Maximoff', '1998-02-10'),
        (6,'Diana Prince', '1976-03-17');
    """
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS "e2e_cli_tests"."dbt_jaffle"."persons";
    """

    drop_view_query: str = """
        DROP VIEW IF EXISTS "e2e_cli_tests"."dbt_jaffle"."view_persons";
    """

    def setUp(self) -> None:
        self.create_table_and_view()

    def tearDown(self) -> None:
        self.delete_table_and_view()

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
        return "redshift"

    @staticmethod
    def expected_tables() -> int:
        return 5

    def inserted_rows_count(self) -> int:
        return 50

    def view_column_lineage_count(self) -> int:
        """
        Gives us the lineage for the view_listing
        """
        return 9

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_redshift.e2e_cli_tests.dbt_jaffle.listing"

    @staticmethod
    def _fqn_deleted_table() -> str:
        return "e2e_redshift.e2e_cli_tests.dbt_jaffle.persons"

    @staticmethod
    def get_profiler_time_partition() -> dict:
        return {
            "fullyQualifiedName": "e2e_redshift.e2e_cli_tests.dbt_jaffle.listing",
            "partitionConfig": {
                "enablePartitioning": True,
                "partitionColumnName": "date",
                "partitionIntervalType": "TIME-UNIT",
                "partitionInterval": 5,
                "partitionIntervalUnit": "YEAR",
            },
        }

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["dbt_jaffle"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["customer", "listing"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["foo"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 3

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 45

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 2

    @staticmethod
    def expected_filtered_mix() -> int:
        return 8

    @staticmethod
    def get_profiler_time_partition_results() -> dict:
        return {
            "table_profile": {
                "columnCount": 9.0,
                "rowCount": 101.0,
            },
            "column_profile": [
                {
                    "totalprice": {
                        "distinctCount": 22.0,
                        "distinctProportion": 1.0,
                        "duplicateCount": None,
                        "firstQuartile": -451.0775,
                        "histogram": Histogram(
                            boundaries=[
                                "-999.63 to -665.73",
                                "-665.73 to -331.83",
                                "-331.83 to 2.06",
                                "2.06 to 335.96",
                                "335.96 to 669.86",
                                "669.86 and up",
                            ],
                            frequencies=[3, 7, 6, 1, 2, 3],
                        ),
                        "interQuartileRange": 467.7975,
                        "max": 856.41,
                        "maxLength": None,
                        "mean": -160.16,
                        "median": -288.81,
                        "min": -999.63,
                        "minLength": None,
                        "missingCount": None,
                        "missingPercentage": None,
                        "nonParametricSkew": 0.24351799263849705,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "stddev": 528.297718809555,
                        "sum": -3518.0,
                        "thirdQuartile": 16.72,
                        "uniqueCount": 22.0,
                        "uniqueProportion": 1.0,
                        "validCount": None,
                        "valuesCount": 22.0,
                        "valuesPercentage": None,
                        "variance": None,
                    }
                }
            ],
        }

    @staticmethod
    def delete_queries() -> List[str]:
        return [
            """
            DELETE FROM e2e_cli_tests.dbt_jaffle.persons WHERE person_id IN (1,2)
            """,
        ]

    @staticmethod
    def update_queries() -> List[str]:
        return [
            """
            UPDATE e2e_cli_tests.dbt_jaffle.persons SET full_name = 'Bruce Wayne' WHERE person_id = 3
            """,
        ]
