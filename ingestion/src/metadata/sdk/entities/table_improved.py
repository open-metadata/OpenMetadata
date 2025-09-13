"""
Improved Table entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.sdk.entities.base import BaseEntity


class Table(BaseEntity[TableEntity, CreateTableRequest]):
    """
    Table entity wrapper with static methods for CRUD operations.

    This class provides a clean API that avoids conflicts with Pydantic models
    by using static methods instead of instance methods.

    Example usage:
        # Create a table
        create_request = CreateTableRequest(
            name="users",
            databaseSchema="prod.analytics",
            columns=[...]
        )
        table = Table.create(create_request)

        # Retrieve a table
        table = Table.retrieve("550e8400-e29b-41d4-a716-446655440000")
        table = Table.retrieve_by_name("prod.analytics.users")

        # Update a table (PUT)
        table.description = "Updated description"
        updated_table = Table.update(table.id, table)

        # Patch a table (PATCH)
        patch = [
            {"op": "add", "path": "/description", "value": "New description"},
            {"op": "add", "path": "/tags/0", "value": {"tagFQN": "PII.Sensitive"}}
        ]
        patched_table = Table.patch(table.id, patch)

        # Delete a table
        Table.delete(table.id, recursive=True, hard_delete=False)

        # List tables
        tables = Table.list(limit=20)

        # Async operations
        table = await Table.create_async(create_request)
        table = await Table.retrieve_async(table_id)
    """

    @classmethod
    def entity_type(cls) -> Type[TableEntity]:
        """Return the Table entity type"""
        return TableEntity
