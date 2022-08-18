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

from antlr4.error.Errors import NoViableAltException, ParseCancellationException

from metadata.utils import entity_link


class TestEntityLink(TestCase):
    """
    Validate EntityLink building
    """

    assert_true_tests = [
        "<#E::table::bigquery_gcp.shopify.raw_product_catalog1>",
        "<#E::table::bigquery_gcp.shopify.raw_product_catalog2::description>",
        "<#E::table::bigquery_gcp.shopify.raw_product_catalog3::columns::comment>",
        "<#E::table::bigquery_gcp.shopify.raw_product_catalog4::columns::comment::description>",
        "<#E::database::bigquery_gcp.shopify>",
        "<#E::database::bigquery_gcp.shopify::tags>",
        "<#E::database::bigquery_gcp.shopify>",
    ]
    assert_false_tests = [
        "<#E::charts::metabase.chart_name>",
        "<#E::thread::full.fqn.here>",
        "<#E::database::bigquery_gcp.shopify::tag>",
    ]

    def test_split(self):
        for tests in self.assert_true_tests:
            self.assertEqual(entity_link.split(tests), [])
        for tests in self.assert_false_tests:
            self.assertRaises(
                ParseCancellationException, lambda: entity_link.split(tests)
            )
