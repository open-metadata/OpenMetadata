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
Check the JSONPatch operations work as expected
"""
from unittest import TestCase
from unittest.mock import Mock, patch

import jsonpatch
from pydantic import BaseModel

from metadata.ingestion.models.patch_request import JsonPatchUpdater, build_patch


class JsonPatchUpdaterTest(TestCase):
    """Validate JSONPatchUpdater operations."""

    def test_no_restrict_update_fields_no_replace_op(self):
        """Returns patch as is when no restrict update fields are defined and no replace
        operation is being done."""

        json_patch = jsonpatch.JsonPatch(
            [
                {"op": "add", "path": "/foo/1", "value": "bar"},
                {
                    "op": "remove",
                    "path": "/foo/0",
                },
                {"op": "add", "path": "/foo/0", "value": "baz"},
            ]
        )
        restrict_update_fields = []

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(
            restrict_update_fields
        )

        updated_operations = json_patch_updater.update(json_patch)

        self.assertEqual(json_patch.patch, updated_operations)

    def test_no_restrict_update_fields_with_replace_op(self):
        """Returns the input patch as is, with the addition of a remove operation for each replace operation
        to None."""

        json_patch = jsonpatch.JsonPatch(
            [
                {"op": "replace", "path": "/foo/1", "value": "bar"},
                {"op": "replace", "path": "/name", "value": "Foo"},
                {"op": "replace", "path": "/foo/2", "value": None},
                {"op": "replace", "path": "/foo/3", "value": None},
                {"op": "remove", "path": "/attribute"},
            ]
        )
        restrict_update_fields = []

        expected = [
            {"op": "replace", "path": "/foo/1", "value": "bar"},
            {"op": "replace", "path": "/name", "value": "Foo"},
            {"op": "replace", "path": "/foo/2", "value": None},
            {"op": "replace", "path": "/foo/3", "value": None},
            {"op": "remove", "path": "/attribute"},
            {"op": "remove", "path": "/foo/2"},
            {"op": "remove", "path": "/foo/2"},
        ]

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(
            restrict_update_fields
        )

        updated_operations = json_patch_updater.update(json_patch)

        self.assertEqual(expected, updated_operations)

    def test_restrict_update_fields(self):
        """Returns the input patch as is, without any operations on restricted fields, unless the operation is
        an ADD operation."""

        json_patch = jsonpatch.JsonPatch(
            [
                {"op": "add", "path": "/foo/1", "value": "bar"},
                {"op": "remove", "path": "/foo/2"},
                {"op": "remove", "path": "/attribute"},
            ]
        )
        restrict_update_fields = ["foo"]

        expected = [
            {"op": "add", "path": "/foo/1", "value": "bar"},
            {"op": "remove", "path": "/attribute"},
        ]

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(
            restrict_update_fields
        )

        updated_operations = json_patch_updater.update(json_patch)

        self.assertEqual(expected, updated_operations)


class BuildPatchTest(TestCase):
    """Validate build_patch function operations with skip_on_failure parameter."""

    def setUp(self):
        """Set up test fixtures."""

        class TestModel(BaseModel):
            name: str
            value: int
            description: str = None

        self.TestModel = TestModel

        self.source = TestModel(name="test", value=1, description="source")
        self.destination = TestModel(name="test", value=2, description="destination")

    def test_build_patch_skip_on_failure_true_with_exception(self):
        """Test that build_patch returns None when skip_on_failure=True and exception occurs."""

        # Mock jsonpatch.make_patch to raise an exception
        with patch(
            "metadata.ingestion.models.patch_request.jsonpatch.make_patch"
        ) as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test with skip_on_failure=True (default)
            result = build_patch(
                source=self.source, destination=self.destination, skip_on_failure=True
            )

            self.assertIsNone(result)
            mock_make_patch.assert_called_once()

    def test_build_patch_skip_on_failure_false_with_exception(self):
        """Test that build_patch raises exception when skip_on_failure=False and exception occurs."""

        # Mock jsonpatch.make_patch to raise an exception
        with patch(
            "metadata.ingestion.models.patch_request.jsonpatch.make_patch"
        ) as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test with skip_on_failure=False
            with self.assertRaises(Exception) as context:
                build_patch(
                    source=self.source,
                    destination=self.destination,
                    skip_on_failure=False,
                )

            self.assertEqual(str(context.exception), "Test exception")
            mock_make_patch.assert_called_once()

    def test_build_patch_skip_on_failure_default_behavior(self):
        """Test that build_patch defaults to skip_on_failure=True."""

        # Mock jsonpatch.make_patch to raise an exception
        with patch(
            "metadata.ingestion.models.patch_request.jsonpatch.make_patch"
        ) as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test without explicitly setting skip_on_failure (should default to True)
            result = build_patch(source=self.source, destination=self.destination)

            self.assertIsNone(result)
            mock_make_patch.assert_called_once()

    def test_build_patch_success_with_skip_on_failure_false(self):
        """Test that build_patch works normally when skip_on_failure=False and no exception occurs."""

        # Create a real patch to test successful operation
        result = build_patch(
            source=self.source, destination=self.destination, skip_on_failure=False
        )

        self.assertIsNotNone(result)
        self.assertIsInstance(result, jsonpatch.JsonPatch)

        # Verify the patch contains the expected operation
        patch_operations = result.patch
        self.assertEqual(len(patch_operations), 1)
        self.assertEqual(patch_operations[0]["op"], "replace")
        self.assertEqual(patch_operations[0]["path"], "/value")
        self.assertEqual(patch_operations[0]["value"], 2)

    def test_build_patch_success_with_skip_on_failure_true(self):
        """Test that build_patch works normally when skip_on_failure=True and no exception occurs."""

        # Create a real patch to test successful operation
        result = build_patch(
            source=self.source, destination=self.destination, skip_on_failure=True
        )

        self.assertIsNotNone(result)
        self.assertIsInstance(result, jsonpatch.JsonPatch)

        # Verify the patch contains the expected operation
        patch_operations = result.patch
        self.assertEqual(len(patch_operations), 1)
        self.assertEqual(patch_operations[0]["op"], "replace")
        self.assertEqual(patch_operations[0]["path"], "/value")
        self.assertEqual(patch_operations[0]["value"], 2)

    def test_build_patch_with_json_patch_updater_exception(self):
        """Test skip_on_failure behavior when JsonPatchUpdater.update raises an exception."""

        # Mock JsonPatchUpdater.update to raise an exception
        with patch(
            "metadata.ingestion.models.patch_request.JsonPatchUpdater.from_restrict_update_fields"
        ) as mock_updater_factory:
            mock_updater = Mock()
            mock_updater.update.side_effect = Exception("JsonPatchUpdater exception")
            mock_updater_factory.return_value = mock_updater

            # Test with skip_on_failure=True
            result = build_patch(
                source=self.source,
                destination=self.destination,
                restrict_update_fields=["description"],
                skip_on_failure=True,
            )

            self.assertIsNone(result)

            # Test with skip_on_failure=False
            with self.assertRaises(Exception) as context:
                build_patch(
                    source=self.source,
                    destination=self.destination,
                    restrict_update_fields=["description"],
                    skip_on_failure=False,
                )

            self.assertEqual(str(context.exception), "JsonPatchUpdater exception")
