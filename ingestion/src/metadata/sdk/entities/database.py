"""
Database entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.database import Database as DatabaseEntity
from metadata.sdk.entities.base import BaseEntity


class Database(BaseEntity[DatabaseEntity, CreateDatabaseRequest]):
    """
    Database entity wrapper with static methods for CRUD operations.

    Example usage:
        # Create a database
        create_request = CreateDatabaseRequest(
            name="analytics",
            service="postgres-prod",
            description="Analytics database"
        )
        database = Database.create(create_request)

        # Retrieve a database
        database = Database.retrieve(database_id)
        database = Database.retrieve_by_name("postgres-prod.analytics")

        # Update a database
        database.description = "Updated analytics database"
        updated = Database.update(database.id, database)

        # Patch a database
        patch = [{"op": "replace", "path": "/description", "value": "New description"}]
        patched = Database.patch(database.id, patch)

        # Delete a database
        Database.delete(database.id, recursive=True)

        # List databases
        databases = Database.list(limit=50)
    """

    @classmethod
    def entity_type(cls) -> Type[DatabaseEntity]:
        """Return the Database entity type"""
        return DatabaseEntity
