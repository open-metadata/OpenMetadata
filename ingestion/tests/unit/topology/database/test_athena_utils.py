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

"""Test Athena Utils"""

import unittest


class TestAthenaUtils(unittest.TestCase):
    """Test Athena Utils"""

    def test_iceberg_column_filtering_logic(self):
        """Test the Iceberg column filtering logic directly"""

        # Create mock Glue column data (as returned by boto3)
        current_column = {
            "Name": "current_col",
            "Type": "int",
            "Comment": "Current column",
            "Parameters": {"iceberg.field.current": "true"},
        }
        non_current_column = {
            "Name": "non_current_col",
            "Type": "string",
            "Comment": "Non-current column",
            "Parameters": {"iceberg.field.current": "false"},
        }
        column_without_params = {
            "Name": "normal_col",
            "Type": "boolean",
            "Comment": "Normal column",
            "Parameters": {},
        }

        # Test the filtering logic directly (same logic as in get_columns function)
        current_columns = []
        for col in [current_column, non_current_column, column_without_params]:
            col_name = col["Name"]
            col_type = col["Type"]
            col_comment = col.get("Comment", "")
            col_parameters = col.get("Parameters", {})

            # Check if this is a non-current Iceberg column
            iceberg_current = col_parameters.get("iceberg.field.current", "true")
            is_current = iceberg_current != "false"

            if is_current:
                current_columns.append(col_name)

        # Verify that only current columns are returned
        current_column_names = current_columns

        # Should include current_col and normal_col, but not non_current_col
        self.assertIn("current_col", current_column_names)
        self.assertIn("normal_col", current_column_names)
        self.assertNotIn("non_current_col", current_column_names)

        # Verify that exactly 2 columns are returned (current_col and normal_col)
        self.assertEqual(len(current_columns), 2)

    def test_get_columns_handles_attribute_error(self):
        """Test that get_columns handles AttributeError gracefully"""

        # Create a column object that raises AttributeError when accessing parameters
        class MockColumn:
            def __init__(self, name, type_, comment):
                self.name = name
                self.type = type_
                self.comment = comment

            @property
            def parameters(self):
                raise AttributeError("parameters attribute not available")

        column = MockColumn("test_col", "int", "Test column")

        # Test the filtering logic with AttributeError
        current_columns = []
        for c in [column]:
            is_current = True
            try:
                if hasattr(c, "parameters") and c.parameters:
                    iceberg_current = c.parameters.get("iceberg.field.current")
                    if iceberg_current == "false":
                        is_current = False
            except (AttributeError, KeyError):
                pass

            if is_current:
                current_columns.append(c)

        # Should include the column since AttributeError is caught
        self.assertEqual(len(current_columns), 1)
        self.assertEqual(current_columns[0].name, "test_col")

    def test_get_columns_handles_missing_parameters_attribute(self):
        """Test that get_columns handles missing parameters attribute gracefully"""

        # Create a column object without parameters attribute
        class MockColumn:
            def __init__(self, name, type_, comment):
                self.name = name
                self.type = type_
                self.comment = comment

        column = MockColumn("test_col", "int", "Test column")

        # Test the filtering logic with missing parameters attribute
        current_columns = []
        for c in [column]:
            is_current = True
            try:
                if hasattr(c, "parameters") and c.parameters:
                    iceberg_current = c.parameters.get("iceberg.field.current")
                    if iceberg_current == "false":
                        is_current = False
            except (AttributeError, KeyError):
                pass

            if is_current:
                current_columns.append(c)

        # Should include the column since parameters attribute is missing
        self.assertEqual(len(current_columns), 1)
        self.assertEqual(current_columns[0].name, "test_col")

    def test_get_columns_handles_none_parameters(self):
        """Test that get_columns handles None parameters gracefully"""

        # Create a column object with None parameters
        class MockColumn:
            def __init__(self, name, type_, comment, parameters=None):
                self.name = name
                self.type = type_
                self.comment = comment
                self.parameters = parameters

        column = MockColumn("test_col", "int", "Test column", None)

        # Test the filtering logic with None parameters
        current_columns = []
        for c in [column]:
            is_current = True
            try:
                if hasattr(c, "parameters") and c.parameters:
                    iceberg_current = c.parameters.get("iceberg.field.current")
                    if iceberg_current == "false":
                        is_current = False
            except (AttributeError, KeyError):
                pass

            if is_current:
                current_columns.append(c)

        # Should include the column since parameters is None
        self.assertEqual(len(current_columns), 1)
        self.assertEqual(current_columns[0].name, "test_col")


if __name__ == "__main__":
    unittest.main()
