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
MSSQL E2E tests
"""

from typing import List

import pytest
import yaml

from metadata.utils.constants import UTF_8

from .common_e2e_sqa_mixins import SQACommonMethods
from .test_cli_db_base_common import CliCommonDB


class MSSQLCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE e2e_cli_tests.dbo.persons (
            person_id int,
            full_name varchar(255),
            birthdate date
        )
    """

    create_view_query: str = """
        CREATE VIEW view_persons AS
            SELECT *
            FROM e2e_cli_tests.dbo.persons;
    """

    insert_data_queries: List[str] = [
        """
    INSERT INTO persons (person_id, full_name, birthdate) VALUES
        (1,'Peter Parker', '2004-08-10'),
        (2,'Bruce Banner', '1988-12-18'),
        (3,'Steve Rogers', '1988-07-04'),
        (4,'Natasha Romanoff', '1997-12-03'),
        (5,'Wanda Maximoff', '1998-02-10'),
        (6,'Diana Prince', '1976-03-17')
        ;
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

    @pytest.mark.order(9999)
    def test_profiler_with_partition(self) -> None:
        processor_config = {
            "processor": {
                "type": "orm-profiler",
                "config": {
                    "tableConfig": [
                        {
                            "fullyQualifiedName": "mssql.e2e_cli_tests.dbo.persons",
                            "partitionConfig": {
                                "enablePartitioning": True,
                                "partitionColumnName": "birthdate",
                                "partitionIntervalType": "TIME-UNIT",
                                "partitionInterval": 30,
                                "partitionIntervalUnit": "YEAR",
                            },
                        }
                    ]
                },
            }
        }

        with open(self.config_file_path, encoding=UTF_8) as config_file:
            config_yaml = yaml.safe_load(config_file)

        config_yaml["source"]["sourceConfig"] = {
            "config": {
                "type": "Profiler",
                "generateSampleData": True,
                "profileSample": 100,
            }
        }

        config_yaml.update(processor_config)
        with open(self.test_file_path, "w", encoding=UTF_8) as test_file:
            yaml.dump(config_yaml, test_file)

        result = self.run_command("profile")

        sample_data = self.retrieve_sample_data(self.fqn_created_table()).sampleData
        assert len(sample_data.rows) == 3

    @staticmethod
    def expected_tables() -> int:
        return 1

    def inserted_rows_count(self) -> int:
        return 3

    @staticmethod
    def fqn_created_table() -> str:
        return "mssql.e2e_cli_tests.dbo.persons"

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
