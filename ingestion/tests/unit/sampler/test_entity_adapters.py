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

from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.sampler.entity_adapters import adapter_for


def test_patch_mixin_imports_entity_adapters():
    import metadata.ingestion.ometa.mixins.patch_mixin  # noqa: F401


def test_table_adapter_reads_and_writes_columns():
    columns = [Column.model_construct(name="id")]
    table = Table.model_construct(columns=columns)

    adapter = adapter_for(table)

    assert adapter is not None
    assert adapter.patch_fields == ["tags", "columns"]
    assert adapter.get_columns(table) is columns

    replacement = [Column.model_construct(name="name")]
    adapter.set_columns(table, replacement)
    assert table.columns is replacement


def test_container_adapter_reads_and_writes_data_model_columns():
    columns = [Column.model_construct(name="id")]
    container = Container.model_construct(
        dataModel=ContainerDataModel.model_construct(columns=columns)
    )

    adapter = adapter_for(container)

    assert adapter is not None
    assert adapter.patch_fields == ["tags", "dataModel"]
    assert adapter.get_columns(container) is columns

    replacement = [Column.model_construct(name="name")]
    adapter.set_columns(container, replacement)
    assert container.dataModel.columns is replacement
