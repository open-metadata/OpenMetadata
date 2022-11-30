#  Copyright 2021 Collate
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
sql lineage utils tests
"""
from unittest import TestCase

from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import populate_column_lineage_map

QUERY = [
    "CREATE TABLE MYTABLE2 AS SELECT * FROM MYTABLE1;",
    "CREATE TABLE MYTABLE3 AS SELECT ID, NAME FROM MYTABLE1",
    "CREATE VIEW MYVIEW2 AS SELECT NAME, CITY FROM MYTABLE1;",
    "INSERT INTO MYTABLE5 SELECT ID, NAME, CITY FROM MYTABLE1;",
]
EXPECTED_LINEAGE_MAP = [
    {"<default>.mytable2": {"<default>.mytable1": [("*", "*")]}},
    {"<default>.mytable3": {"<default>.mytable1": [("ID", "ID"), ("NAME", "NAME")]}},
    {"<default>.myview2": {"<default>.mytable1": [("CITY", "CITY"), ("NAME", "NAME")]}},
    {
        "<default>.mytable5": {
            "<default>.mytable1": [("CITY", "CITY"), ("ID", "ID"), ("NAME", "NAME")]
        }
    },
]


class SqlLineageTest(TestCase):
    def test_populate_column_lineage_map(self):

        for i in range(len(QUERY)):
            lineage_parser = LineageParser(QUERY[i])
            raw_column_lineage = lineage_parser.column_lineage
            lineage_map = populate_column_lineage_map(raw_column_lineage)
            self.assertEqual(lineage_map, EXPECTED_LINEAGE_MAP[i])
