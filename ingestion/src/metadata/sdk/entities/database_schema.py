"""
DatabaseSchema entity operations for OpenMetadata SDK.
"""
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema as DatabaseSchemaEntity,
)
from metadata.sdk.entities.base import BaseEntity


class DatabaseSchema(BaseEntity[DatabaseSchemaEntity, CreateDatabaseSchemaRequest]):
    """DatabaseSchema entity operations"""

    _entity_class = DatabaseSchemaEntity
    _create_request_class = CreateDatabaseSchemaRequest

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return DatabaseSchemaEntity
