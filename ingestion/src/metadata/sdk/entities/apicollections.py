"""
APICollections entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.sdk.entities.base import BaseEntity


class APICollections(BaseEntity[APICollection, CreateAPICollectionRequest]):
    """APICollections SDK class - plural to avoid conflict with generated APICollection entity"""

    @classmethod
    def entity_type(cls) -> Type[APICollection]:
        """Return the APICollection entity type"""
        return APICollection
