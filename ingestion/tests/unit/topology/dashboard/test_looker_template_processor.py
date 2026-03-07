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
Unit tests for LookML template processor
"""
from unittest import TestCase

from metadata.ingestion.source.dashboard.looker.template_processor import (
    TRANSFORMED_SQL_FIELD,
    TRANSFORMED_TABLE_FIELD,
    ConstantResolver,
    DerivedPatternCleaner,
    EnvironmentCodeFilter,
    LiquidTemplateProcessor,
    SpecialLookerVariables,
    SqlFragmentCompleter,
    ViewTransformationPipeline,
    apply_template_transformations,
    process_liquid_templates,
)


class TestSpecialLookerVariables(TestCase):
    """Test special Looker variable handling"""

    def test_extract_special_vars(self):
        """Test extraction of special variables from text"""
        handler = SpecialLookerVariables({"base": "value"})
        text = "SELECT {% if users.name._is_selected %} name {% endif %}"

        special_vars = handler.extract_special_vars(text)

        self.assertEqual(len(special_vars), 1)
        self.assertIn("users.name._is_selected", special_vars)

    def test_build_variable_dict_with_special_vars(self):
        """Test building variable dict with special vars"""
        handler = SpecialLookerVariables({"env": "prod"})
        text = "SELECT {% if view.field._in_query %} field {% endif %}"

        result = handler.build_variable_dict(text)

        self.assertIn("env", result)
        self.assertEqual(result["env"], "prod")
        self.assertIn("view", result)
        self.assertIn("field", result["view"])
        self.assertTrue(result["view"]["field"]["_in_query"])

    def test_build_variable_dict_no_special_vars(self):
        """Test building variable dict without special vars"""
        handler = SpecialLookerVariables({"schema": "public"})
        text = "SELECT * FROM table"

        result = handler.build_variable_dict(text)

        self.assertEqual(result, {"schema": "public"})

    def test_multiple_special_vars(self):
        """Test handling multiple special variables"""
        handler = SpecialLookerVariables({})
        text = """
            {% if users.name._is_selected %} name {% endif %}
            {% if orders.region._is_filtered %} region {% endif %}
        """

        result = handler.build_variable_dict(text)

        self.assertTrue(result["users"]["name"]["_is_selected"])
        self.assertTrue(result["orders"]["region"]["_is_filtered"])


class TestLiquidTemplateProcessor(TestCase):
    """Test Liquid template processing"""

    def test_simple_variable_substitution(self):
        """Test basic variable substitution"""
        result = process_liquid_templates(
            "{{ schema }}.orders", {"schema": "public"}, "test_view"
        )

        self.assertEqual(result, "public.orders")

    def test_undefined_variable_becomes_null(self):
        """Test undefined variables default to NULL"""
        result = process_liquid_templates("{{ undefined_var }}", {}, "test_view")

        self.assertEqual(result, "NULL")

    def test_conditional_logic(self):
        """Test if/else conditional logic"""
        result = process_liquid_templates(
            "{% if env == 'prod' %}production{% else %}development{% endif %}",
            {"env": "prod"},
            "test_view",
        )

        self.assertEqual(result, "production")

    def test_special_boolean_vars_in_template(self):
        """Test special variables in liquid templates"""
        result = process_liquid_templates(
            "{% if users.name._is_selected %}SELECT name{% else %}SELECT NULL{% endif %}",
            {},
            "test_view",
        )

        self.assertIn("SELECT name", result)


class TestLiquidTemplateProcessorClass(TestCase):
    """Test LiquidTemplateProcessor class"""

    def test_transform_sql_table_name(self):
        """Test transformation of sql_table_name"""
        processor = LiquidTemplateProcessor(
            liquid_vars={"database": "warehouse", "schema": "analytics"}
        )

        view_data = {
            "name": "orders",
            "sql_table_name": "{{ database }}.{{ schema }}.orders",
        }

        result = processor.execute(view_data)

        self.assertIn(TRANSFORMED_TABLE_FIELD, result)
        self.assertEqual(result[TRANSFORMED_TABLE_FIELD], "warehouse.analytics.orders")

    def test_transform_derived_table_sql(self):
        """Test transformation of derived_table.sql"""
        processor = LiquidTemplateProcessor(liquid_vars={"env": "prod"})

        view_data = {
            "name": "summary",
            "derived_table": {"sql": "SELECT * FROM {{ env }}_table"},
        }

        result = processor.execute(view_data)

        self.assertIn("derived_table", result)
        self.assertIn(TRANSFORMED_SQL_FIELD, result["derived_table"])
        self.assertIn("prod_table", result["derived_table"][TRANSFORMED_SQL_FIELD])


class TestSqlFragmentCompleter(TestCase):
    """Test SQL fragment completion"""

    def test_add_select_clause(self):
        """Test adding missing SELECT clause"""
        processor = SqlFragmentCompleter()

        view_data = {
            "name": "summary",
            "derived_table": {"sql": "customer_id, SUM(amount) as total FROM orders"},
        }

        result = processor.transform(view_data["derived_table"]["sql"], view_data)

        self.assertTrue(result.upper().startswith("SELECT"))

    def test_add_from_clause(self):
        """Test adding missing FROM clause"""
        processor = SqlFragmentCompleter()

        view_data = {
            "name": "customer_summary",
            "derived_table": {"sql": "SELECT customer_id, COUNT(*) as order_count"},
        }

        result = processor.transform(view_data["derived_table"]["sql"], view_data)

        self.assertIn("FROM customer_summary", result)

    def test_add_both_select_and_from(self):
        """Test adding both SELECT and FROM clauses"""
        processor = SqlFragmentCompleter()

        view_data = {
            "name": "orders",
            "derived_table": {"sql": "order_id, customer_id, amount"},
        }

        result = processor.transform(view_data["derived_table"]["sql"], view_data)

        self.assertTrue(result.upper().startswith("SELECT"))
        self.assertIn("FROM orders", result)

    def test_complete_sql_unchanged(self):
        """Test that complete SQL is not modified"""
        processor = SqlFragmentCompleter()

        view_data = {
            "name": "orders",
            "derived_table": {"sql": "SELECT * FROM complete_table"},
        }

        result = processor.transform(view_data["derived_table"]["sql"], view_data)

        self.assertEqual(result, "SELECT * FROM complete_table")


class TestDerivedPatternCleaner(TestCase):
    """Test derived view pattern cleaning"""

    def test_remove_derived_pattern(self):
        """Test removal of ${} pattern"""
        processor = DerivedPatternCleaner()

        view_data = {"name": "test"}
        result = processor.transform("${employee.SQL_TABLE_NAME}", view_data)

        self.assertEqual(result, "employee.SQL_TABLE_NAME")

    def test_multiple_patterns(self):
        """Test removal of multiple patterns"""
        processor = DerivedPatternCleaner()

        view_data = {"name": "test"}
        result = processor.transform(
            "SELECT * FROM ${view1.TABLE} JOIN ${view2.TABLE}", view_data
        )

        self.assertNotIn("${", result)
        self.assertIn("view1.TABLE", result)
        self.assertIn("view2.TABLE", result)


class TestEnvironmentCodeFilter(TestCase):
    """Test environment-specific code filtering"""

    def test_filter_dev_code_in_prod(self):
        """Test that dev code is removed in prod environment"""
        processor = EnvironmentCodeFilter(environment="prod")

        view_data = {"name": "test"}
        sql = """
            SELECT * FROM
            -- if prod --
            production.users
            -- if dev --
            development.users
        """

        result = processor.transform(sql, view_data)

        self.assertIn("production.users", result)
        self.assertNotIn("development.users", result)

    def test_filter_prod_code_in_dev(self):
        """Test that prod code is removed in dev environment"""
        processor = EnvironmentCodeFilter(environment="dev")

        view_data = {"name": "test"}
        sql = """
            SELECT * FROM
            -- if prod --
            production.users
            -- if dev --
            development.users
        """

        result = processor.transform(sql, view_data)

        self.assertNotIn("production.users", result)
        self.assertIn("development.users", result)

    def test_remove_environment_markers(self):
        """Test that environment markers are removed"""
        processor = EnvironmentCodeFilter(environment="prod")

        view_data = {"name": "test"}
        sql = "-- if prod -- SELECT * FROM table"

        result = processor.transform(sql, view_data)

        self.assertNotIn("-- if prod --", result)
        self.assertIn("SELECT * FROM table", result)


class TestConstantResolver(TestCase):
    """Test constant resolution"""

    def test_resolve_constant_from_config(self):
        """Test resolving constants from configuration"""
        processor = ConstantResolver(
            constants={"schema": "analytics", "project": "data"}
        )

        view_data = {"name": "test"}
        result = processor.transform("@{project}.@{schema}.users", view_data)

        self.assertEqual(result, "data.analytics.users")

    def test_resolve_constant_from_manifest(self):
        """Test resolving constants from manifest"""
        processor = ConstantResolver(manifest_constants={"CONNECTION": "bigquery"})

        view_data = {"name": "test"}
        result = processor.transform("@{CONNECTION}.table", view_data)

        self.assertEqual(result, "bigquery.table")

    def test_undefined_constant_preserved(self):
        """Test that undefined constants are preserved with warning"""
        processor = ConstantResolver(constants={})

        view_data = {"name": "test"}
        result = processor.transform("@{undefined_constant}", view_data)

        self.assertEqual(result, "@{undefined_constant}")

    def test_precedence_config_over_manifest(self):
        """Test that config constants take precedence"""
        processor = ConstantResolver(
            constants={"key": "from_config"},
            manifest_constants={"key": "from_manifest"},
        )

        view_data = {"name": "test"}
        result = processor.transform("@{key}", view_data)

        self.assertEqual(result, "from_config")


class TestViewTransformationPipeline(TestCase):
    """Test view transformation pipeline"""

    def test_sequential_transformation(self):
        """Test that transformations are applied sequentially"""
        processors = [
            EnvironmentCodeFilter(environment="prod"),
            LiquidTemplateProcessor(liquid_vars={"schema": "public"}),
            DerivedPatternCleaner(),
        ]

        view_data = {"name": "test", "sql_table_name": "{{ schema }}.${base.TABLE}"}

        pipeline = ViewTransformationPipeline(processors, view_data)
        result = pipeline.get_transformed_view()

        self.assertIn(TRANSFORMED_TABLE_FIELD, result)
        # Should have liquid vars resolved and patterns cleaned
        transformed = result[TRANSFORMED_TABLE_FIELD]
        self.assertIn("public", transformed)
        self.assertNotIn("${", transformed)

    def test_pipeline_caching(self):
        """Test that pipeline results are cached"""
        processors = [LiquidTemplateProcessor(liquid_vars={"x": "y"})]
        view_data = {"name": "test", "sql_table_name": "{{ x }}"}

        pipeline = ViewTransformationPipeline(processors, view_data)
        result1 = pipeline.get_transformed_view()
        result2 = pipeline.get_transformed_view()

        self.assertIs(result1, result2)  # Same object reference


class TestApplyTemplateTransformations(TestCase):
    """Test the main template transformation function"""

    def test_transform_multiple_views(self):
        """Test transformation of multiple views"""
        lkml_data = {
            "views": [
                {"name": "orders", "sql_table_name": "{{ schema }}.orders"},
                {"name": "users", "sql_table_name": "{{ schema }}.users"},
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data, liquid_vars={"schema": "analytics"}
        )

        self.assertEqual(
            lkml_data["views"][0][TRANSFORMED_TABLE_FIELD], "analytics.orders"
        )
        self.assertEqual(
            lkml_data["views"][1][TRANSFORMED_TABLE_FIELD], "analytics.users"
        )

    def test_full_pipeline_integration(self):
        """Test complete transformation pipeline"""
        lkml_data = {
            "views": [
                {
                    "name": "complex_view",
                    "sql_table_name": "{{ database }}.@{schema}.${base.TABLE}",
                    "derived_table": {
                        "sql": """
                        {% if users.name._is_selected %}
                            user_id, name
                        {% else %}
                            user_id
                        {% endif %}
                    """
                    },
                }
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data,
            liquid_vars={"database": "warehouse"},
            constants={"schema": "analytics"},
            process_constants=True,
        )

        view = lkml_data["views"][0]

        # Check sql_table_name transformation
        self.assertIn(TRANSFORMED_TABLE_FIELD, view)
        transformed_table = view[TRANSFORMED_TABLE_FIELD]
        self.assertIn("warehouse", transformed_table)
        self.assertIn("analytics", transformed_table)
        self.assertNotIn("${", transformed_table)

        # Check derived_table.sql transformation
        self.assertIn(TRANSFORMED_SQL_FIELD, view["derived_table"])
        transformed_sql = view["derived_table"][TRANSFORMED_SQL_FIELD]
        self.assertIn("name", transformed_sql)
        self.assertTrue(transformed_sql.upper().startswith("SELECT"))

    def test_no_views_in_data(self):
        """Test handling of LookML data without views"""
        lkml_data = {"includes": ["*.lkml"]}

        apply_template_transformations(lkml_data=lkml_data)

        self.assertNotIn("views", lkml_data)

    def test_environment_filtering_with_constants(self):
        """Test environment filtering combined with constant resolution"""
        lkml_data = {
            "views": [
                {
                    "name": "sales",
                    "derived_table": {
                        "sql": """
                        SELECT * FROM @{project}.
                        -- if prod --
                        production_sales
                        -- if dev --
                        development_sales
                    """
                    },
                }
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data,
            constants={"project": "analytics"},
            environment="prod",
            process_constants=True,
        )

        transformed = lkml_data["views"][0]["derived_table"][TRANSFORMED_SQL_FIELD]
        self.assertIn("analytics", transformed)
        self.assertIn("production_sales", transformed)
        self.assertNotIn("development_sales", transformed)


class TestComplexScenarios(TestCase):
    """Test complex real-world scenarios"""

    def test_scenario_templated_filter_with_incremental_pdt(self):
        """Test templated filters with incremental PDT patterns"""
        lkml_data = {
            "views": [
                {
                    "name": "orders",
                    "derived_table": {
                        "sql": """
                        SELECT *
                        FROM {{ database }}.orders
                        WHERE {% condition region %} orders.region {% endcondition %}
                        AND {% incrementcondition created_at %} orders.created_at {% endincrementcondition %}
                    """
                    },
                }
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data, liquid_vars={"database": "warehouse"}
        )

        transformed = lkml_data["views"][0]["derived_table"][TRANSFORMED_SQL_FIELD]
        self.assertIn("warehouse.orders", transformed)
        self.assertIn("orders.region=", transformed)
        self.assertIn("orders.created_at >", transformed)

    def test_scenario_nested_liquid_logic(self):
        """Test nested Liquid conditional logic"""
        lkml_data = {
            "views": [
                {
                    "name": "multi_env",
                    "derived_table": {
                        "sql": """
                        SELECT
                        {% if env == 'prod' %}
                            {% if region == 'us' %}
                                prod_us_data
                            {% else %}
                                prod_intl_data
                            {% endif %}
                        {% else %}
                            dev_data
                        {% endif %}
                        FROM base
                    """
                    },
                }
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data, liquid_vars={"env": "prod", "region": "us"}
        )

        transformed = lkml_data["views"][0]["derived_table"][TRANSFORMED_SQL_FIELD]
        self.assertIn("prod_us_data", transformed)
        self.assertNotIn("prod_intl_data", transformed)
        self.assertNotIn("dev_data", transformed)

    def test_scenario_original_values_preserved(self):
        """Test that original values are preserved alongside transformed"""
        lkml_data = {
            "views": [
                {
                    "name": "test",
                    "sql_table_name": "{{ schema }}.original_table",
                    "derived_table": {"sql": "SELECT * FROM original"},
                }
            ]
        }

        apply_template_transformations(
            lkml_data=lkml_data, liquid_vars={"schema": "public"}
        )

        view = lkml_data["views"][0]

        # Original values should still exist
        self.assertEqual(view["sql_table_name"], "{{ schema }}.original_table")
        self.assertEqual(view["derived_table"]["sql"], "SELECT * FROM original")

        # Transformed values should be added
        self.assertIn(TRANSFORMED_TABLE_FIELD, view)
        # Only complete SQL gets transformed
        if "SELECT" in view["derived_table"]["sql"]:
            # Complete SQL, should have transformed version
            self.assertIn(TRANSFORMED_SQL_FIELD, view["derived_table"])
