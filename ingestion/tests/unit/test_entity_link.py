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
