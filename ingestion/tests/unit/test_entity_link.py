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

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Table
from metadata.utils import entity_link
from metadata.utils.entity_link import get_entity_link


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
            link = (
                f"<#E::table::service.db.schema.table::columns::{keyword}>"
            )
            parts = entity_link.split(link)
            self.assertEqual(
                parts,
                ["table", "service.db.schema.table", "columns", keyword],
                f"Failed to parse column name '{keyword}'",
            )

    def test_entity_link_with_multiple_fields(self):
        """Test entity links with multiple field levels"""

        # Nested column with description
        link = (
            "<#E::table::db.schema.table::columns::nested.col::description>"
        )
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
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", "type", "tags"]
        )

    def test_entity_link_special_characters(self):
        """Test entity links with special characters in names"""

        # Column with hyphen
        link = "<#E::table::db.schema.table::columns::my-column>"
        parts = entity_link.split(link)
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", "my-column"]
        )

        # Column with underscore
        link = "<#E::table::db.schema.table::columns::my_column>"
        parts = entity_link.split(link)
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", "my_column"]
        )

        # Column with numbers
        link = "<#E::table::db.schema.table::columns::column123>"
        parts = entity_link.split(link)
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", "column123"]
        )

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
        """Test that any string can be used as entity type"""

        entity_types = [
            "table",
            "topic",
            "dashboard",
            "pipeline",
            "type",  # This was problematic before
            "api",  # This was problematic before
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
        self.assertEqual(
            parts, ["table", "db.schema.table", "columns", "dashboard"]
        )

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
        link = (
            "<#E::table::My Database.my schema.my table::columns::my column>"
        )
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
        from antlr4.error.Errors import ParseCancellationException

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

