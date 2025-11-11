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
Test Entity Link build behavior
"""
from unittest import TestCase

from antlr4.error.Errors import ParseCancellationException

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.utils import entity_link
from metadata.utils.entity_link import (
    CustomColumnName,
    EntityLinkBuildingException,
    get_column_name_or_none,
    get_decoded_column,
    get_entity_link,
    get_table_fqn,
    get_table_or_column_fqn,
)


class TestEntityLink(TestCase):
    """
    Validate EntityLink building
    """

    def test_split(self):
        this = self

        class EntityLinkTest:
            """
            Test helper class
            """

            def __init__(self, entitylink, split_list):
                self.entitylink = entitylink
                self.split_list = split_list

            def validate(self, fn_resp, check_split):
                this.assertEqual(fn_resp, check_split)
                this.assertEqual(len(fn_resp), len(check_split))

        xs = [
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw_product_catalog1>",
                ["table", "bigquery_gcp.shopify.raw_product_catalog1"],
            ),
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw_product_catalog2::description>",
                ["table", "bigquery_gcp.shopify.raw_product_catalog2", "description"],
            ),
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw_product_catalog3::columns::comment>",
                [
                    "table",
                    "bigquery_gcp.shopify.raw_product_catalog3",
                    "columns",
                    "comment",
                ],
            ),
            EntityLinkTest(
                "<#E::ingestionPipeline::fivetran_gcp.shopify.raw_product_catalog3>",
                [
                    "ingestionPipeline",
                    "fivetran_gcp.shopify.raw_product_catalog3",
                ],
            ),
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw_product_catalog4::columns::comment::description>",
                [
                    "table",
                    "bigquery_gcp.shopify.raw_product_catalog4",
                    "columns",
                    "comment",
                    "description",
                ],
            ),
            EntityLinkTest(
                "<#E::database::bigquery_gcp.shopify>",
                ["database", "bigquery_gcp.shopify"],
            ),
            EntityLinkTest(
                "<#E::database::bigquery_gcp.shopify::tags>",
                ["database", "bigquery_gcp.shopify", "tags"],
            ),
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw-product-catalog5>",
                ["table", "bigquery_gcp.shopify.raw-product-catalog5"],
            ),
            EntityLinkTest(
                '<#E::table::bigquery_gcp.shopify."raw-product-catalog6"::description>',
                [
                    "table",
                    'bigquery_gcp.shopify."raw-product-catalog6"',
                    "description",
                ],
            ),
            EntityLinkTest(
                "<#E::table::bigquery_gcp.shopify.raw-product-catalog5::description>",
                ["table", "bigquery_gcp.shopify.raw-product-catalog5", "description"],
            ),
            EntityLinkTest(
                '<#E::table::bigquery_gcp."shop-ify"."raw-product-catalog6">',
                ["table", 'bigquery_gcp."shop-ify"."raw-product-catalog6"'],
            ),
            EntityLinkTest(
                "<#E::table::随机的>",
                ["table", "随机的"],
            ),
            EntityLinkTest(
                '<#E::table::ExampleWithFolder.withfolder.examplewithfolder."folderpath/username.csv">',
                [
                    "table",
                    'ExampleWithFolder.withfolder.examplewithfolder."folderpath/username.csv"',
                ],
            ),
            EntityLinkTest(
                (
                    "<#E::table::Object Platform DB.object_platform_db."
                    "modelled.price::columns::type>"
                ),
                [
                    "table",
                    "Object Platform DB.object_platform_db.modelled.price",
                    "columns",
                    "type",
                ],
            ),
            EntityLinkTest(
                "<#E::table::service.db.schema.table::columns::name>",
                ["table", "service.db.schema.table", "columns", "name"],
            ),
            EntityLinkTest(
                "<#E::table::service.db.schema.table::columns::api>",
                ["table", "service.db.schema.table", "columns", "api"],
            ),
            EntityLinkTest(
                "<#E::table::service.db.schema.table::columns::task>",
                ["table", "service.db.schema.table", "columns", "task"],
            ),
        ]
        for x in xs:
            x.validate(entity_link.split(x.entitylink), x.split_list)

    def test_get_entity_link(self):
        """We can get entity link for different entities"""

        table_link = get_entity_link(Table, fqn="service.db.schema.table")
        self.assertEqual(table_link, "<#E::table::service.db.schema.table>")

        dashboard_link = get_entity_link(Dashboard, fqn="service.dashboard")
        self.assertEqual(dashboard_link, "<#E::dashboard::service.dashboard>")

        column_link = get_entity_link(
            Table, fqn="service.db.schema.table", column_name="col"
        )
        self.assertEqual(
            column_link, "<#E::table::service.db.schema.table::columns::col>"
        )

    def test_entity_link_with_reserved_keywords(self):
        """Test entity links with column names matching reserved keywords"""

        # Test all common reserved keywords that could be column names
        reserved_keywords = [
            "type",
            "name",
            "api",
            "task",
            "description",
            "owner",
            "tags",
            "chart",
            "domain",
            "all",
            "user",
            "role",
            "policy",
            "alert",
            "app",
        ]

        for keyword in reserved_keywords:
            link = f"<#E::table::service.db.schema.table::columns::{keyword}>"
            parts = entity_link.split(link)
            self.assertEqual(
                parts,
                ["table", "service.db.schema.table", "columns", keyword],
                f"Failed to parse column name '{keyword}'",
            )

    def test_entity_link_with_multiple_fields(self):
        """Test entity links with multiple field levels"""

        # Nested column with description
        link = "<#E::table::db.schema.table::columns::nested.col::description>"
        parts = entity_link.split(link)
        self.assertEqual(
            parts,
            [
                "table",
                "db.schema.table",
                "columns",
                "nested.col",
                "description",
            ],
        )

        # Column with tags
        link = "<#E::table::db.schema.table::columns::type::tags>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "type", "tags"])

    def test_entity_link_special_characters(self):
        """Test entity links with special characters in names"""

        # Column with hyphen
        link = "<#E::table::db.schema.table::columns::my-column>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "my-column"])

        # Column with underscore
        link = "<#E::table::db.schema.table::columns::my_column>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "my_column"])

        # Column with numbers
        link = "<#E::table::db.schema.table::columns::column123>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "column123"])

    def test_entity_link_unicode(self):
        """Test entity links with unicode characters"""

        # Unicode column name
        link = "<#E::table::随机的>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "随机的"])

        # Unicode in nested structure
        link = "<#E::table::db.schema.table::columns::列名>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "列名"])

    def test_entity_link_quoted_names(self):
        """Test entity links with quoted names containing dots"""

        # Quoted table name with dot
        link = '<#E::table::db.schema."table.name">'
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", 'db.schema."table.name"'])

        # Quoted column name with special chars
        link = '<#E::table::db.schema.table::columns::"my-column.name">'
        parts = entity_link.split(link)
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", '"my-column.name"']
        )

    def test_entity_link_all_entity_types(self):
        """Test that any string can be used as entity type (including former reserved words)"""

        entity_types = [
            "table",
            "topic",
            "dashboard",
            "pipeline",
            "type",  # Previously hardcoded as ENTITY_FIELD token; now accepted as entity type
            "api",  # Previously hardcoded as ENTITY_FIELD token; now accepted as entity type
            "workflow",
        ]

        for entity_type in entity_types:
            link = f"<#E::{entity_type}::service.entity>"
            parts = entity_link.split(link)
            self.assertEqual(
                parts,
                [entity_type, "service.entity"],
                f"Failed to parse entity type '{entity_type}'",
            )

    def test_entity_link_field_matching_entity_type(self):
        """Test field names that match entity type keywords"""

        # Field 'table' in a table entity
        link = "<#E::table::db.schema.table::table>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "table"])

        # Column named 'dashboard' in a table
        link = "<#E::table::db.schema.table::columns::dashboard>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "dashboard"])

    def test_entity_link_spaces_in_fqn(self):
        """Test entity links with spaces in FQN (from Scout24 case)"""

        # This is the actual failing case from Scout24
        link = (
            "<#E::table::Object Platform DB.object_platform_db."
            "modelled.price::columns::type>"
        )
        parts = entity_link.split(link)
        self.assertEqual(
            parts,
            [
                "table",
                "Object Platform DB.object_platform_db.modelled.price",
                "columns",
                "type",
            ],
        )

        # Multiple spaces
        link = "<#E::table::My Database.my schema.my table::columns::my column>"
        parts = entity_link.split(link)
        self.assertEqual(
            parts,
            [
                "table",
                "My Database.my schema.my table",
                "columns",
                "my column",
            ],
        )

    def test_entity_link_invalid_format(self):
        """Test that invalid entity link formats raise errors"""

        # Missing closing bracket
        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E::table::service.db.schema.table")

        # Missing entity type
        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E::::service.db.schema.table>")

        # Missing opening bracket
        with self.assertRaises(ParseCancellationException):
            entity_link.split("#E::table::service.db.schema.table>")

        # Empty entity link
        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E>")

        # Wrong separator (single colon)
        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E:table:service.db.schema.table>")

    def test_entity_link_edge_cases(self):
        """Test edge cases for entity links"""

        # Single character names
        link = "<#E::t::s.d.t>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["t", "s.d.t"])

        # Very long FQN
        long_fqn = ".".join([f"level{i}" for i in range(20)])
        link = f"<#E::table::{long_fqn}>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", long_fqn])

        # Column name that is just a number (if allowed by system)
        link = "<#E::table::db.schema.table::columns::123>"
        parts = entity_link.split(link)
        self.assertEqual(parts, ["table", "db.schema.table", "columns", "123"])

    def test_entity_link_all_entity_fields(self):
        """Test entity links with all common entity fields"""

        entity_fields = [
            "description",
            "columns",
            "schemaFields",
            "tags",
            "owner",
            "followers",
            "tasks",
            "tests",
            "name",
            "displayName",
            "charts",
            "dataModel",
        ]

        for field in entity_fields:
            link = f"<#E::table::service.db.schema.table::{field}>"
            parts = entity_link.split(link)
            self.assertEqual(
                parts,
                ["table", "service.db.schema.table", field],
                f"Failed to parse entity field '{field}'",
            )

    def test_entity_link_real_world_scenarios(self):
        """Test real-world entity link scenarios from production"""

        # Test case from Scout24 - table level entity link
        test_cases = [
            (
                "<#E::table::scout24_data_lake.delta.core_data_is24."
                "terms3_customers>",
                [
                    "table",
                    "scout24_data_lake.delta.core_data_is24.terms3_customers",
                ],
            ),
            (
                (
                    "<#E::table::scout24_data_lake.delta."
                    "datalake_raw_personal_delta."
                    "martech_pipelines_martech_taboola_campaign>"
                ),
                [
                    "table",
                    (
                        "scout24_data_lake.delta."
                        "datalake_raw_personal_delta."
                        "martech_pipelines_martech_taboola_campaign"
                    ),
                ],
            ),
            # Ingestion pipeline entity link
            (
                (
                    "<#E::ingestionPipeline::fivetran_gcp.shopify."
                    "raw_product_catalog>"
                ),
                [
                    "ingestionPipeline",
                    "fivetran_gcp.shopify.raw_product_catalog",
                ],
            ),
            # Column with common SQL keyword names
            (
                "<#E::table::db.schema.table::columns::select>",
                ["table", "db.schema.table", "columns", "select"],
            ),
            (
                "<#E::table::db.schema.table::columns::from>",
                ["table", "db.schema.table", "columns", "from"],
            ),
            (
                "<#E::table::db.schema.table::columns::where>",
                ["table", "db.schema.table", "columns", "where"],
            ),
        ]

        for link, expected_parts in test_cases:
            parts = entity_link.split(link)
            self.assertEqual(parts, expected_parts, f"Failed for: {link}")

    def test_get_decoded_column(self):
        """Test get_decoded_column function for URL decoding"""

        # Test URL encoded spaces
        link = "<#E::table::rds.dev.dbt_jaffle.table::columns::first+name>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "first name")

        # Test URL encoded special characters
        link = "<#E::table::rds.dev.dbt_jaffle.table::columns::col%2Bname>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "col+name")

        # Test Unicode characters (should pass through)
        link = "<#E::table::rds.dev.dbt_jaffle.table::columns::随机的>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "随机的")

        # Test regular column name (no encoding)
        link = "<#E::table::rds.dev.dbt_jaffle.table::columns::first_name>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "first_name")

        # Test table link (no columns) - returns the last segment which is the table FQN
        link = "<#E::table::rds.dev.dbt_jaffle.table_w_space>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "rds.dev.dbt_jaffle.table_w_space")

        # Test with percent encoding
        link = "<#E::table::db.schema.table::columns::my%20column>"
        decoded = get_decoded_column(link)
        self.assertEqual(decoded, "my column")

    def test_get_table_fqn(self):
        """Test get_table_fqn function"""

        # Test basic table link
        link = "<#E::table::service.db.schema.table>"
        fqn = get_table_fqn(link)
        self.assertEqual(fqn, "service.db.schema.table")

        # Test column link (should still return table FQN)
        link = "<#E::table::service.db.schema.table::columns::col>"
        fqn = get_table_fqn(link)
        self.assertEqual(fqn, "service.db.schema.table")

        # Test with spaces in FQN
        link = "<#E::table::Object Platform DB.object_platform_db.modelled.price>"
        fqn = get_table_fqn(link)
        self.assertEqual(fqn, "Object Platform DB.object_platform_db.modelled.price")

        # Test with special characters
        link = '<#E::table::db."schema".table>'
        fqn = get_table_fqn(link)
        self.assertEqual(fqn, 'db."schema".table')

        # Test with Unicode
        link = "<#E::table::随机的>"
        fqn = get_table_fqn(link)
        self.assertEqual(fqn, "随机的")

    def test_get_table_or_column_fqn(self):
        """Test get_table_or_column_fqn function"""

        # Test table link (2 parts) - should return table FQN
        link = "<#E::table::service.db.schema.table>"
        fqn = get_table_or_column_fqn(link)
        self.assertEqual(fqn, "service.db.schema.table")

        # Test column link (4 parts) - should return table.column
        link = "<#E::table::service.db.schema.table::columns::col>"
        fqn = get_table_or_column_fqn(link)
        self.assertEqual(fqn, "service.db.schema.table.col")

        # Test column with reserved keyword
        link = "<#E::table::service.db.schema.table::columns::type>"
        fqn = get_table_or_column_fqn(link)
        self.assertEqual(fqn, "service.db.schema.table.type")

        # Test with special characters in column
        link = "<#E::table::db.schema.table::columns::my-column>"
        fqn = get_table_or_column_fqn(link)
        self.assertEqual(fqn, "db.schema.table.my-column")

        # Test invalid link (should raise ValueError)
        link = "<#E::table::db.schema.table::description>"
        with self.assertRaises(ValueError):
            get_table_or_column_fqn(link)

        # Test invalid link with wrong field (not "columns")
        link = "<#E::table::db.schema.table::tags::tag1>"
        with self.assertRaises(ValueError):
            get_table_or_column_fqn(link)

    def test_get_column_name_or_none(self):
        """Test get_column_name_or_none function"""

        # Test column link - should return column name
        link = "<#E::table::service.db.schema.table::columns::col>"
        col_name = get_column_name_or_none(link)
        self.assertEqual(col_name, "col")

        # Test table link - should return None
        link = "<#E::table::service.db.schema.table>"
        col_name = get_column_name_or_none(link)
        self.assertIsNone(col_name)

        # Test with reserved keyword column
        link = "<#E::table::service.db.schema.table::columns::type>"
        col_name = get_column_name_or_none(link)
        self.assertEqual(col_name, "type")

        # Test with special characters
        link = "<#E::table::db.schema.table::columns::my-column>"
        col_name = get_column_name_or_none(link)
        self.assertEqual(col_name, "my-column")

        # Test with Unicode
        link = "<#E::table::db.schema.table::columns::列名>"
        col_name = get_column_name_or_none(link)
        self.assertEqual(col_name, "列名")

        # Test with description field (not columns) - should return None
        link = "<#E::table::db.schema.table::description>"
        col_name = get_column_name_or_none(link)
        self.assertIsNone(col_name)

        # Test with nested column and field
        link = "<#E::table::db.schema.table::columns::col::description>"
        col_name = get_column_name_or_none(link)
        # This should return None as it has more than 4 parts
        self.assertIsNone(col_name)

    def test_get_entity_link_with_column(self):
        """Test get_entity_link with column_name parameter"""

        # Test with column
        link = get_entity_link(Table, fqn="service.db.schema.table", column_name="col")
        self.assertEqual(link, "<#E::table::service.db.schema.table::columns::col>")

        # Test with reserved keyword column
        link = get_entity_link(Table, fqn="service.db.schema.table", column_name="type")
        self.assertEqual(link, "<#E::table::service.db.schema.table::columns::type>")

        # Test with special characters in column
        link = get_entity_link(
            Table, fqn="service.db.schema.table", column_name="my-column"
        )
        self.assertEqual(
            link, "<#E::table::service.db.schema.table::columns::my-column>"
        )

        # Test with Unicode column
        link = get_entity_link(Table, fqn="service.db.schema.table", column_name="列名")
        self.assertEqual(link, "<#E::table::service.db.schema.table::columns::列名>")

    def test_backward_compatibility_reserved_keywords(self):
        """
        Test backward compatibility: entity links that were valid before
        the grammar refactor should still be valid and parse correctly.

        Previously, reserved keywords like 'type', 'api', 'task' etc. were
        hardcoded in the grammar. The refactor made the grammar more flexible
        by allowing any string segment, which maintains backward compatibility
        while also allowing new use cases.
        """

        # These entity links were valid before and should remain valid
        backward_compatible_links = [
            # Column names that were previously ENTITY_FIELD tokens
            (
                "<#E::table::service.db.schema.table::columns::type>",
                ["table", "service.db.schema.table", "columns", "type"],
            ),
            (
                "<#E::table::service.db.schema.table::columns::name>",
                ["table", "service.db.schema.table", "columns", "name"],
            ),
            (
                "<#E::table::service.db.schema.table::columns::description>",
                ["table", "service.db.schema.table", "columns", "description"],
            ),
            # Entity fields that were previously ENTITY_FIELD tokens
            (
                "<#E::table::service.db.schema.table::tags>",
                ["table", "service.db.schema.table", "tags"],
            ),
            (
                "<#E::table::service.db.schema.table::owner>",
                ["table", "service.db.schema.table", "owner"],
            ),
            # Standard entity types
            (
                "<#E::table::service.db.schema.table>",
                ["table", "service.db.schema.table"],
            ),
            (
                "<#E::dashboard::service.dashboard>",
                ["dashboard", "service.dashboard"],
            ),
            (
                "<#E::pipeline::service.pipeline>",
                ["pipeline", "service.pipeline"],
            ),
        ]

        for link, expected_parts in backward_compatible_links:
            parts = entity_link.split(link)
            self.assertEqual(
                parts,
                expected_parts,
                f"Backward compatibility broken for: {link}",
            )

    def test_url_encoding_variations(self):
        """Test various URL encoding scenarios"""

        # Test percent encoding
        test_cases = [
            ("<#E::table::db.schema.table::columns::col%201>", "col 1"),
            ("<#E::table::db.schema.table::columns::col%2Fslash>", "col/slash"),
            ("<#E::table::db.schema.table::columns::col%3Acolon>", "col:colon"),
            ("<#E::table::db.schema.table::columns::100%25>", "100%"),
        ]

        for link, expected in test_cases:
            decoded = get_decoded_column(link)
            self.assertEqual(decoded, expected, f"Failed for: {link}")

    def test_error_handling_edge_cases(self):
        """Test error handling for edge cases"""

        # Test empty string error
        with self.assertRaises(ParseCancellationException):
            entity_link.split("")

        # Test malformed links
        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E>")

        with self.assertRaises(ParseCancellationException):
            entity_link.split("<#E::>")

        # Test get_table_or_column_fqn with invalid structure
        # (5+ parts that don't match table or column pattern)
        link = "<#E::table::db.schema.table::columns::col::description>"
        with self.assertRaises(ValueError):
            get_table_or_column_fqn(link)

    def test_get_entity_link_for_non_table_entities(self):
        """Test get_entity_link for entities other than Table"""

        # Test Dashboard entity
        dashboard_link = get_entity_link(Dashboard, fqn="service.dashboard")
        self.assertEqual(dashboard_link, "<#E::dashboard::service.dashboard>")

        # Dashboard link with special characters
        dashboard_link = get_entity_link(
            Dashboard, fqn="service.my-dashboard"
        )
        self.assertEqual(dashboard_link, "<#E::dashboard::service.my-dashboard>")

    def test_custom_column_name_class(self):
        """Test CustomColumnName class used in get_decoded_column"""
        # This is indirectly tested by get_decoded_column, but let's ensure
        # the class itself works correctly

        # Test basic usage
        col = CustomColumnName(root="test_column")
        self.assertEqual(col.root, "test_column")

        # Test with special characters
        col = CustomColumnName(root="col-name")
        self.assertEqual(col.root, "col-name")

    def test_entity_link_building_exception(self):
        """Test EntityLinkBuildingException can be raised"""
        # Test that the exception can be instantiated and raised
        with self.assertRaises(EntityLinkBuildingException):
            raise EntityLinkBuildingException("Test error message")

        # Test exception message
        try:
            raise EntityLinkBuildingException("Custom error")
        except EntityLinkBuildingException as e:
            self.assertEqual(str(e), "Custom error")

    def test_comprehensive_coverage_all_functions(self):
        """Comprehensive test to ensure all code paths are covered"""

        # Test split function with various inputs
        self.assertEqual(
            entity_link.split("<#E::table::db.schema.table>"),
            ["table", "db.schema.table"],
        )

        # Test get_decoded_column with simple case
        self.assertEqual(
            get_decoded_column("<#E::table::db::columns::col>"), "col"
        )

        # Test get_table_fqn with simple case
        self.assertEqual(
            get_table_fqn("<#E::table::db.schema.table>"), "db.schema.table"
        )

        # Test get_table_or_column_fqn with table
        self.assertEqual(
            get_table_or_column_fqn("<#E::table::db.schema.table>"),
            "db.schema.table",
        )

        # Test get_table_or_column_fqn with column
        self.assertEqual(
            get_table_or_column_fqn("<#E::table::db.schema.table::columns::col>"),
            "db.schema.table.col",
        )

        # Test get_column_name_or_none with column
        self.assertEqual(
            get_column_name_or_none("<#E::table::db.schema.table::columns::col>"),
            "col",
        )

        # Test get_column_name_or_none without column
        self.assertIsNone(get_column_name_or_none("<#E::table::db.schema.table>"))

        # Test get_entity_link for Table without column
        self.assertEqual(
            get_entity_link(Table, fqn="db.schema.table"),
            "<#E::table::db.schema.table>",
        )

        # Test get_entity_link for Table with column
        self.assertEqual(
            get_entity_link(Table, fqn="db.schema.table", column_name="col"),
            "<#E::table::db.schema.table::columns::col>",
        )

        # Test get_entity_link for Dashboard
        self.assertEqual(
            get_entity_link(Dashboard, fqn="service.dashboard"),
            "<#E::dashboard::service.dashboard>",
        )
