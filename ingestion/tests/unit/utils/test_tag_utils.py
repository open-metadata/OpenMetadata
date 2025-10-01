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
Test tag_utils module
"""
from unittest import TestCase
from unittest.mock import MagicMock

from metadata.utils.tag_utils import (
    get_ometa_tag_and_classification,
    get_tag_label,
    get_tag_labels,
)


class TestTagUtils(TestCase):
    """
    Test tag_utils functions for handling empty tags
    """

    def test_empty_tags_filtered_in_get_ometa_tag_and_classification(self):
        """
        Test that empty and whitespace-only tags are filtered out
        in get_ometa_tag_and_classification
        """
        # Mock metadata object
        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        # Test with empty string tag, whitespace, and None
        tags_with_empty = ["valid_tag", "", "another_valid_tag", "   ", None]

        results = list(
            get_ometa_tag_and_classification(
                tags=tags_with_empty,
                classification_name="test_classification",
                tag_description="Test description",
                classification_description="Test classification description",
                include_tags=True,
                metadata=mock_metadata,
                system_tags=False,
            )
        )

        # Should only get 2 valid results (for "valid_tag" and "another_valid_tag")
        # Empty string, whitespace, and None should be filtered out
        successful_results = [r.right for r in results if r.right]

        # Verify the correct number of successful results
        self.assertEqual(
            len(successful_results),
            2,
            f"Expected 2 successful results, got {len(successful_results)}",
        )

        # Verify the successful tags are the valid ones
        tag_names = [r.tag_request.name.root for r in successful_results]
        self.assertIn("valid_tag", tag_names)
        self.assertIn("another_valid_tag", tag_names)

    def test_all_empty_tags_returns_no_results(self):
        """
        Test that when all tags are empty, no results are returned
        """
        # Mock metadata object
        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        # Test with only empty/whitespace tags
        tags_with_empty = ["", "   ", None, "\t", "\n"]

        results = list(
            get_ometa_tag_and_classification(
                tags=tags_with_empty,
                classification_name="test_classification",
                tag_description="Test description",
                classification_description="Test classification description",
                include_tags=True,
                metadata=mock_metadata,
                system_tags=False,
            )
        )

        # Should get no successful results
        successful_results = [r.right for r in results if r.right]
        self.assertEqual(
            len(successful_results),
            0,
            f"Expected 0 successful results, got {len(successful_results)}",
        )

    def test_get_tag_labels_filters_empty_tags(self):
        """
        Test that get_tag_labels also filters empty tags
        """
        mock_metadata = MagicMock()

        # Mock get_by_name to return None (tag doesn't exist)
        mock_metadata.get_by_name.return_value = None

        tags_with_empty = ["valid_tag", "", "   ", None]

        # Should not raise an error despite empty tags
        result = get_tag_labels(
            metadata=mock_metadata,
            tags=tags_with_empty,
            classification_name="test_class",
            include_tags=True,
        )

        # Should complete without errors
        # Result will be None or empty list since tags don't exist in the mock
        self.assertIn(result, [None, []])

    def test_only_valid_tags_processed(self):
        """
        Test that only valid (non-empty) tags are processed
        """
        mock_metadata = MagicMock()
        mock_metadata.es_search_from_fqn.return_value = []

        # Mix of valid and invalid tags
        tags = ["tag1", "", None, "tag2", "  ", "tag3"]

        results = list(
            get_ometa_tag_and_classification(
                tags=tags,
                classification_name="test_class",
                tag_description="desc",
                classification_description="class desc",
                include_tags=True,
                metadata=mock_metadata,
                system_tags=False,
            )
        )

        successful_results = [r.right for r in results if r.right]

        # Should have exactly 3 successful results
        self.assertEqual(len(successful_results), 3)

        # Verify all valid tags are present
        tag_names = [r.tag_request.name.root for r in successful_results]
        self.assertIn("tag1", tag_names)
        self.assertIn("tag2", tag_names)
        self.assertIn("tag3", tag_names)

    def test_get_tag_label_filters_empty_tags(self):
        """
        Test that get_tag_label returns None for empty tag names
        """
        mock_metadata = MagicMock()

        # Test with empty string
        result = get_tag_label(
            metadata=mock_metadata,
            tag_name="",
            classification_name="test_class",
        )
        self.assertIsNone(result, "get_tag_label should return None for empty tag_name")

        # Test with whitespace
        result = get_tag_label(
            metadata=mock_metadata,
            tag_name="   ",
            classification_name="test_class",
        )
        self.assertIsNone(
            result, "get_tag_label should return None for whitespace-only tag_name"
        )

        # Test with None should also be handled gracefully
        result = get_tag_label(
            metadata=mock_metadata,
            tag_name=None,
            classification_name="test_class",
        )
        self.assertIsNone(result, "get_tag_label should return None for None tag_name")
