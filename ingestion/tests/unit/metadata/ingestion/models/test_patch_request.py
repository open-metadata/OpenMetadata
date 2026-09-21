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

import uuid
from unittest import TestCase
from unittest.mock import Mock, patch

import jsonpatch
from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    ARRAY_ENTITY_FIELDS,
    RESTRICT_UPDATE_LIST,
    JsonPatchUpdater,
    build_patch,
)


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

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(restrict_update_fields)

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

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(restrict_update_fields)

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

        json_patch_updater = JsonPatchUpdater.from_restrict_update_fields(restrict_update_fields)

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
        with patch("metadata.ingestion.models.patch_request.jsonpatch.make_patch") as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test with skip_on_failure=True (default)
            result = build_patch(source=self.source, destination=self.destination, skip_on_failure=True)

            self.assertIsNone(result)
            mock_make_patch.assert_called_once()

    def test_build_patch_skip_on_failure_false_with_exception(self):
        """Test that build_patch raises exception when skip_on_failure=False and exception occurs."""

        # Mock jsonpatch.make_patch to raise an exception
        with patch("metadata.ingestion.models.patch_request.jsonpatch.make_patch") as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test with skip_on_failure=False
            with self.assertRaises(RuntimeError) as context:
                build_patch(
                    source=self.source,
                    destination=self.destination,
                    skip_on_failure=False,
                )

            self.assertIn("Test exception", str(context.exception))
            self.assertIn("Failed to build patch", str(context.exception))
            mock_make_patch.assert_called_once()

    def test_build_patch_skip_on_failure_default_behavior(self):
        """Test that build_patch defaults to skip_on_failure=True."""

        # Mock jsonpatch.make_patch to raise an exception
        with patch("metadata.ingestion.models.patch_request.jsonpatch.make_patch") as mock_make_patch:
            mock_make_patch.side_effect = Exception("Test exception")

            # Test without explicitly setting skip_on_failure (should default to True)
            result = build_patch(source=self.source, destination=self.destination)

            self.assertIsNone(result)
            mock_make_patch.assert_called_once()

    def test_build_patch_success_with_skip_on_failure_false(self):
        """Test that build_patch works normally when skip_on_failure=False and no exception occurs."""

        # Create a real patch to test successful operation
        result = build_patch(source=self.source, destination=self.destination, skip_on_failure=False)

        self.assertIsNotNone(result)
        self.assertIsInstance(result, jsonpatch.JsonPatch)

        # Verify the patch contains the expected operations
        patch_operations = result.patch
        self.assertEqual(len(patch_operations), 2)

        # Find the value operation
        value_op = next((op for op in patch_operations if op["path"] == "/value"), None)
        self.assertIsNotNone(value_op)
        self.assertEqual(value_op["op"], "replace")
        self.assertEqual(value_op["value"], 2)

    def test_build_patch_success_with_skip_on_failure_true(self):
        """Test that build_patch works normally when skip_on_failure=True and no exception occurs."""

        # Create a real patch to test successful operation
        result = build_patch(source=self.source, destination=self.destination, skip_on_failure=True)

        self.assertIsNotNone(result)
        self.assertIsInstance(result, jsonpatch.JsonPatch)

        # Verify the patch contains the expected operations
        patch_operations = result.patch
        self.assertEqual(len(patch_operations), 2)

        # Find the value operation
        value_op = next((op for op in patch_operations if op["path"] == "/value"), None)
        self.assertIsNotNone(value_op)
        self.assertEqual(value_op["op"], "replace")
        self.assertEqual(value_op["value"], 2)

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
            with self.assertRaises(RuntimeError) as context:
                build_patch(
                    source=self.source,
                    destination=self.destination,
                    restrict_update_fields=["description"],
                    skip_on_failure=False,
                )

            self.assertIn("JsonPatchUpdater exception", str(context.exception))
            self.assertIn("Failed to build patch", str(context.exception))


