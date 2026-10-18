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
Regression tests for LookML view refinements in BulkLkmlParser (#35684).

Refinements use the `view: +name {}` syntax to extend an existing view:
  - override sql_table_name / derived_table
  - add dimensions, measures, dimension_groups

Previously BulkLkmlParser cached `+orders` as a separate view and never
merged it into `orders`.
"""

from pathlib import Path
from unittest import TestCase

from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.models import ViewName
from metadata.readers.file.local import LocalReader
from metadata.utils.singleton import Singleton

BASE_PATH = Path(__file__).parent.parent.parent / "resources/lkml"


class TestBulkLkmlParserRefinements(TestCase):
    """BulkLkmlParser merges +view refinements into the base view."""

    def setUp(self):
        Singleton.clear_all()

    def test_refinement_overrides_sql_table_name(self):
        """
        orders_refinements.view.lkml contains `view: +orders` which changes
        sql_table_name from raw.orders to analytics.orders_clean.
        The merged view should reflect the refinement value.
        """
        reader = LocalReader(BASE_PATH)
        parser = BulkLkmlParser(reader=reader)

        view = parser.get_view_from_cache(ViewName("orders"))

        self.assertIsNotNone(view, "orders view should be cached")
        self.assertEqual(view.sql_table_name, "analytics.orders_clean")

    def test_refinement_adds_dimensions_to_base_view(self):
        """
        The refinement adds a `status` dimension. The merged view must contain
        both the original `id` dimension and the new `status` dimension.
        """
        Singleton.clear_all()
        reader = LocalReader(BASE_PATH)
        parser = BulkLkmlParser(reader=reader)

        view = parser.get_view_from_cache(ViewName("orders"))

        self.assertIsNotNone(view)
        dim_names = [d.name for d in view.dimensions]
        self.assertIn("id", dim_names, "original dimension must be preserved")
        self.assertIn("status", dim_names, "refinement dimension must be added")

    def test_refinement_view_not_stored_as_separate_cache_entry(self):
        """
        `+orders` must NOT appear as a standalone view in the cache.
        """
        Singleton.clear_all()
        reader = LocalReader(BASE_PATH)
        parser = BulkLkmlParser(reader=reader)

        refinement_entry = parser.get_view_from_cache(ViewName("+orders"))
        self.assertIsNone(
            refinement_entry,
            "+orders should not be a separate cache entry after refinement merging",
        )
