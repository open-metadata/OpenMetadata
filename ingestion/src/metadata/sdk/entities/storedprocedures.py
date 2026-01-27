"""
StoredProcedures entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.sdk.entities.base import BaseEntity


class StoredProcedures(BaseEntity[StoredProcedure, CreateStoredProcedureRequest]):
    """StoredProcedures SDK class - plural to avoid conflict with generated StoredProcedure entity"""

    @classmethod
    def entity_type(cls) -> Type[StoredProcedure]:
        """Return the StoredProcedure entity type"""
        return StoredProcedure
