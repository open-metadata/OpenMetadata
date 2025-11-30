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
Unit tests for Looker custom Liquid tags
"""
from unittest import TestCase

from metadata.ingestion.source.dashboard.looker.template_tags import (
    apply_sql_quotes,
    build_liquid_template,
)


class TestLookerConditionTag(TestCase):
    """Test Looker condition tag rendering via preprocessing"""

    def test_condition_tag_basic(self):
        """Test basic condition tag rendering"""
        template_text = "WHERE {% condition region %} orders.region {% endcondition %}"

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("orders.region='placeholder_value'", result)

    def test_condition_tag_with_table_prefix(self):
        """Test condition tag with table prefixed field"""
        template_text = "{% condition order_date %} t1.order_date {% endcondition %}"

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("t1.order_date='placeholder_value'", result)

    def test_condition_tag_in_where_clause(self):
        """Test condition tag within WHERE clause"""
        template_text = """
            SELECT *
            FROM orders
            WHERE {% condition status %} orders.status {% endcondition %}
            AND amount > 100
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("orders.status='placeholder_value'", result)
        self.assertIn("amount > 100", result)

    def test_multiple_condition_tags(self):
        """Test multiple condition tags in same template"""
        template_text = """
            WHERE {% condition region %} r.region {% endcondition %}
            AND {% condition status %} s.status {% endcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("r.region='placeholder_value'", result)
        self.assertIn("s.status='placeholder_value'", result)


class TestLookerIncrementalTag(TestCase):
    """Test Looker incrementcondition tag rendering"""

    def test_incrementcondition_basic(self):
        """Test basic incrementcondition tag rendering"""
        template_text = "{% incrementcondition created_at %} orders.created_at {% endincrementcondition %}"

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("orders.created_at >", result)
        self.assertIn("2023-01-01", result)

    def test_incrementcondition_with_timestamp(self):
        """Test incrementcondition with timestamp field"""
        template_text = """
            WHERE {% incrementcondition updated_at %} products.updated_at {% endincrementcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("products.updated_at > '2023-01-01'", result)

    def test_incrementcondition_in_pdt(self):
        """Test incrementcondition in persistent derived table context"""
        template_text = """
            SELECT *
            FROM base_table
            WHERE {% incrementcondition last_modified %} base_table.last_modified {% endincrementcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("base_table.last_modified > '2023-01-01'", result)


class TestSqlQuoteFilter(TestCase):
    """Test SQL quote filter"""

    def test_apply_sql_quotes_simple(self):
        """Test applying SQL quotes to simple value"""
        result = apply_sql_quotes("test_value")

        self.assertEqual(result, "'test_value'")

    def test_apply_sql_quotes_numeric(self):
        """Test applying SQL quotes to numeric string"""
        result = apply_sql_quotes("12345")

        self.assertEqual(result, "'12345'")


class TestTemplateIntegration(TestCase):
    """Test integration of custom tags with standard Liquid features"""

    def test_condition_tag_with_liquid_variables(self):
        """Test condition tag combined with Liquid variables"""
        template_text = """
            SELECT * FROM {{ schema }}.orders
            WHERE {% condition region %} orders.region {% endcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({"schema": "analytics"})

        self.assertIn("analytics.orders", result)
        self.assertIn("orders.region='placeholder_value'", result)

    def test_condition_tag_with_liquid_conditionals(self):
        """Test condition tag with Liquid if/else"""
        template_text = """
            {% if include_filter %}
                WHERE {% condition status %} orders.status {% endcondition %}
            {% endif %}
        """

        template = build_liquid_template(template_text)
        result_with_filter = template.render({"include_filter": True})
        result_without_filter = template.render({"include_filter": False})

        self.assertIn("orders.status='placeholder_value'", result_with_filter)
        self.assertNotIn("WHERE", result_without_filter.strip())

    def test_incrementcondition_with_variable_field(self):
        """Test incrementcondition with variable-based field reference"""
        template_text = """
            {% if use_created_date %}
                {% incrementcondition created_at %} t.created_at {% endincrementcondition %}
            {% else %}
                {% incrementcondition updated_at %} t.updated_at {% endincrementcondition %}
            {% endif %}
        """

        template = build_liquid_template(template_text)
        result_created = template.render({"use_created_date": True})
        result_updated = template.render({"use_created_date": False})

        self.assertIn("t.created_at > '2023-01-01'", result_created)
        self.assertIn("t.updated_at > '2023-01-01'", result_updated)

    def test_combined_tags(self):
        """Test combination of custom tags"""
        template_text = """
            SELECT * FROM {{ db }}.orders
            WHERE {% condition region %} orders.region {% endcondition %}
            AND {% incrementcondition date %} orders.date {% endincrementcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({"db": "warehouse"})

        self.assertIn("warehouse.orders", result)
        self.assertIn("orders.region='placeholder_value'", result)
        self.assertIn("orders.date > '2023-01-01'", result)


class TestComplexTemplateScenarios(TestCase):
    """Test complex real-world template scenarios"""

    def test_nested_conditions_with_tags(self):
        """Test nested Liquid conditions with custom tags"""
        template_text = """
            SELECT * FROM base
            {% if env == 'prod' %}
                WHERE {% condition region %} prod.region {% endcondition %}
            {% else %}
                WHERE {% condition region %} dev.region {% endcondition %}
            {% endif %}
        """

        template = build_liquid_template(template_text)
        result_prod = template.render({"env": "prod"})
        result_dev = template.render({"env": "dev"})

        self.assertIn("prod.region='placeholder_value'", result_prod)
        self.assertIn("dev.region='placeholder_value'", result_dev)

    def test_incremental_pdt_full_pattern(self):
        """Test full incremental PDT SQL pattern"""
        template_text = """
            SELECT
                user_id,
                SUM(amount) as total_amount
            FROM base_table
            WHERE {% incrementcondition updated_at %} updated_at {% endincrementcondition %}
            GROUP BY user_id
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("updated_at > '2023-01-01'", result)
        self.assertIn("GROUP BY user_id", result)

    def test_templated_filter_with_special_chars(self):
        """Test templated filter with special characters in field names"""
        template_text = """
            {% condition order_region %} orders.`region_code` {% endcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("`region_code`='placeholder_value'", result)

    def test_undefined_variables_with_custom_tags(self):
        """Test custom tags with undefined Liquid variables"""
        template_text = """
            SELECT * FROM {{ undefined_schema }}.orders
            WHERE {% condition region %} orders.region {% endcondition %}
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        # Undefined variables should render as empty
        self.assertIn("orders.region='placeholder_value'", result)


class TestEdgeCases(TestCase):
    """Test edge cases and error handling"""

    def test_empty_template(self):
        """Test rendering empty template"""
        template_text = ""

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertEqual(result, "")

    def test_template_without_custom_tags(self):
        """Test template with only standard Liquid syntax"""
        template_text = "{{ database }}.{{ schema }}.table"

        template = build_liquid_template(template_text)
        result = template.render({"database": "db", "schema": "sch"})

        self.assertEqual(result, "db.sch.table")

    def test_whitespace_handling_in_tags(self):
        """Test that whitespace is preserved correctly"""
        template_text = """
            WHERE
                {% condition region %} orders.region {% endcondition %}
                AND amount > 0
        """

        template = build_liquid_template(template_text)
        result = template.render({})

        self.assertIn("WHERE", result)
        self.assertIn("AND amount > 0", result)

    def test_multiple_renders_same_template(self):
        """Test that template can be rendered multiple times"""
        template_text = "{{ value }}"

        template = build_liquid_template(template_text)
        result1 = template.render({"value": "first"})
        result2 = template.render({"value": "second"})

        self.assertEqual(result1, "first")
        self.assertEqual(result2, "second")
