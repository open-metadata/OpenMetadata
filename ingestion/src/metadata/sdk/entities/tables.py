"""Tables entity SDK with fluent helpers."""
from __future__ import annotations

from typing import Any, Type, cast

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike


class Tables(BaseEntity[Table, CreateTableRequest]):
    """SDK facade for `Table` entities."""

    @classmethod
    def entity_type(cls) -> Type[Table]:
        return Table

    @classmethod
    def add_tag(cls, table_id: UuidLike, tag_fqn: str) -> Table:
        """Attach a classification or glossary tag to the table."""
        client = cls._get_client()
        current = client.get_by_id(
            entity=Table,
            entity_id=cls._stringify_identifier(table_id),
            fields=["tags"],
        )

        working = getattr(current, "model_copy", None)
        working = working(deep=True) if callable(working) else current

        tags = list(getattr(working, "tags", []) or [])
        tags.append({"tagFQN": tag_fqn})
        setattr(working, "tags", tags)

        updated = cast(Any, client).patch(
            entity=Table,
            source=current,
            destination=working,
        )
        return cls._coerce_entity(updated)

    @classmethod
    def update_column_description(
        cls, table_id: UuidLike, column_name: str, description: str
    ) -> Table:
        """Update the description for a specific column."""
        client = cls._get_client()
        current = client.get_by_id(
            entity=Table,
            entity_id=cls._stringify_identifier(table_id),
            fields=["columns"],
        )

        working = getattr(current, "model_copy", None)
        working = working(deep=True) if callable(working) else current

        for column in getattr(working, "columns", []) or []:
            if getattr(column, "name", None) == column_name:
                setattr(column, "description", description)
                break

        updated = cast(Any, client).patch(
            entity=Table,
            source=current,
            destination=working,
        )
        return cls._coerce_entity(updated)
