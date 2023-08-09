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
Test Postgres connector with CLI
"""
from typing import List

from .common.test_cli_db import CliCommonDB
from .common_e2e_sqa_mixins import SQACommonMethods


class PostgresCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    create_table_query: str = """
        CREATE TABLE all_datatypes (
    column1 bigint,
    column2 bigserial,
    column3 bit,
    column4 bit varying(10),
    column5 boolean,
    column6 box,
    column7 bytea,
    column8 character(10),
    column9 character varying(10),
    column10 cidr,
    column11 circle,
    column12 date,
    column13 double precision,
    column14 inet,
    column15 integer,
    column16 interval,
    column17 json,
    column18 jsonb,
    column19 line,
    column20 lseg,
    column21 macaddr,
    column22 money,
    column23 numeric(10,2),
    column24 path,
    column25 pg_lsn,
    column26 point,
    column27 polygon,
    column28 real,
    column29 smallint,
    column30 smallserial,
    column31 serial,
    column32 text,
    column33 time without time zone,
    column34 time with time zone,
    column35 timestamp without time zone,
    column36 timestamp with time zone,
    column37 uuid,
    column38 xml
);

    """

    create_view_query: str = """
        CREATE VIEW view_all_datatypes AS
            SELECT *
            FROM test_cli_e2e.all_datatypes;
    """

    insert_data_queries: List[str] = [
        """
            INSERT INTO test_cli_e2e.all_datatypes VALUES (
   1, --column1 int8 NULL
   2, --column2 bigserial NOT NULL
   B'1', --column3 bit(1) NULL
   B'1010', --column4 varbit(10) NULL
   true, --column5 bool NULL
   '((0,0),(1,1))', --column6 box NULL
   E'\\\\xDEADBEEF', --column7 bytea NULL
   'abcdefghij', --column8 bpchar(10) NULL
   'abcdefghij', --column9 varchar(10) NULL
   '192.168.100.128/25', --column10 cidr NULL
   '((0,0),5)', --column11 circle NULL
   '2022-08-08', --column12 date NULL
   1234.5678, --column13 float8 NULL
   '192.168.100.128/25', --column14 inet NULL
   1234567890, --column15 int4 NULL
   '1 day 2 hours 3 minutes 4 seconds'::interval, --column16 interval NULL
   '{"a":1,"b":2}', --column17 json NULL
   '{"a":1,"b":2}', --column18 jsonb NULL
   '{1,2,3}', --column19 line NULL
   '((0,0),(1,1))', --column20 lseg NULL
   '08:00:2b:01:02:03', --column21 macaddr NULL
   1234.5678::money, --column22 money NULL
   1234.56, --column23 numeric(10, 2) NULL
   '((0,0),(1,1),(2,2))', --column24 path NULL
   '16/B4D00000', --column25 pg_lsn NULL
   '(4,-5)', --column26 point NULL
   '((0,0),(0,1),(1,1),(1,0))', --column27 polygon NULL
   1234.5678::real, --column28 float4 NULL
   32767::smallint, --column29 int2 NULL
   32767,--column30 smallserial NOT NULL 
   2147483647,--column31 serial4 NOT NULL 
   'abcdefghij', --column32 text NULL 
   '12:34:56'::time without time zone ,--column33 time without time zone 
   '12:34:56+02'::time with time zone ,--column34 timetz 
   '2022-08-08 12:34:56'::timestamp without time zone ,--column35 timestamp without time zone 
   '2022-08-08 12:34:56+02'::timestamp with time zone ,--column36 timestamptz 
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid ,--column37 uuid 
   '<book><title>Manual</title><chapter>...</chapter></book>'::xml-- xml
   )"""*2,
    ]

    drop_table_query: str = """
        DROP TABLE IF EXISTS test_cli_e2e.all_datatypes;
    """

    drop_view_query: str = """
        DROP VIEW  IF EXISTS test_cli_e2e.view_all_datatypes;
    """

    @staticmethod
    def get_connector_name() -> str:
        return "Postgres"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def expected_tables() -> int:
        return 49

    def inserted_rows_count(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 2

    @staticmethod
    def fqn_created_table() -> str:
        return "local_postgres.postgres.public.all_datatypes"

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
        return 52

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 4

    @staticmethod
    def expected_filtered_mix() -> int:
        return 52
