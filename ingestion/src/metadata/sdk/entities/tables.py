"""
Tables entity SDK with fluent API - uses plural to avoid conflict with generated Table entity
"""
from typing import Dict, List, Type

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.sdk.entities.base import BaseEntity


class Tables(BaseEntity[Table, CreateTableRequest]):
    """Tables SDK class - plural to avoid conflict with generated Table entity"""

    @classmethod
    def entity_type(cls) -> Type[Table]:
        """Return the Table entity type"""
        return Table

    # Remove the custom update method to use the base class implementation
    # The base class update method properly handles JSON Patch generation

    @classmethod
    def _generate_patch(cls, current: Table, modified: Table) -> List[Dict]:
        """
        Generate JSON Patch by comparing current and modified entities
        This is an internal method - users never see this
        """
        patches = []

        # Check simple fields
        simple_fields = ["description", "displayName", "tier"]
        for field in simple_fields:
            current_val = getattr(current, field, None)
            modified_val = getattr(modified, field, None)
            if current_val != modified_val:
                if modified_val is None:
                    patches.append({"op": "remove", "path": f"/{field}"})
                else:
                    op = "replace" if current_val is not None else "add"
                    patches.append(
                        {"op": op, "path": f"/{field}", "value": modified_val}
                    )

        # Check tags
        if hasattr(modified, "tags") and modified.tags != current.tags:
            patches.append(
                {
                    "op": "replace",
                    "path": "/tags",
                    "value": [
                        tag.dict() if hasattr(tag, "dict") else tag
                        for tag in (modified.tags or [])
                    ],
                }
            )

        # Check columns for changes
        if hasattr(modified, "columns") and modified.columns != current.columns:
            for i, col in enumerate(modified.columns):
                if i < len(current.columns):
                    current_col = current.columns[i]
                    # Check column description
                    if col.description != current_col.description:
                        patches.append(
                            {
                                "op": "replace",
                                "path": f"/columns/{i}/description",
                                "value": col.description,
                            }
                        )
                    # Check column tags
                    if hasattr(col, "tags") and col.tags != current_col.tags:
                        patches.append(
                            {
                                "op": "replace",
                                "path": f"/columns/{i}/tags",
                                "value": [
                                    tag.dict() if hasattr(tag, "dict") else tag
                                    for tag in (col.tags or [])
                                ],
                            }
                        )

        return patches

    @classmethod
    def add_tag(cls, table_id: str, tag_fqn: str) -> Table:
        """
        Add a tag to a table

        Args:
            table_id: Table UUID
            tag_fqn: Fully qualified tag name

        Returns:
            Updated table
        """
        from metadata.generated.schema.type.tagLabel import (
            LabelType,
            TagLabel,
            TagSource,
        )

        client = cls._get_client()
        # Get current table
        table = client.get_by_id(entity=Table, entity_id=table_id, fields=["tags"])

        # Create modified version with new tag
        modified_table = table.model_copy(deep=True)
        new_tag = TagLabel(
            tagFQN=tag_fqn, source=TagSource.Classification, labelType=LabelType.Manual
        )

        if modified_table.tags is None:
            modified_table.tags = []
        modified_table.tags.append(new_tag)

        # Apply patch using proper method signature
        return client.patch(entity=Table, source=table, destination=modified_table)

    @classmethod
    def update_column_description(
        cls, table_id: str, column_name: str, description: str
    ) -> Table:
        """
        Update a specific column's description

        Args:
            table_id: Table UUID
            column_name: Name of the column
            description: New description

        Returns:
            Updated table
        """
        client = cls._get_client()
        table = client.get_by_id(entity=Table, entity_id=table_id, fields=["columns"])

        # Create modified version with updated column description
        modified_table = table.model_copy(deep=True)

        # Find and update the column
        column_found = False
        for col in modified_table.columns:
            if (
                str(col.name.root)
                if hasattr(col.name, "root")
                else col.name == column_name
            ):
                col.description = description
                column_found = True
                break

        if not column_found:
            raise ValueError(f"Column {column_name} not found in table")

        # Apply patch using proper method signature
        return client.patch(entity=Table, source=table, destination=modified_table)
