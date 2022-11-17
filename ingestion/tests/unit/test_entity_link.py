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
Test Entity Link build behavior
"""
from unittest import TestCase

from metadata.utils import entity_link


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
        ]
        for x in xs:
            x.validate(entity_link.split(x.entitylink), x.split_list)
