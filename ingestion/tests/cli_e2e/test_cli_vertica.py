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
Test Vertica connector with CLI.

Vertica CE image already comes with a sample database `VMart` that
we will use here. If for some reason the data gets lost, it can be
regenerated via: `./opt/vertica/examples/VMart_Schema/vmart_gen`
"""
from typing import List

import pytest

from .common_e2e_sqa_mixins import SQACommonMethods
from .test_cli_db_base import E2EType
from .test_cli_db_base_common import CliCommonDB


class VerticaCliTest(CliCommonDB.TestSuite, SQACommonMethods):

    create_table_query: str = """
        CREATE TABLE vendor_dimension_new AS 
            SELECT * 
            FROM vendor_dimension 
            WHERE 1=0;
    """

    create_view_query: str = """
        CREATE VIEW vendor_dimension_v AS
            SELECT vendor_key, vendor_name
            FROM public.vendor_dimension_new;
    """

    insert_data_queries: List[str] = [
        "INSERT INTO vendor_dimension_new (vendor_key, vendor_name) VALUES (1, 'name');",
        "INSERT INTO vendor_dimension_new (vendor_key, vendor_name) VALUES (2, 'another name');",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS vendor_dimension_new;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS vendor_dimension_v;
    """

    @staticmethod
    def get_connector_name() -> str:
        return "vertica"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 16

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 2

    @staticmethod
    def fqn_created_table() -> str:
        return "e2e_vertica.VMart.public.vendor_dimension_new"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["public.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return [".*dimension.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*fact.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 2

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 5

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 11

    @staticmethod
    def expected_filtered_mix() -> int:
        return 4
