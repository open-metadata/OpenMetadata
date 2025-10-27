"""
APIEndpoints entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.sdk.entities.base import BaseEntity


class APIEndpoints(BaseEntity[APIEndpoint, CreateAPIEndpointRequest]):
    """APIEndpoints SDK class - plural to avoid conflict with generated APIEndpoint entity"""

    @classmethod
    def entity_type(cls) -> Type[APIEndpoint]:
        """Return the APIEndpoint entity type"""
        return APIEndpoint
