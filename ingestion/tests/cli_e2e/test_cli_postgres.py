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
Test Postgres connector with CLI
"""
from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class PostgresCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
    CREATE TABLE IF NOT EXISTS public.all_datatypes (
    column1 bigint,
    column2 bigserial,
    column5 boolean,
    column6 character(10),
    column7 character varying(10),
    column8   date,
    column9   double precision,
    column10  integer,
    column11  interval,
    column12  json,
    column13  jsonb,
    column14  numeric(10,2),
    column15  real,
    column16  smallint,
    column17  smallserial,
    column28  serial,
    column29  text,
    column20  time without time zone,
    column21  time with time zone,
    column22  timestamp without time zone,
    column23  timestamp with time zone,
    column24  uuid
);
    """

    create_view_query: str = """
    CREATE OR REPLACE VIEW public.view_all_datatypes AS
        SELECT *
        FROM public.all_datatypes;
    """

    insert_data_queries: List[str] = [
        """
            INSERT INTO public.all_datatypes VALUES (
            1,
            2,
            true,
            'abcdefghij',
            'abcdefghij',
            '2022-08-08',
            1234.5678,
            1234567890,
            '1 day 2 hours 3 minutes 4 seconds'::interval,
            '{"a":1,"b":2}',
            '{"a":1,"b":2}',
            1234.56,
            1234.5678::real,
            32767::smallint,
            32767,
            2147483647,
            'abcdefghij',
            '12:34:56'::time without time zone ,
            '12:34:56+02'::time with time zone ,
            '2022-08-08 12:34:56'::timestamp without time zone ,
            '2022-08-08 12:34:56+02'::timestamp with time zone ,
            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid
   )""",
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS public.all_datatypes;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS public.view_all_datatypes;
    """

    @staticmethod
    def get_connector_name() -> str:
        return "postgres"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 2

    def expected_sample_size(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 22

    def expected_lineage_node(self) -> str:
        return "local_postgres.E2EDB.public.view_all_datatypes"

    @staticmethod
    def fqn_created_table() -> str:
        return "local_postgres.E2EDB.public.all_datatypes"

    @staticmethod
    def get_includes_schemas() -> List[str]:
        return ["public"]

    @staticmethod
    def get_includes_tables() -> List[str]:
        return [".*all_datatypes.*"]

    @staticmethod
    def get_excludes_tables() -> List[str]:
        return [".*test_empty.*"]

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 66

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 0

    @staticmethod
    def expected_filtered_mix() -> int:
        return 2
