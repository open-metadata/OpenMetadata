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
Test Redshift connector with CLI
"""
from typing import List

from .test_cli_dbt_base import CliDBTBase
from metadata.ingestion.api.workflow import Workflow


class DbtCliTest(CliDBTBase.TestSuite):

    engine: Engine

    @classmethod
    def setUpClass(cls) -> None:
        connector = cls.get_connector_name()
        workflow: Workflow = cls.get_workflow(connector)
        cls.engine = workflow.source.engine
        cls.openmetadata = workflow.source.metadata
        cls.config_file_path = str(
            Path(PATH_TO_RESOURCES + f"/database/{connector}/{connector}.yaml")
        )
        cls.test_file_path = str(
            Path(PATH_TO_RESOURCES + f"/database/{connector}/test.yaml")
        )

    def tearDown(self) -> None:
        self.engine.dispose()

    @staticmethod
    def get_connector_name() -> str:
        return "redshift"

    @staticmethod
    def expected_tables() -> int:
        return 2

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    @staticmethod
    def fqn_created_table() -> str:
        return "local_redshift.dev.exclude_me.orders"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["exclude_me", "dbt_jaffle"]
    
    @staticmethod
    def get_excludes_schemas() -> List[str]:
        return ["sample_data"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return ["customers"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return ["boolean_test"]

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
        return 1

    @staticmethod
    def expected_filtered_mix() -> int:
        return 1
