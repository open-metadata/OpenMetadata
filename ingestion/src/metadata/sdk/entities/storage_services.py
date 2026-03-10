"""StorageServices entity SDK."""
from __future__ import annotations

from typing import Type

from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.sdk.entities.base import BaseEntity


class StorageServices(BaseEntity[StorageService, CreateStorageServiceRequest]):
    """Fluent facade for storage service operations."""

    @classmethod
    def entity_type(cls) -> Type[StorageService]:
        return StorageService
