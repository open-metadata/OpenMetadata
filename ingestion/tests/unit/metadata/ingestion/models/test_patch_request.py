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

import json
import uuid
from unittest import TestCase
from unittest.mock import Mock, patch

import jsonpatch
from pydantic import BaseModel

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.basic import Markdown
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
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
        result = build_patch(
            source=self.source, destination=self.destination, skip_on_failure=True
        )

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


def test_build_patch_preserves_nested_column_metadata():
    class TableModel(BaseModel):
        columns: list[Column]

    historical_tag = TagLabel(
        tagFQN=TagFQN("PII.Personal"),
        source=TagSource.Classification,
        labelType=LabelType.Manual,
        state=State.Confirmed,
    )
    source = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                children=[
                    Column(
                        name="email",
                        dataType=DataType.STRING,
                        description=Markdown("Historical email"),
                        tags=[historical_tag],
                    )
                ],
            )
        ]
    )
    destination = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                children=[Column(name="email", dataType=DataType.STRING)],
            )
        ]
    )

    patch = build_patch(
        source=source,
        destination=destination,
        restrict_update_fields=["description", "tags"],
        array_entity_fields=["columns"],
    )

    assert patch is not None
    columns_operation = next(
        operation for operation in patch.patch if operation["path"] == "/columns"
    )
    nested_column = columns_operation["value"][0]["children"][0]
    assert nested_column["description"] == "Historical email"
    assert nested_column["tags"][0]["tagFQN"] == "PII.Personal"


def test_build_patch_allows_nested_column_metadata_override():
    class TableModel(BaseModel):
        columns: list[Column]

    source = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                children=[
                    Column(
                        name="email",
                        dataType=DataType.STRING,
                        description=Markdown("Historical email"),
                    )
                ],
            )
        ]
    )
    destination = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                children=[
                    Column(
                        name="email",
                        dataType=DataType.STRING,
                        description=Markdown("Current email"),
                    )
                ],
            )
        ]
    )

    patch = build_patch(
        source=source,
        destination=destination,
        restrict_update_fields=["description", "tags"],
        array_entity_fields=["columns"],
        override_metadata=True,
    )

    assert patch is not None
    columns_operation = next(
        operation for operation in patch.patch if operation["path"] == "/columns"
    )
    nested_column = columns_operation["value"][0]["children"][0]
    assert nested_column["description"] == "Current email"


def test_build_patch_preserves_children_when_struct_children_are_omitted():
    class TableModel(BaseModel):
        columns: list[Column]

    source = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                dataTypeDisplay="struct<email:string>",
                children=[
                    Column(
                        name="email",
                        dataType=DataType.STRING,
                        description=Markdown("Historical email"),
                    )
                ],
            )
        ]
    )
    destination = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                dataTypeDisplay="struct",
            )
        ]
    )

    patch = build_patch(
        source=source,
        destination=destination,
        restrict_update_fields=["description", "tags"],
        array_entity_fields=["columns"],
    )

    assert patch is not None
    columns_operation = next(
        operation for operation in patch.patch if operation["path"] == "/columns"
    )
    nested_column = columns_operation["value"][0]["children"][0]
    assert nested_column["name"] == "email"
    assert nested_column["description"] == "Historical email"


def test_build_patch_drops_nested_children_when_column_becomes_scalar():
    class TableModel(BaseModel):
        columns: list[Column]

    source = TableModel(
        columns=[
            Column(
                name="payload",
                dataType=DataType.STRUCT,
                children=[Column(name="email", dataType=DataType.STRING)],
            )
        ]
    )
    destination = TableModel(columns=[Column(name="payload", dataType=DataType.STRING)])

    patch = build_patch(
        source=source,
        destination=destination,
        array_entity_fields=["columns"],
    )

    assert patch is not None
    columns_operation = next(
        operation for operation in patch.patch if operation["path"] == "/columns"
    )
    assert "children" not in columns_operation["value"][0]


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

        assert ops == [
            {"op": "add", "path": "/aliases/1", "value": "svc.db.reporting.orders_v"}
        ]

    def test_dropped_alias_is_removed(self):
        """Aliases are source-managed: dropping the synonym has to clear the field."""
        ops = self._patch_ops(["svc.db.schema.orders_syn"], None)

        assert ops == [{"op": "remove", "path": "/aliases"}]

    def test_unchanged_aliases_produce_no_operation(self):
        assert (
            self._patch_ops(["svc.db.schema.orders_syn"], ["svc.db.schema.orders_syn"])
            == []
        )


