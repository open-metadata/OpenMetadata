"""
Containers entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.sdk.entities.base import BaseEntity


class Containers(BaseEntity[Container, CreateContainerRequest]):
    """Containers SDK class - plural to avoid conflict with generated Container entity"""

    @classmethod
    def entity_type(cls) -> Type[Container]:
        """Return the Container entity type"""
        return Container
