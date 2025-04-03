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

import jsonpatch

from metadata.ingestion.models.patch_request import JsonPatchUpdater


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
