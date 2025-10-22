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

"""Test Redshift Utils"""

import unittest
from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.redshift.utils import get_view_definition


class TestRedshiftUtils(unittest.TestCase):
    """Test Redshift Utils"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_connection = Mock()
        self.mock_self = Mock()
        self.mock_view = Mock()
        self.mock_view.schema = "test_schema"
        self.mock_view.relname = "test_view"
        self.mock_self._get_redshift_relation = MagicMock(return_value=self.mock_view)

    def test_view_definition_with_create_view(self):
        """Test that view definition with CREATE VIEW is not modified"""
        self.mock_view.view_definition = (
            "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

    def test_view_definition_without_create_view(self):
        """Test that view definition without CREATE VIEW gets it prepended"""
        self.mock_view.view_definition = "SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

    def test_view_definition_with_sql_comment_before_create(self):
        """Test view definition with SQL comment before CREATE VIEW (expected scenario)"""
        self.mock_view.view_definition = "/* some comment */\n\tCREATE VIEW test_schema.test_view AS SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "/* some comment */\n\tCREATE VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_view_definition_removes_schema_binding(self):
        """Test that WITH NO SCHEMA BINDING is removed"""
        self.mock_view.view_definition = "CREATE VIEW test_schema.test_view AS SELECT * FROM table1 WITH NO SCHEMA BINDING"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1 "
        )


if __name__ == "__main__":
    unittest.main()