class BuildPatchEntityReferenceListTest(TestCase):
    def setUp(self):
        from metadata.generated.schema.entity.data.table import Table
        from metadata.generated.schema.type.entityReference import EntityReference
        from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

        self.Table = Table
        self.EntityReference = EntityReference
        self.EntityReferenceList = EntityReferenceList

    def _mk_table(self, name):
        return self.Table(
            id=str(uuid.uuid4()),
            name=name,
            columns=[],
            fullyQualifiedName=f"svc.db.schema.{name}",
        )

    def test_empty_to_populated_data_products(self):
        source = self._mk_table("t1")
        source.dataProducts = self.EntityReferenceList(root=[])

        dest = source.model_copy(deep=True)
        dest.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=str(uuid.uuid4()), type="dataProduct", name="dp1")]
        )

        result = build_patch(
            source=source,
            destination=dest,
            array_entity_fields=["dataProducts"],
            skip_on_failure=False,
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.patch[0]["path"], "/dataProducts")
        self.assertEqual(len(result.patch[0]["value"]), 1)
        self.assertEqual(result.patch[0]["value"][0]["name"], "dp1")

    def test_replace_data_products(self):
        source = self._mk_table("t2")
        dp_id1, dp_id2 = str(uuid.uuid4()), str(uuid.uuid4())
        source.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=dp_id1, type="dataProduct", name="dp1")]
        )

        dest = source.model_copy(deep=True)
        dest.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=dp_id2, type="dataProduct", name="dp2")]
        )

        result = build_patch(
            source=source,
            destination=dest,
            array_entity_fields=["dataProducts"],
            skip_on_failure=False,
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.patch[0]["value"][0]["name"], "dp2")

    def test_same_data_products_no_patch(self):
        source = self._mk_table("t3")
        dp_id = str(uuid.uuid4())
        source.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=dp_id, type="dataProduct", name="dp1")]
        )

        dest = source.model_copy(deep=True)
        dest.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=dp_id, type="dataProduct", name="dp1")]
        )

        result = build_patch(
            source=source,
            destination=dest,
            array_entity_fields=["dataProducts"],
            skip_on_failure=False,
        )
        self.assertIsNone(result)

    def test_empty_to_populated_domains(self):
        source = self._mk_table("t4")
        source.domains = self.EntityReferenceList(root=[])

        dest = source.model_copy(deep=True)
        dest.domains = self.EntityReferenceList(
            root=[self.EntityReference(id=str(uuid.uuid4()), type="domain", name="Analysis")]
        )

        result = build_patch(
            source=source,
            destination=dest,
            array_entity_fields=["domains"],
            skip_on_failure=False,
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.patch[0]["path"], "/domains")
        self.assertEqual(result.patch[0]["value"][0]["name"], "Analysis")

    def test_both_domains_and_data_products(self):
        source = self._mk_table("t5")
        source.domains = self.EntityReferenceList(root=[])
        source.dataProducts = self.EntityReferenceList(root=[])

        dest = source.model_copy(deep=True)
        dest.domains = self.EntityReferenceList(
            root=[self.EntityReference(id=str(uuid.uuid4()), type="domain", name="Analysis")]
        )
        dest.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=str(uuid.uuid4()), type="dataProduct", name="dp1")]
        )

        result = build_patch(
            source=source,
            destination=dest,
            array_entity_fields=["domains", "dataProducts"],
            skip_on_failure=False,
        )

        self.assertIsNotNone(result)
        paths = {op["path"] for op in result.patch}
        self.assertIn("/domains", paths)
        self.assertIn("/dataProducts", paths)

    def test_no_array_entity_fields_still_works(self):
        source = self._mk_table("t6")
        dest = source.model_copy(deep=True)
        dest.dataProducts = self.EntityReferenceList(
            root=[self.EntityReference(id=str(uuid.uuid4()), type="dataProduct", name="dp1")]
        )

        result = build_patch(source=source, destination=dest, skip_on_failure=False)
        self.assertIsNotNone(result)


class TestBuildPatchTableAliases:
    """Table.aliases has to survive the allow-listed patch the sink actually sends.

    `metadata_rest.patch_entity` passes ALLOWED_COMMON_PATCH_FIELDS, and `build_patch`
    diffs the models through `include=allowed_fields`. A field missing from that list
    can never produce an operation, so a connector that recomputes aliases every run
    would silently drop them on every table that already exists in OpenMetadata.
    """

    @staticmethod
    def _table(aliases):
        return Table(
            id=str(uuid.uuid4()),
            name="orders",
            columns=[],
            fullyQualifiedName="svc.db.schema.orders",
            aliases=aliases,
        )

    def _patch_ops(self, source_aliases, destination_aliases):
        """Diff two alias states through the exact call the sink makes."""
        result = build_patch(
            source=self._table(source_aliases),
            destination=self._table(destination_aliases),
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            skip_on_failure=False,
        )

        return result.patch if result else []

    def test_aliases_are_patchable(self):
        """The allow-list carries aliases at all."""
        assert "aliases" in ALLOWED_COMMON_PATCH_FIELDS

    def test_first_alias_is_added(self):
        assert self._patch_ops(None, ["svc.db.schema.orders_syn"]) == [
            {"op": "add", "path": "/aliases", "value": ["svc.db.schema.orders_syn"]}
        ]

    def test_further_alias_is_added(self):
        ops = self._patch_ops(
            ["svc.db.schema.orders_syn"],
            ["svc.db.schema.orders_syn", "svc.db.reporting.orders_v"],
        )

        assert ops == [{"op": "add", "path": "/aliases/1", "value": "svc.db.reporting.orders_v"}]

    def test_dropped_alias_is_removed(self):
        """Aliases are source-managed: dropping the synonym has to clear the field."""
        ops = self._patch_ops(["svc.db.schema.orders_syn"], None)

        assert ops == [{"op": "remove", "path": "/aliases"}]

    def test_unchanged_aliases_produce_no_operation(self):
        assert self._patch_ops(["svc.db.schema.orders_syn"], ["svc.db.schema.orders_syn"]) == []


