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

"""Test Trino Metadata"""

import unittest
from unittest.mock import Mock

from metadata.ingestion.source.database.trino.metadata import get_view_definition


class TestTrinoMetadata(unittest.TestCase):
    """Test Trino Metadata"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_connection = Mock()
        self.mock_self = Mock()
        self.mock_self._get_default_catalog_name.return_value = "test_catalog"
        self.mock_self._get_default_schema_name.return_value = "test_schema"

    def _set_execute_side_effect(self, primary_result, fallback_result=None):
        """Helper to mock connection.execute for primary and fallback queries"""
        results = iter(
            [self._mock_result(primary_result), self._mock_result(fallback_result)]
        )
        self.mock_connection.execute.side_effect = lambda *args, **kwargs: next(results)

    @staticmethod
    def _mock_result(scalar_value):
        """Create a mock result with a scalar() return value"""
        result = Mock()
        result.scalar.return_value = scalar_value
        return result

    def test_view_definition_prepends_create_view_for_select_only(self):
        """Test that a SELECT-only definition from information_schema gets CREATE VIEW prepended"""
        self._set_execute_side_effect("SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_catalog"."test_schema"."test_view" AS SELECT * FROM table1',
        )
        # Only primary query should be executed
        self.assertEqual(self.mock_connection.execute.call_count, 1)

    def test_view_definition_with_create_view_not_modified(self):
        """Test that a definition already containing CREATE VIEW is returned as-is"""
        self._set_execute_side_effect(
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )
        self.assertEqual(self.mock_connection.execute.call_count, 1)

    def test_view_definition_with_create_or_replace_not_modified(self):
        """Test that CREATE OR REPLACE VIEW is not double-prefixed"""
        self._set_execute_side_effect(
            "CREATE OR REPLACE VIEW test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE OR REPLACE VIEW test_view AS SELECT * FROM table1"
        )

    def test_view_definition_fallback_when_primary_returns_none(self):
        """Test that SHOW CREATE VIEW is used when information_schema returns None"""
        self._set_execute_side_effect(
            None,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )
        self.assertEqual(self.mock_connection.execute.call_count, 2)

    def test_view_definition_fallback_when_primary_returns_empty_string(self):
        """Test that fallback is used when information_schema returns empty string"""
        self._set_execute_side_effect(
            "",
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT 1",
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_catalog.test_schema.test_view AS SELECT 1"
        )
        self.assertEqual(self.mock_connection.execute.call_count, 2)

    def test_view_definition_returns_none_when_both_queries_empty(self):
        """Test that None is returned when both queries return nothing"""
        self._set_execute_side_effect(None, None)

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertIsNone(result)

    def test_view_definition_fallback_permission_error_handled(self):
        """Test that a permission error on fallback is handled gracefully"""
        primary_result = self._mock_result(None)
        self.mock_connection.execute.side_effect = [
            primary_result,
            PermissionError("Access Denied"),
        ]

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertIsNone(result)

    def test_view_definition_without_catalog(self):
        """Test full_view_name without catalog when catalog is None"""
        self.mock_self._get_default_catalog_name.return_value = None

        self._set_execute_side_effect("SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_schema"."test_view" AS SELECT * FROM table1',
        )

    def test_view_definition_uses_default_schema(self):
        """Test that schema falls back to _get_default_schema_name"""
        self._set_execute_side_effect("SELECT 1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_catalog"."test_schema"."test_view" AS SELECT 1',
        )

    def test_view_definition_raises_error_when_schema_none(self):
        """Test that NoSuchTableError is raised when schema is None"""
        from sqlalchemy import exc

        self.mock_self._get_default_schema_name.return_value = None

        with self.assertRaises(exc.NoSuchTableError):
            get_view_definition(
                self.mock_self,
                self.mock_connection,
                "test_view",
                schema=None,
            )


if __name__ == "__main__":
    unittest.main()
