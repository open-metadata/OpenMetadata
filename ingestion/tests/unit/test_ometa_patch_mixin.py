#  Copyright 2026 Collate
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
OpenMetadata patch mixin helper unit tests
"""

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.mixins.patch_mixin import update_column_tags
from metadata.ingestion.ometa.mixins.patch_mixin_utils import PatchOperation

TAG_LABEL = TagLabel(
    tagFQN=TagFQN("PII.Sensitive"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
)


def test_update_column_tags_matches_case_distinct_column_fqns_exactly():
    """Case-distinct column FQNs should not collapse onto the first lowercased match."""
    columns = [
        Column(
            name="country",
            dataType=DataType.STRING,
            fullyQualifiedName="db.schema.table.country",
        ),
        Column(
            name="Country",
            dataType=DataType.STRING,
            fullyQualifiedName="db.schema.table.Country",
        ),
    ]

    update_column_tags(
        columns=columns,
        column_tag=ColumnTag(
            column_fqn="db.schema.table.country",
            tag_label=TAG_LABEL,
        ),
        operation=PatchOperation.ADD,
    )
    update_column_tags(
        columns=columns,
        column_tag=ColumnTag(
            column_fqn="db.schema.table.Country",
            tag_label=TAG_LABEL,
        ),
        operation=PatchOperation.ADD,
    )

    assert [tag.tagFQN.root for tag in columns[0].tags] == [TAG_LABEL.tagFQN.root]
    assert [tag.tagFQN.root for tag in columns[1].tags] == [TAG_LABEL.tagFQN.root]


def test_update_column_tags_removes_only_from_exact_case_match():
    """Case-exact REMOVE should affect only the matching column, not its case-distinct sibling."""
    columns = [
        Column(
            name="country",
            dataType=DataType.STRING,
            fullyQualifiedName="db.schema.table.country",
            tags=[TAG_LABEL.model_copy(deep=True)],
        ),
        Column(
            name="Country",
            dataType=DataType.STRING,
            fullyQualifiedName="db.schema.table.Country",
            tags=[TAG_LABEL.model_copy(deep=True)],
        ),
    ]

    update_column_tags(
        columns=columns,
        column_tag=ColumnTag(
            column_fqn="db.schema.table.Country",
            tag_label=TAG_LABEL,
        ),
        operation=PatchOperation.REMOVE,
    )

    assert [tag.tagFQN.root for tag in columns[0].tags] == [TAG_LABEL.tagFQN.root]
    assert columns[1].tags == []


def test_update_column_tags_matches_nested_children_case_exactly():
    """Recursion into children should keep matching column FQNs case-sensitively."""
    columns = [
        Column(
            name="address",
            dataType=DataType.STRUCT,
            fullyQualifiedName="db.schema.table.address",
            children=[
                Column(
                    name="city",
                    dataType=DataType.STRING,
                    fullyQualifiedName="db.schema.table.address.city",
                ),
                Column(
                    name="City",
                    dataType=DataType.STRING,
                    fullyQualifiedName="db.schema.table.address.City",
                ),
            ],
        ),
    ]

    update_column_tags(
        columns=columns,
        column_tag=ColumnTag(
            column_fqn="db.schema.table.address.City",
            tag_label=TAG_LABEL,
        ),
        operation=PatchOperation.ADD,
    )

    children = columns[0].children
    assert children[0].tags == []
    assert [tag.tagFQN.root for tag in children[1].tags] == [TAG_LABEL.tagFQN.root]