class TestColumnTagsAdditiveWithOverrideOff:
    """When overrideMetadata=False, new ingestion tags must be appended to
    columns that already carry tags — not silently dropped.

    Regression for https://github.com/open-metadata/OpenMetadata/issues/33709
    """

    @staticmethod
    def _tag(fqn: str):
        from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource

        return TagLabel(
            tagFQN=fqn,
            source=TagSource.Classification,
            labelType=LabelType.Manual,
            state=State.Suggested,
        )

    @staticmethod
    def _column(name: str, tags=None):
        from metadata.generated.schema.entity.data.table import Column, DataType

        return Column(
            name=name,
            dataType=DataType.VARCHAR,
            tags=tags or [],
        )

    @staticmethod
    def _table_with_columns(cols):
        from metadata.generated.schema.entity.data.table import Table

        return Table(
            id=str(uuid.uuid4()),
            name="orders",
            fullyQualifiedName="svc.db.schema.orders",
            columns=cols,
        )

    def test_new_tag_appended_to_column_with_existing_tag(self):
        """Column already has tag-A in OM; ingestion brings tag-A + tag-B.
        Without override, the result must contain both (additive)."""
        tag_a = self._tag("Classification.TagA")
        tag_b = self._tag("Classification.TagB")

        # source = current OM state (has tag-A)
        source = self._table_with_columns([self._column("col1", [tag_a])])
        # destination = new ingestion state (has tag-A and tag-B)
        destination = self._table_with_columns([self._column("col1", [tag_a, tag_b])])

        result = build_patch(
            source=source,
            destination=destination,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=False,
            skip_on_failure=False,
        )

        assert result is not None
        col_patch = next(op for op in result.patch if "/columns" in op["path"])
        col_tags = col_patch["value"][0]["tags"]
        tag_fqns = {t["tagFQN"] for t in col_tags}
        assert "Classification.TagA" in tag_fqns
        assert "Classification.TagB" in tag_fqns

    def test_existing_tag_not_removed_when_ingestion_omits_it(self):
        """Column has tag-A in OM; ingestion brings only tag-B.
        Without override, tag-A must be preserved (additive — no removal)."""
        tag_a = self._tag("Classification.TagA")
        tag_b = self._tag("Classification.TagB")

        source = self._table_with_columns([self._column("col1", [tag_a])])
        destination = self._table_with_columns([self._column("col1", [tag_b])])

        result = build_patch(
            source=source,
            destination=destination,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=False,
            skip_on_failure=False,
        )

        # Either no patch (both tags already present after merge) or
        # a patch whose column tags include tag-A (not removed).
        if result is not None:
            col_patch = next(
                (op for op in result.patch if "/columns" in op["path"]), None
            )
            if col_patch:
                col_tags = col_patch["value"][0]["tags"]
                tag_fqns = {t["tagFQN"] for t in col_tags}
                assert "Classification.TagA" in tag_fqns

    def test_override_true_replaces_tags(self):
        """When override=True, ingestion tags fully replace the column's tags."""
        tag_a = self._tag("Classification.TagA")
        tag_b = self._tag("Classification.TagB")

        source = self._table_with_columns([self._column("col1", [tag_a])])
        destination = self._table_with_columns([self._column("col1", [tag_b])])

        result = build_patch(
            source=source,
            destination=destination,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=True,
            skip_on_failure=False,
        )

        assert result is not None
        col_patch = next(op for op in result.patch if "/columns" in op["path"])
        col_tags = col_patch["value"][0]["tags"]
        tag_fqns = {t["tagFQN"] for t in col_tags}
        assert "Classification.TagA" not in tag_fqns
        assert "Classification.TagB" in tag_fqns
