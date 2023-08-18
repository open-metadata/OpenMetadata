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
Test col helpers functions
"""
from unittest import TestCase

from metadata.ingestion.source.database.column_helpers import (
    remove_table_from_column_name,
)


class TestColumnHelpers(TestCase):
    """
    Validate column helpers
    """

    def test_remove_table_from_column_name(self):
        """
        From table.column -> column
        """
        self.assertEqual(
            remove_table_from_column_name(
                table_name="table",
                raw_column_name="table.column",
            ),
            "column",
        )

        self.assertEqual(
            remove_table_from_column_name(
                table_name="table",
                raw_column_name="table.column.with.dots",
            ),
            "column.with.dots",
        )