class TestBuildPatchTagAppend:
    """A tag added at the source has to reach an entity that is already tagged.

    With overrideMetadata off, tags are additive: the server merges them on a PUT
    (EntityRepository.updateTags), and the connector-side patch has to do the same.
    Keeping the stored list as-is would mean a tag added in Snowflake never lands on
    a table or column that carries any tag already.
    """

    @staticmethod
    def _label(tag_fqn, label_type=LabelType.Automated):
        return TagLabel(
            tagFQN=TagFQN(tag_fqn),
            source=TagSource.Classification,
            labelType=label_type,
            state=State.Suggested,
        )

    def _table(self, table_tags, column_tags, children_tags=None):
        children = None
        if children_tags is not None:
            children = [
                Column(
                    name="street",
                    dataType=DataType.STRING,
                    ordinalPosition=1,
                    tags=[self._label(tag) for tag in children_tags],
                )
            ]
        return Table(
            id=str(uuid.uuid4()),
            name="customers",
            fullyQualifiedName="svc.db.schema.customers",
            columns=[
                Column(
                    name="address",
                    dataType=DataType.STRUCT if children else DataType.VARCHAR,
                    dataLength=None if children else 100,
                    ordinalPosition=1,
                    tags=[self._label(tag) for tag in column_tags],
                    children=children,
                )
            ],
            tags=[self._label(tag) for tag in table_tags],
        )

    def _patched(self, stored, ingested, override_metadata=False):
        """Apply the patch the sink would send, and return the resulting entity."""
        patch = build_patch(
            source=stored,
            destination=ingested,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            override_metadata=override_metadata,
            skip_on_failure=False,
        )
        document = json.loads(stored.model_dump_json(exclude_none=True))

        return jsonpatch.apply_patch(document, patch.patch) if patch else document

    @staticmethod
    def _tag_fqns(tags):
        return [tag["tagFQN"] for tag in tags or []]

    def test_column_tag_is_appended_when_column_already_tagged(self):
        result = self._patched(
            self._table(["Governance.certified"], ["Governance.certified"]),
            self._table(
                ["Governance.certified", "Sensitivity.pii"],
                ["Governance.certified", "Sensitivity.pii"],
            ),
        )

        assert self._tag_fqns(result["columns"][0]["tags"]) == [
            "Governance.certified",
            "Sensitivity.pii",
        ]

    def test_nested_column_tag_is_appended(self):
        result = self._patched(
            self._table([], [], children_tags=["Governance.certified"]),
            self._table(
                [],
                [],
                children_tags=["Governance.certified", "Sensitivity.pii"],
            ),
        )

        assert self._tag_fqns(result["columns"][0]["children"][0]["tags"]) == [
            "Governance.certified",
            "Sensitivity.pii",
        ]

    def test_table_tag_is_appended_whatever_order_the_source_lists_it_in(self):
        """account_usage.tag_references has no ORDER BY, so the new tag can come first."""
        result = self._patched(
            self._table(["Governance.certified"], []),
            self._table(["Sensitivity.pii", "Governance.certified"], []),
        )

        assert sorted(self._tag_fqns(result["tags"])) == [
            "Governance.certified",
            "Sensitivity.pii",
        ]

    def test_tag_dropped_at_the_source_is_kept(self):
        """Without override the patch is additive, so a tag removed upstream stays."""
        result = self._patched(
            self._table(
                ["Governance.certified", "Sensitivity.pii"],
                ["Governance.certified", "Sensitivity.pii"],
            ),
            self._table(["Governance.certified"], ["Governance.certified"]),
        )

        assert self._tag_fqns(result["tags"]) == [
            "Governance.certified",
            "Sensitivity.pii",
        ]
        assert self._tag_fqns(result["columns"][0]["tags"]) == [
            "Governance.certified",
            "Sensitivity.pii",
        ]

    def test_tag_the_user_added_in_the_ui_survives(self):
        result = self._patched(
            self._table(["Tier.Tier1"], ["Tier.Tier1"]),
            self._table(["Sensitivity.pii"], ["Sensitivity.pii"]),
        )

        assert self._tag_fqns(result["tags"]) == ["Tier.Tier1", "Sensitivity.pii"]
        assert self._tag_fqns(result["columns"][0]["tags"]) == [
            "Tier.Tier1",
            "Sensitivity.pii",
        ]

    def test_unchanged_tags_produce_no_operation(self):
        stored = self._table(["Governance.certified"], ["Governance.certified"])
        ingested = self._table(["Governance.certified"], ["Governance.certified"])

        patch = build_patch(
            source=stored,
            destination=ingested,
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            skip_on_failure=False,
        )

        assert patch is None

    def test_override_metadata_still_replaces_tags(self):
        """overrideMetadata is the force-sync path: the source list wins outright."""
        result = self._patched(
            self._table(["Governance.certified"], ["Governance.certified"]),
            self._table(["Sensitivity.pii"], ["Sensitivity.pii"]),
            override_metadata=True,
        )

        assert self._tag_fqns(result["tags"]) == ["Sensitivity.pii"]
        assert self._tag_fqns(result["columns"][0]["tags"]) == ["Sensitivity.pii"]


