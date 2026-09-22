"""
DatabaseSchemas entity SDK with fluent API
"""

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.sdk.entities.base import BaseEntity


class DatabaseSchemas(BaseEntity[DatabaseSchema, CreateDatabaseSchemaRequest]):
    """DatabaseSchemas SDK class - plural to avoid conflict with generated DatabaseSchema entity"""

    @classmethod
    def entity_type(cls) -> type[DatabaseSchema]:
        """Return the DatabaseSchema entity type"""
        return DatabaseSchema
