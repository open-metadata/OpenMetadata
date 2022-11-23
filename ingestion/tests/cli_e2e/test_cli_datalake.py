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
Test Datalake connector with CLI
"""
from typing import List

from .common_e2e_sqa_mixins import SQACommonMethods
from .test_cli_db_base_common import CliCommonDB


class DatalakeCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    @staticmethod
    def get_connector_name() -> str:
        return "Datalake"

    @staticmethod
    def expected_tables() -> int:
        return 44

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    @staticmethod
    def fqn_created_table() -> str:
        return "local_datalake.default.openmetadata_db.persons"

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
        return 44

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 44
