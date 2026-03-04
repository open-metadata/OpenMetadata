"""
Databases entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.sdk.entities.base import BaseEntity


class Databases(BaseEntity[Database, CreateDatabaseRequest]):
    """Databases SDK class - plural to avoid conflict with generated Database entity"""

    @classmethod
    def entity_type(cls) -> Type[Database]:
        """Return the Database entity type"""
        return Database
