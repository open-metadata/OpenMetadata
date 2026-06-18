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
Entity adapters needed by patch_mixin on the 1.13 branch.
"""

from __future__ import annotations

from typing import ClassVar

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column, Table


class EntityAdapter:
    """Small per-entity adapter for column PATCH helpers."""

    patch_fields: ClassVar[list[str]]

    def get_columns(self, entity) -> list[Column] | None:
        raise NotImplementedError

    def set_columns(self, entity, columns: list[Column]) -> None:
        raise NotImplementedError


class TableAdapter(EntityAdapter):
    patch_fields: ClassVar[list[str]] = ["tags", "columns"]

    def get_columns(self, entity: Table) -> list[Column] | None:
        return entity.columns

    def set_columns(self, entity: Table, columns: list[Column]) -> None:
        entity.columns = columns


class ContainerAdapter(EntityAdapter):
    patch_fields: ClassVar[list[str]] = ["tags", "dataModel"]

    def get_columns(self, entity: Container) -> list[Column] | None:
        return entity.dataModel.columns if entity.dataModel else None

    def set_columns(self, entity: Container, columns: list[Column]) -> None:
        if entity.dataModel:
            entity.dataModel.columns = columns


_BY_ENTITY: dict[type, EntityAdapter] = {
    Table: TableAdapter(),
    Container: ContainerAdapter(),
}


def adapter_for(entity: object) -> EntityAdapter | None:
    """Look up the adapter for a classifiable entity instance."""
    return _BY_ENTITY.get(type(entity))
