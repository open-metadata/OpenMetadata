"""
Container entity operations for OpenMetadata SDK.
"""
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container as ContainerEntity
from metadata.sdk.entities.base import BaseEntity


class Container(BaseEntity[ContainerEntity, CreateContainerRequest]):
    """Container entity operations"""

    _entity_class = ContainerEntity
    _create_request_class = CreateContainerRequest

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return ContainerEntity
