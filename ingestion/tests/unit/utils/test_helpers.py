#  Copyright 2025 Collate
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
Test helpers
"""
import uuid
from unittest import TestCase

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.utils.helpers import (
    find_column_in_table,
    find_column_in_table_with_index,
    find_in_iter,
)


class HelpersTest(TestCase):
    def test_find_in_iter(self):
        """We can find elements within a list"""
        iter_ = ("A", "B", "C")

        found = find_in_iter(element="B", container=iter_)
        self.assertEqual("B", found)

        not_found = find_in_iter(element="random", container=iter_)
        self.assertIsNone(not_found)

    def test_find_column_in_table(self):
        """Check we can find a column inside a table"""

        table = Table(
            id=uuid.uuid4(),
            name="test",
            fullyQualifiedName="test-service-table.test-db.test-schema.test",
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="hello", dataType=DataType.BIGINT),
                Column(name="foo", dataType=DataType.BIGINT),
                Column(name="bar", dataType=DataType.BIGINT),
            ],
        )

        col = find_column_in_table(column_name="foo", table=table)
        self.assertEqual(col, Column(name="foo", dataType=DataType.BIGINT))

        not_found = find_column_in_table(column_name="random", table=table)
        self.assertIsNone(not_found)

        idx, col = find_column_in_table_with_index(column_name="foo", table=table)
        self.assertEqual(col, Column(name="foo", dataType=DataType.BIGINT))
        self.assertEqual(idx, 2)

        not_found_col, not_found_idx = find_column_in_table_with_index(
            column_name="random", table=table
        )
        self.assertIsNone(not_found)
        self.assertIsNone(not_found_idx)

        col = find_column_in_table(column_name="FOO", table=table, case_sensitive=False)
        self.assertEqual(col, Column(name="foo", dataType=DataType.BIGINT))
