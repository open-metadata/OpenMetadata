"""Tables entity SDK with fluent helpers."""
from __future__ import annotations

from typing import Any, Optional, Type, cast

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.tests.createCustomMetric import (
    CreateCustomMetricRequest,
)
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
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

    @classmethod
    def add_custom_metric(
        cls, table_id: UuidLike, custom_metric: CreateCustomMetricRequest
    ) -> Table:
        """Add or update a table-level custom metric."""
        client = cls._get_client()
        updated = cast(Any, client).create_or_update_custom_metric(
            custom_metric=custom_metric,
            table_id=cls._stringify_identifier(table_id),
        )
        return cls._coerce_entity(updated)

    @classmethod
    def add_sample_data(
        cls, table_id: UuidLike, sample_data: TableData
    ) -> Optional[TableData]:
        """Attach sample data rows to a table."""
        client = cls._get_client()
        table = cls._build_table_reference(table_id)
        return client.ingest_table_sample_data(table, sample_data)

    @classmethod
    def get_sample_data(cls, table_id: UuidLike) -> Optional[Table]:
        """Fetch a table including its sample data payload."""
        client = cls._get_client()
        table = cls._build_table_reference(table_id)
        result = cast(Any, client).get_sample_data(table)
        if result is None:
            return None
        return cls._coerce_entity(result)

    @classmethod
    def _build_table_reference(cls, table_id: UuidLike) -> Table:
        """Build a lightweight table reference object for table-specific operations."""
        table_id_value = cls._stringify_identifier(table_id)
        return Table(
            id=Uuid(root=table_id_value),
            name="sdk_table_reference",
            fullyQualifiedName=FullyQualifiedEntityName(root="sdk.table.reference"),
            columns=[],
        )
