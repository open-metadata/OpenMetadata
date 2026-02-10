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
Test source hash stability and normalization
"""
import uuid

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    DataType,
    TableConstraint,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.utils.source_hash import (
    _get_column_sort_key,
    _get_constraint_sort_key,
    _get_entity_reference_sort_key,
    _get_tag_sort_key,
    _normalize_for_hash,
    _normalize_whitespace,
    _remove_volatile_fields,
    _sort_columns,
    generate_source_hash,
)


class TestNormalizeWhitespace:
    def test_normalize_whitespace_none(self):
        assert _normalize_whitespace(None) is None

    def test_normalize_whitespace_simple(self):
        assert _normalize_whitespace("  hello   world  ") == "hello world"

    def test_normalize_whitespace_newlines(self):
        text = """CREATE TABLE foo (
            id INT,
            name VARCHAR(100)
        )"""
        assert (
            _normalize_whitespace(text)
            == "CREATE TABLE foo ( id INT, name VARCHAR(100) )"
        )

    def test_normalize_whitespace_tabs(self):
        assert _normalize_whitespace("col1\t\tcol2\n\ncol3") == "col1 col2 col3"


class TestGetColumnSortKey:
    def test_sort_key_with_ordinal(self):
        col = {"name": "col_b", "ordinalPosition": 1}
        assert _get_column_sort_key(col) == (1, "col_b")

    def test_sort_key_without_ordinal(self):
        col = {"name": "col_a"}
        assert _get_column_sort_key(col) == (float("inf"), "col_a")

    def test_sort_key_with_dict_name(self):
        col = {"name": {"root": "col_c"}, "ordinalPosition": 2}
        assert _get_column_sort_key(col) == (2, "col_c")

    def test_sort_key_with_pydantic_v1_name(self):
        col = {"name": {"__root__": "col_d"}, "ordinalPosition": 3}
        assert _get_column_sort_key(col) == (3, "col_d")


class TestGetTagSortKey:
    def test_tag_sort_key_string(self):
        tag = {"tagFQN": "PII.Sensitive"}
        assert _get_tag_sort_key(tag) == "PII.Sensitive"

    def test_tag_sort_key_dict(self):
        tag = {"tagFQN": {"root": "Classification.Tag"}}
        assert _get_tag_sort_key(tag) == "Classification.Tag"

    def test_tag_sort_key_missing(self):
        tag = {}
        assert _get_tag_sort_key(tag) == ""


class TestGetConstraintSortKey:
    def test_constraint_sort_key(self):
        constraint = {"constraintType": "PRIMARY_KEY", "columns": ["col_b", "col_a"]}
        assert _get_constraint_sort_key(constraint) == ("PRIMARY_KEY", "col_a,col_b")

    def test_constraint_sort_key_no_columns(self):
        constraint = {"constraintType": "UNIQUE"}
        assert _get_constraint_sort_key(constraint) == ("UNIQUE", "")


class TestGetEntityReferenceSortKey:
    def test_entity_ref_sort_key_fqn(self):
        ref = {"fullyQualifiedName": "team.user1", "name": "user1", "id": "123"}
        assert _get_entity_reference_sort_key(ref) == "team.user1"

    def test_entity_ref_sort_key_name(self):
        ref = {"name": "user2", "id": "456"}
        assert _get_entity_reference_sort_key(ref) == "user2"

    def test_entity_ref_sort_key_id(self):
        ref = {"id": "789"}
        assert _get_entity_reference_sort_key(ref) == "789"


class TestRemoveVolatileFields:
    def test_remove_href(self):
        data = {"name": "test", "href": "http://example.com"}
        result = _remove_volatile_fields(data)
        assert result == {"name": "test"}

    def test_remove_deleted(self):
        data = {"id": "123", "deleted": True}
        result = _remove_volatile_fields(data)
        assert result == {"id": "123"}

    def test_remove_inherited(self):
        data = {"name": "owner", "inherited": False}
        result = _remove_volatile_fields(data)
        assert result == {"name": "owner"}

    def test_remove_nested_volatile(self):
        data = {
            "owners": [
                {"name": "user1", "href": "http://example.com/user1", "deleted": False}
            ]
        }
        result = _remove_volatile_fields(data)
        assert result == {"owners": [{"name": "user1"}]}

    def test_preserve_non_volatile(self):
        data = {"name": "test", "description": "desc", "type": "user"}
        result = _remove_volatile_fields(data)
        assert result == data


class TestSortColumns:
    def test_sort_by_ordinal(self):
        columns = [
            {"name": "col_c", "ordinalPosition": 3},
            {"name": "col_a", "ordinalPosition": 1},
            {"name": "col_b", "ordinalPosition": 2},
        ]
        sorted_cols = _sort_columns(columns)
        assert [c["name"] for c in sorted_cols] == ["col_a", "col_b", "col_c"]

    def test_sort_by_name_when_no_ordinal(self):
        columns = [
            {"name": "zebra"},
            {"name": "alpha"},
            {"name": "beta"},
        ]
        sorted_cols = _sort_columns(columns)
        assert [c["name"] for c in sorted_cols] == ["alpha", "beta", "zebra"]

    def test_sort_mixed_ordinal_and_name(self):
        columns = [
            {"name": "no_ordinal_b"},
            {"name": "with_ordinal", "ordinalPosition": 1},
            {"name": "no_ordinal_a"},
        ]
        sorted_cols = _sort_columns(columns)
        assert sorted_cols[0]["name"] == "with_ordinal"
        assert sorted_cols[1]["name"] == "no_ordinal_a"
        assert sorted_cols[2]["name"] == "no_ordinal_b"

    def test_sort_nested_children(self):
        columns = [
            {
                "name": "parent",
                "ordinalPosition": 1,
                "children": [
                    {"name": "child_b", "ordinalPosition": 2},
                    {"name": "child_a", "ordinalPosition": 1},
                ],
            }
        ]
        sorted_cols = _sort_columns(columns)
        assert [c["name"] for c in sorted_cols[0]["children"]] == ["child_a", "child_b"]

    def test_sort_column_tags(self):
        columns = [
            {
                "name": "col1",
                "ordinalPosition": 1,
                "tags": [
                    {"tagFQN": "PII.Sensitive"},
                    {"tagFQN": "Classification.Email"},
                ],
            }
        ]
        sorted_cols = _sort_columns(columns)
        assert sorted_cols[0]["tags"][0]["tagFQN"] == "Classification.Email"
        assert sorted_cols[0]["tags"][1]["tagFQN"] == "PII.Sensitive"

    def test_sort_string_columns(self):
        """Test backward compatibility with string column lists."""
        columns = ["zebra", "alpha", "beta"]
        sorted_cols = _sort_columns(columns)
        assert sorted_cols == ["alpha", "beta", "zebra"]

    def test_sort_empty_columns(self):
        """Test handling of empty column lists."""
        assert _sort_columns([]) == []
        assert _sort_columns(None) is None


class TestNormalizeForHash:
    def test_normalize_columns(self):
        data = {
            "columns": [
                {"name": "col_b", "ordinalPosition": 2},
                {"name": "col_a", "ordinalPosition": 1},
            ]
        }
        result = _normalize_for_hash(data)
        assert result["columns"][0]["name"] == "col_a"
        assert result["columns"][1]["name"] == "col_b"

    def test_normalize_tags(self):
        data = {
            "tags": [
                {"tagFQN": "Tag.B"},
                {"tagFQN": "Tag.A"},
            ]
        }
        result = _normalize_for_hash(data)
        assert result["tags"][0]["tagFQN"] == "Tag.A"
        assert result["tags"][1]["tagFQN"] == "Tag.B"

    def test_normalize_constraints(self):
        data = {
            "tableConstraints": [
                {"constraintType": "UNIQUE", "columns": ["col_a"]},
                {"constraintType": "PRIMARY_KEY", "columns": ["id"]},
            ]
        }
        result = _normalize_for_hash(data)
        assert result["tableConstraints"][0]["constraintType"] == "PRIMARY_KEY"
        assert result["tableConstraints"][1]["constraintType"] == "UNIQUE"

    def test_normalize_owners(self):
        data = {
            "owners": [
                {"fullyQualifiedName": "team.user_b"},
                {"fullyQualifiedName": "team.user_a"},
            ]
        }
        result = _normalize_for_hash(data)
        assert result["owners"][0]["fullyQualifiedName"] == "team.user_a"
        assert result["owners"][1]["fullyQualifiedName"] == "team.user_b"

    def test_normalize_schema_definition(self):
        data = {
            "schemaDefinition": """
                CREATE TABLE foo (
                    id INT
                )
            """
        }
        result = _normalize_for_hash(data)
        assert result["schemaDefinition"] == "CREATE TABLE foo ( id INT )"

    def test_normalize_removes_volatile_fields(self):
        data = {
            "owners": [
                {"name": "user1", "href": "http://example.com", "deleted": False}
            ]
        }
        result = _normalize_for_hash(data)
        assert "href" not in result["owners"][0]
        assert "deleted" not in result["owners"][0]


class TestGenerateSourceHash:
    def test_hash_deterministic(self):
        request = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT, ordinalPosition=1),
                Column(name="name", dataType=DataType.VARCHAR, ordinalPosition=2),
            ],
        )
        hash1 = generate_source_hash(request)
        hash2 = generate_source_hash(request)
        assert hash1 == hash2
        assert hash1 is not None

    def test_hash_stable_with_column_order_variation(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT, ordinalPosition=1),
                Column(name="name", dataType=DataType.VARCHAR, ordinalPosition=2),
            ],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="name", dataType=DataType.VARCHAR, ordinalPosition=2),
                Column(name="id", dataType=DataType.INT, ordinalPosition=1),
            ],
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_stable_with_tag_order_variation(self):
        tag_a = TagLabel(
            tagFQN="Classification.TagA",
            source=TagSource.Classification,
            labelType=LabelType.Manual,
            state=State.Confirmed,
        )
        tag_b = TagLabel(
            tagFQN="Classification.TagB",
            source=TagSource.Classification,
            labelType=LabelType.Manual,
            state=State.Confirmed,
        )
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            tags=[tag_a, tag_b],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            tags=[tag_b, tag_a],
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_stable_with_constraint_order_variation(self):
        constraint_pk = TableConstraint(
            constraintType=ConstraintType.PRIMARY_KEY, columns=["id"]
        )
        constraint_unique = TableConstraint(
            constraintType=ConstraintType.UNIQUE, columns=["name"]
        )
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.VARCHAR),
            ],
            tableConstraints=[constraint_pk, constraint_unique],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.VARCHAR),
            ],
            tableConstraints=[constraint_unique, constraint_pk],
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_stable_with_owner_order_variation(self):
        owner1 = EntityReference(
            id=uuid.uuid4(), type="user", fullyQualifiedName="team.user_a"
        )
        owner2 = EntityReference(
            id=uuid.uuid4(), type="user", fullyQualifiedName="team.user_b"
        )
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            owners=[owner1, owner2],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            owners=[owner2, owner1],
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_stable_with_volatile_owner_fields(self):
        owner_id = uuid.uuid4()
        owner1 = EntityReference(
            id=owner_id,
            type="user",
            fullyQualifiedName="team.user1",
            href="http://localhost:8585/api/v1/users/123",
            deleted=False,
        )
        owner2 = EntityReference(
            id=owner_id,
            type="user",
            fullyQualifiedName="team.user1",
            href="http://production:8585/api/v1/users/123",
            deleted=True,
        )
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            owners=[owner1],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            owners=[owner2],
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_stable_with_schema_definition_whitespace(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            schemaDefinition="CREATE TABLE test_table ( id INT )",
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            schemaDefinition="""
                CREATE TABLE test_table (
                    id INT
                )
            """,
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_changes_with_actual_data_change(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )
        assert generate_source_hash(request1) != generate_source_hash(request2)

    def test_hash_changes_with_new_column(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.VARCHAR),
            ],
        )
        assert generate_source_hash(request1) != generate_source_hash(request2)

    def test_hash_excludes_source_hash_field(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            sourceHash="abc123",
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            sourceHash="xyz789",
        )
        assert generate_source_hash(request1) == generate_source_hash(request2)

    def test_hash_with_custom_exclude_fields(self):
        request1 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            description="Description 1",
        )
        request2 = CreateTableRequest(
            name="test_table",
            databaseSchema="service.db.schema",
            columns=[Column(name="id", dataType=DataType.INT)],
            description="Description 2",
        )
        hash_without_exclude = generate_source_hash(request1)
        hash_with_exclude = generate_source_hash(
            request1, exclude_fields={"description": True}
        )
        assert hash_without_exclude != generate_source_hash(request2)
        assert hash_with_exclude == generate_source_hash(
            request2, exclude_fields={"description": True}
        )
