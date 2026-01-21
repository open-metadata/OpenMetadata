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
Integration tests for LookML parser with template processing
"""
import tempfile
from pathlib import Path
from unittest import TestCase

from metadata.ingestion.source.dashboard.looker.parser import LkmlParser
from metadata.readers.file.local import LocalReader


class TestParserTemplateIntegration(TestCase):
    """Test parser integration with template processing"""

    def setUp(self):
        """Set up temporary directory for test files"""
        self.temp_dir = tempfile.mkdtemp()
        self.temp_path = Path(self.temp_dir)

    def create_lkml_file(self, filename: str, content: str):
        """Helper to create test LookML file"""
        file_path = self.temp_path / filename
        file_path.write_text(content)
        return file_path

    def test_parser_with_liquid_variables(self):
        """Test parser processes Liquid variables"""
        content = """
        view: test_view {
          sql_table_name: {{ schema }}.test_table ;;
          dimension: id {
            type: number
            sql: ${TABLE}.id ;;
          }
        }
        """

        self.create_lkml_file("test.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"schema": "analytics"},
            enable_template_processing=True,
        )

        view = parser.find_view("test_view", "test.view.lkml")

        self.assertIsNotNone(view)
        self.assertEqual(view.sql_table_name, "{{ schema }}.test_table")
        self.assertEqual(view.om_transformed_sql_table_name, "analytics.test_table")

    def test_parser_with_constants(self):
        """Test parser processes LookML constants"""
        content = """
        view: orders {
          sql_table_name: @{project}.@{dataset}.orders ;;
        }
        """

        self.create_lkml_file("orders.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            lookml_constants={"project": "analytics", "dataset": "prod"},
            enable_template_processing=True,
        )

        view = parser.find_view("orders", "orders.view.lkml")

        self.assertIsNotNone(view)
        self.assertIn("analytics", view.om_transformed_sql_table_name)
        self.assertIn("prod", view.om_transformed_sql_table_name)

    def test_parser_with_derived_patterns(self):
        """Test parser cleans derived view patterns"""
        content = """
        view: derived_view {
          sql_table_name: ${base_view.SQL_TABLE_NAME} ;;
        }
        """

        self.create_lkml_file("derived.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(reader=reader, enable_template_processing=True)

        view = parser.find_view("derived_view", "derived.view.lkml")

        self.assertIsNotNone(view)
        self.assertEqual(view.om_transformed_sql_table_name, "base_view.SQL_TABLE_NAME")
        self.assertNotIn("${", view.om_transformed_sql_table_name)

    def test_parser_with_environment_code(self):
        """Test parser filters environment-specific code"""
        content = """
        view: env_view {
          derived_table: {
            sql:
              SELECT * FROM
              -- if prod --
              production.users
              -- if dev --
              development.users
            ;;
          }
        }
        """

        self.create_lkml_file("env.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader, looker_environment="prod", enable_template_processing=True
        )

        view = parser.find_view("env_view", "env.view.lkml")

        self.assertIsNotNone(view)
        self.assertIsNotNone(view.derived_table)
        self.assertIn("production.users", view.derived_table.om_transformed_sql)
        self.assertNotIn("development.users", view.derived_table.om_transformed_sql)

    def test_parser_with_incomplete_sql(self):
        """Test parser completes SQL fragments"""
        content = """
        view: fragment_view {
          derived_table: {
            sql: user_id, COUNT(*) as order_count ;;
          }
        }
        """

        self.create_lkml_file("fragment.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(reader=reader, enable_template_processing=True)

        view = parser.find_view("fragment_view", "fragment.view.lkml")

        self.assertIsNotNone(view)
        self.assertIsNotNone(view.derived_table)
        transformed = view.derived_table.om_transformed_sql
        self.assertTrue(transformed.upper().startswith("SELECT"))
        self.assertIn("FROM fragment_view", transformed)

    def test_parser_disabled_template_processing(self):
        """Test parser with template processing disabled"""
        content = """
        view: no_process {
          sql_table_name: {{ schema }}.table ;;
        }
        """

        self.create_lkml_file("no_process.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"schema": "analytics"},
            enable_template_processing=False,
        )

        view = parser.find_view("no_process", "no_process.view.lkml")

        self.assertIsNotNone(view)
        # No transformation should occur
        self.assertIsNone(view.om_transformed_sql_table_name)

    def test_parser_complex_scenario(self):
        """Test parser with complex multi-feature template"""
        content = """
        view: complex {
          sql_table_name: {{ database }}.@{schema}.${base.TABLE} ;;

          derived_table: {
            sql:
              {% if users.name._is_selected %}
                SELECT
                  user_id,
                  name
                FROM source
                WHERE
                  -- if prod --
                  status = 'active'
                  -- if dev --
                  status = 'test'
              {% else %}
                SELECT user_id FROM source
              {% endif %}
            ;;
          }
        }
        """

        self.create_lkml_file("complex.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"database": "warehouse"},
            lookml_constants={"schema": "analytics"},
            looker_environment="prod",
            enable_template_processing=True,
        )

        view = parser.find_view("complex", "complex.view.lkml")

        self.assertIsNotNone(view)

        # Check sql_table_name transformation
        transformed_table = view.om_transformed_sql_table_name
        self.assertIn("warehouse", transformed_table)
        self.assertIn("analytics", transformed_table)
        self.assertNotIn("${", transformed_table)

        # Check derived_table.sql transformation
        transformed_sql = view.derived_table.om_transformed_sql
        self.assertIn("name", transformed_sql)
        self.assertIn("active", transformed_sql)
        self.assertNotIn("test", transformed_sql)

    def test_parser_with_includes(self):
        """Test parser processes templates across included files"""
        # Create base view
        base_content = """
        view: base_view {
          sql_table_name: {{ schema }}.base ;;
        }
        """
        self.create_lkml_file("base.view.lkml", base_content)

        # Create explore that includes base
        explore_content = """
        include: "base.view.lkml"

        view: derived {
          sql_table_name: {{ schema }}.derived ;;
        }
        """
        self.create_lkml_file("explore.lkml", explore_content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"schema": "analytics"},
            enable_template_processing=True,
        )

        # Find view from explore file
        view = parser.find_view("derived", "explore.lkml")
        self.assertIsNotNone(view)
        self.assertEqual(view.om_transformed_sql_table_name, "analytics.derived")

        # Find included view
        base_view = parser.find_view("base_view", "explore.lkml")
        self.assertIsNotNone(base_view)
        self.assertEqual(base_view.om_transformed_sql_table_name, "analytics.base")

    def test_parser_error_handling(self):
        """Test parser handles template errors gracefully"""
        content = """
        view: error_view {
          sql_table_name: {{ unclosed_tag ;;
        }
        """

        self.create_lkml_file("error.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(reader=reader, enable_template_processing=True)

        # Parser should handle error and continue
        view = parser.find_view("error_view", "error.view.lkml")
        # View might be None due to parsing error, which is acceptable
        if view:
            # If view was parsed, original value should be preserved
            self.assertIn("{{", view.sql_table_name)

    def test_parser_original_values_preserved(self):
        """Test that original template values are preserved"""
        content = """
        view: preserved {
          sql_table_name: {{ original }}.table ;;

          derived_table: {
            sql: SELECT {{ original_field }} ;;
          }
        }
        """

        self.create_lkml_file("preserved.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"original": "transformed", "original_field": "field"},
            enable_template_processing=True,
        )

        view = parser.find_view("preserved", "preserved.view.lkml")

        self.assertIsNotNone(view)

        # Original values preserved
        self.assertIn("{{", view.sql_table_name)
        self.assertIn("{{", view.derived_table.sql)

        # Transformed values added
        self.assertEqual(view.om_transformed_sql_table_name, "transformed.table")
        self.assertIn("field", view.derived_table.om_transformed_sql)


class TestParserCaching(TestCase):
    """Test parser caching behavior with templates"""

    def setUp(self):
        """Set up temporary directory"""
        self.temp_dir = tempfile.mkdtemp()
        self.temp_path = Path(self.temp_dir)

    def create_lkml_file(self, filename: str, content: str):
        """Helper to create test file"""
        file_path = self.temp_path / filename
        file_path.write_text(content)
        return file_path

    def test_cached_views_transformed(self):
        """Test that cached views include transformations"""
        content = """
        view: cached_view {
          sql_table_name: {{ schema }}.cached ;;
        }
        """

        self.create_lkml_file("cached.view.lkml", content)

        reader = LocalReader(self.temp_path)
        parser = LkmlParser(
            reader=reader,
            liquid_variables={"schema": "analytics"},
            enable_template_processing=True,
        )

        # First access
        view1 = parser.find_view("cached_view", "cached.view.lkml")
        # Second access (from cache)
        view2 = parser.get_view_from_cache("cached_view")

        self.assertIsNotNone(view1)
        self.assertIsNotNone(view2)
        self.assertEqual(view1, view2)
        self.assertEqual(view2.om_transformed_sql_table_name, "analytics.cached")
