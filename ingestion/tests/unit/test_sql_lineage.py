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

from sqllineage.runner import LineageRunner

from metadata.utils.sql_lineage import populate_column_lineage_map

QUERY = """create view test2 as
SELECT brand_id
FROM production.brands;"""

EXPECTED_LINEAGE_MAP = {
    "<default>.test2": {"production.brands": [("brand_id", "brand_id")]}
}


class SqlLineageTest(TestCase):
    def test_populate_column_lineage_map(self):
        result = LineageRunner(QUERY)
        raw_column_lineage = result.get_column_lineage()
        lineage_map = populate_column_lineage_map(raw_column_lineage)
        self.assertEqual(lineage_map, EXPECTED_LINEAGE_MAP)
