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
Redshift E2E tests
"""
from typing import List, Tuple

from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.api.status import Status

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class RedshiftCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE IF NOT EXISTS e2e_cli_tests.dbt_jaffle.persons (
            person_id int,
            full_name varchar(255),
            birthdate date,
            bigint_col bigint
        )
    """

    create_view_query: str = """
        CREATE OR REPLACE VIEW e2e_cli_tests.dbt_jaffle.view_persons AS
            SELECT *
            FROM e2e_cli_tests.dbt_jaffle.persons;
    """

    insert_data_queries: List[str] = [
        """
    INSERT INTO e2e_cli_tests.dbt_jaffle.persons (person_id, full_name, birthdate, bigint_col) VALUES
        (1,'Peter Parker', '2004-08-10', 9223372036854775807),
        (2,'Bruce Banner', '1988-12-18', 9223372036854775807),
        (3,'Steve Rogers', '1988-07-04', 9223372036854775807),
        (4,'Natasha Romanoff', '1997-12-03', 9223372036854775807),
        (5,'Wanda Maximoff', '1998-02-10', 9223372036854775807),
        (6,'Diana Prince', '1976-03-17', 9000000000000000007);
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

    def assert_for_vanilla_ingestion(
        self, source_status: Status, sink_status: Status
    ) -> None:
        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(source_status.warnings), 0)
        self.assertEqual(len(source_status.filtered), 1)
        self.assertGreaterEqual(
            (len(source_status.records) + len(source_status.updated_records)),
            self.expected_tables(),
        )
        self.assertEqual(len(sink_status.failures), 0)
        self.assertEqual(len(sink_status.warnings), 0)
        self.assertGreater(
            (len(sink_status.records) + len(sink_status.updated_records)),
            self.expected_tables(),
        )

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        from sqlalchemy.exc import OperationalError

        max_retries = 3
        for attempt in range(max_retries):
            try:
                self.engine.dispose()
                with self.engine.connect() as connection:
                    connection.execute(self.drop_view_query)
                    connection.execute(self.drop_table_query)
                break
            except OperationalError as e:
                if "server closed the connection" in str(e) and attempt < max_retries - 1:
                    continue
                raise

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

    def expected_sample_size(self) -> int:
        return 50

    def view_column_lineage_count(self) -> int:
        """
        Gives us the lineage for the view_listing
        """
        return 9

    def expected_lineage_node(self) -> str:
        return "e2e_redshift.e2e_cli_tests.dbt_jaffle.view_listing"

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

    @classmethod
    def get_excludes_schemas(cls) -> List[str]:
        return ["dbt_jaffle", "information_schema"]

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
        return 2

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 6

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 3

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
                        "distinctCount": 21.0,
                        "distinctProportion": 1.0,
                        "duplicateCount": None,
                        "firstQuartile": -430.13,
                        "histogram": {
                            "boundaries": [
                                "-999.630 to -669.291",
                                "-669.291 to -338.952",
                                "-338.952 to -8.613",
                                "-8.613 to 321.726",
                                "321.726 to 652.065",
                                "652.065 and up",
                            ],
                            "frequencies": [3, 6, 6, 1, 1, 4],
                        },
                        "interQuartileRange": 455.69,
                        "max": 856.41,
                        "maxLength": None,
                        "mean": -137.0,
                        "median": -275.85,
                        "min": -999.63,
                        "minLength": None,
                        "missingCount": None,
                        "missingPercentage": None,
                        "nonParametricSkew": 0.26190566403449345,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "stddev": 530.152719345975,
                        "sum": -2882.0,
                        "thirdQuartile": 25.56,
                        "uniqueCount": 21.0,
                        "uniqueProportion": 1.0,
                        "validCount": None,
                        "valuesCount": 21.0,
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

    def get_system_profile_cases(self) -> List[Tuple[str, List[SystemProfile]]]:
        return [
            (
                "e2e_redshift.e2e_cli_tests.dbt_jaffle.persons",
                [
                    SystemProfile(
                        timestamp=Timestamp(root=0),
                        operation=DmlOperationType.INSERT,
                        rowsAffected=6,
                    )
                ],
            )
        ]
