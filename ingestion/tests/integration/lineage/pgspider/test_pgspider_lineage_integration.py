#  Copyright 2021 Collate
#  Copyright(c) 2023, TOSHIBA CORPORATION
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
PGSpider Lineage Integration Test
"""
import json
import textwrap
from pathlib import Path
from unittest import TestCase

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.pgspider.lineage import PgspiderLineageSource

PGSPIDER_DROP_MULTI_TENANT_TABLES = textwrap.dedent(
    """
      DROP FOREIGN TABLE test1;
      DROP FOREIGN TABLE test2;
    """
)

PGSPIDER_CREATE_MULTI_TENANT_TABLES = textwrap.dedent(
    """
      CREATE FOREIGN TABLE test1 (i int, __spd_url text) SERVER pgspider_svr;
      CREATE FOREIGN TABLE test2 (a int, b text, c int, __spd_url text) SERVER pgspider_svr;
    """
)

EXPECTED_MULTI_TENANT_TABLES = [
    {"relname": "test1", "nspname": "public", "database": "pgspider"},
    {"relname": "test2", "nspname": "public", "database": "pgspider"},
]

EXPECTED_CHILD_TABLES_1 = [
    {"relname": "test1__post_svr__0"},
    {"relname": "test1__post_svr__1"},
]

EXPECTED_CHILD_TABLES_2 = [{"relname": "test2__post_svr__0"}]

config_file_path = Path(__file__).parent / "config/pgspider.json"
with open(config_file_path, encoding="utf-8") as file:
    config_data = json.load(file)


class PGSpiderLineageIntegrationTest(TestCase):
    """
    Validate get_multi_tenant_tables and get_child_tables
    for PGSpider Lineage
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        config = OpenMetadataWorkflowConfig.parse_obj(config_data)
        self.pgspider = PgspiderLineageSource.create(
            config_data["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    def test_get_multi_tenant_tables_1(self):
        """
        Verify normal case of get_multi_tenant_tables function: Multi tenant tables exist in remote PGSpider
        Expect: return correct list of multi tenant tables
        """

        records = self.pgspider.get_multi_tenant_tables()

        tables = []
        for record in records:
            record = dict(record)
            tables.append(record)

        """Validate number of tables"""
        self.assertEqual(len(EXPECTED_MULTI_TENANT_TABLES), len(tables))

        """Validate each table"""
        for _, (expected, original) in enumerate(
            zip(EXPECTED_MULTI_TENANT_TABLES, tables)
        ):
            self.assertEqual(expected, original)

    def test_get_multi_tenant_tables_2(self):
        """
        Verify abnormal case of get_multi_tenant_tables function: No multi tenant table exists in remote PGSpider
        Expect: return empty list with 0 element
        """

        """Get connection"""
        conn = get_connection(self.pgspider.service_connection).connect()

        """Drop multi-tenant tables"""
        sql = PGSPIDER_DROP_MULTI_TENANT_TABLES
        conn.execute(sql)

        records = self.pgspider.get_multi_tenant_tables()

        tables = []
        for record in records:
            record = dict(record)
            tables.append(record)

        """Validate number of tables"""
        self.assertEqual(0, len(tables))

        """Re-create multi-tenant tables"""
        sql = PGSPIDER_CREATE_MULTI_TENANT_TABLES
        conn.execute(sql)

    def test_get_child_tables_1(self):
        """
        Verify normal case of get_child_tables function:
        child foreign tables of specified multi-tenant table exist on remote PGSpider
        Expect: return correct list of child foreign tables
        """

        """Get child table of parent table 'test1'"""
        multi_tenant_table = "test1"
        records = self.pgspider.get_child_tables(multi_tenant_table)

        tables = []
        for record in records:
            record = dict(record)
            tables.append(record)

        """Validate number of tables"""
        self.assertEqual(len(EXPECTED_CHILD_TABLES_1), len(tables))

        """Validate each table"""
        for _, (expected, original) in enumerate(zip(EXPECTED_CHILD_TABLES_1, tables)):
            self.assertEqual(expected, original)

        """Get child table of parent table 'test2'"""
        multi_tenant_table = "test2"
        records = self.pgspider.get_child_tables(multi_tenant_table)

        tables = []
        for record in records:
            record = dict(record)
            tables.append(record)

        """Validate number of tables"""
        self.assertEqual(len(EXPECTED_CHILD_TABLES_2), len(tables))

        """Validate each table"""
        for _, (expected, original) in enumerate(zip(EXPECTED_CHILD_TABLES_2, tables)):
            self.assertEqual(expected, original)

    def test_get_child_tables_2(self):
        """
        Verify abnormal case of get_child_tables function:
        No child foreign table of specified multi-tenant table exists on remote PGSpider
        Expect: return empty list with 0 element
        """

        """Get child table of parent table 'test3'"""
        multi_tenant_table = "test3"
        records = self.pgspider.get_child_tables(multi_tenant_table)

        tables = []
        for record in records:
            record = dict(record)
            tables.append(record)

        """Validate number of tables"""
        self.assertEqual(0, len(tables))