class TestBuildPatchTableSchemaDefinition:
    """A connector only returns a DDL for views, or for tables when includeDDL is on
    and the fetch succeeds. A missing one means "not collected this run", so the
    patch must keep the stored DDL instead of emitting `remove /schemaDefinition`.
    The server rejects that remove, and since a JSON Patch is applied as one document
    the column update riding along with it is lost too (#33752).
    """

    STORED_DDL = "CREATE TABLE orders (id INT)"
    CHANGED_DDL = "CREATE TABLE orders (id INT, region STRING)"

    @staticmethod
    def _stored_table(schema_definition):
        return Table(
            id=str(uuid.uuid4()),
            name="orders",
            fullyQualifiedName="svc.db.schema.orders",
            columns=[Column(name="id", dataType=DataType.INT)],
            schemaDefinition=schema_definition,
        )

    def _patch_ops(self, stored_ddl, ingested_ddl):
        """Merge the create request over the stored table, as the sink does."""
        original = self._stored_table(stored_ddl)
        create_request = CreateTableRequest(
            name="orders",
            databaseSchema="svc.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="region", dataType=DataType.STRING),
            ],
            schemaDefinition=ingested_ddl,
        )
        result = build_patch(
            source=original,
            destination=original.model_copy(update=create_request.__dict__),
            allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
            restrict_update_fields=RESTRICT_UPDATE_LIST,
            array_entity_fields=ARRAY_ENTITY_FIELDS,
            skip_on_failure=False,
        )

        return result.patch if result else []

    def test_missing_ddl_keeps_stored_one_and_still_updates_columns(self):
        ops = self._patch_ops(self.STORED_DDL, None)

        assert [op["path"] for op in ops] == ["/columns"]

    def test_changed_ddl_is_replaced(self):
        ops = self._patch_ops(self.STORED_DDL, self.CHANGED_DDL)

        assert {
            "op": "replace",
            "path": "/schemaDefinition",
            "value": self.CHANGED_DDL,
        } in ops

    def test_first_ddl_is_added(self):
        ops = self._patch_ops(None, self.STORED_DDL)

        assert {
            "op": "add",
            "path": "/schemaDefinition",
            "value": self.STORED_DDL,
        } in ops
