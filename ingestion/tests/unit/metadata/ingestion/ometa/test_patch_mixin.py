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
Unit tests for PATCH helpers in OMetaPatchMixin.
"""

from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.table_metadata import ColumnTag
from metadata.ingestion.ometa.mixins.patch_mixin import OMetaPatchMixin

PII_TAG = TagLabel(
    tagFQN=TagFQN("PII.Sensitive"),
    labelType=LabelType.Automated,
    state=State.Suggested.value,
    source=TagSource.Classification,
)


def _make_mixin() -> OMetaPatchMixin:
    mixin = OMetaPatchMixin.__new__(OMetaPatchMixin)
    mixin._fetch_entity_if_exists = MagicMock()
    mixin.patch = MagicMock()
    return mixin


def _column(column_name: str, column_fqn: str) -> Column:
    return Column(
        name=ColumnName(column_name),
        dataType=DataType.INT,
        fullyQualifiedName=FullyQualifiedEntityName(column_fqn),
        tags=[],
    )


def _table() -> Table:
    table_fqn = "service.database.schema.orders"
    return Table(
        id=uuid4(),
        name=EntityName("orders"),
        fullyQualifiedName=FullyQualifiedEntityName(table_fqn),
        columns=[_column("id", f"{table_fqn}.id")],
    )


def _container() -> Container:
    container_fqn = "storage_service.bucket.orders_csv"
    return Container(
        id=uuid4(),
        name=EntityName("orders_csv"),
        fullyQualifiedName=FullyQualifiedEntityName(container_fqn),
        service=EntityReference(id=uuid4(), type="storageService"),
        dataModel=ContainerDataModel(
            columns=[_column("id", f"{container_fqn}.id")],
        ),
    )


def test_patch_column_tags_uses_fetched_table_as_source_and_deep_copied_destination():
    mixin = _make_mixin()
    request_table = _table()
    fetched_table = _table()
    patched_table = _table()
    mixin._fetch_entity_if_exists.return_value = fetched_table
    mixin.patch.return_value = patched_table

    result = mixin.patch_column_tags(
        table=request_table,
        column_tags=[
            ColumnTag(
                column_fqn=f"{fetched_table.fullyQualifiedName.root}.id",
                tag_label=PII_TAG,
            )
        ],
    )

    assert result is patched_table
    mixin._fetch_entity_if_exists.assert_called_once_with(
        entity=Table,
        entity_id=request_table.id,
        fields=["tags", "columns"],
    )
    patch_call = mixin.patch.call_args.kwargs
    assert patch_call["entity"] is Table
    assert patch_call["source"] is fetched_table
    assert patch_call["destination"] is not fetched_table
    assert fetched_table.columns[0].tags == []
    assert patch_call["destination"].columns[0].tags == [PII_TAG]


def test_patch_column_tags_supports_legacy_entity_alias():
    mixin = _make_mixin()
    request_table = _table()
    fetched_table = _table()
    patched_table = _table()
    mixin._fetch_entity_if_exists.return_value = fetched_table
    mixin.patch.return_value = patched_table

    result = mixin.patch_column_tags(
        entity=request_table,
        column_tags=[
            ColumnTag(
                column_fqn=f"{fetched_table.fullyQualifiedName.root}.id",
                tag_label=PII_TAG,
            )
        ],
    )

    assert result is patched_table
    mixin._fetch_entity_if_exists.assert_called_once_with(
        entity=Table,
        entity_id=request_table.id,
        fields=["tags", "columns"],
    )


def test_patch_column_tags_updates_container_data_model_columns():
    mixin = _make_mixin()
    request_container = _container()
    fetched_container = _container()
    patched_container = _container()
    mixin._fetch_entity_if_exists.return_value = fetched_container
    mixin.patch.return_value = patched_container

    result = mixin.patch_column_tags(
        table=request_container,
        column_tags=[
            ColumnTag(
                column_fqn=f"{fetched_container.fullyQualifiedName.root}.id",
                tag_label=PII_TAG,
            )
        ],
    )

    assert result is patched_container
    mixin._fetch_entity_if_exists.assert_called_once_with(
        entity=Container,
        entity_id=request_container.id,
        fields=["tags", "dataModel"],
    )
    patch_call = mixin.patch.call_args.kwargs
    assert patch_call["entity"] is Container
    assert patch_call["source"] is fetched_container
    assert patch_call["destination"] is not fetched_container
    assert fetched_container.dataModel.columns[0].tags == []
    assert patch_call["destination"].dataModel.columns[0].tags == [PII_TAG]


def test_patch_column_tags_skips_when_no_entity_is_provided():
    mixin = _make_mixin()

    assert mixin.patch_column_tags() is None
    mixin._fetch_entity_if_exists.assert_not_called()
    mixin.patch.assert_not_called()


def test_patch_column_tags_skips_unsupported_entity_type():
    mixin = _make_mixin()

    assert mixin.patch_column_tags(table=object(), column_tags=[]) is None
    mixin._fetch_entity_if_exists.assert_not_called()
    mixin.patch.assert_not_called()
