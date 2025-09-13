"""
GlossaryTerm entity operations for OpenMetadata SDK.
"""
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import (
    GlossaryTerm as GlossaryTermEntity,
)
from metadata.sdk.entities.base import BaseEntity


class GlossaryTerm(BaseEntity[GlossaryTermEntity, CreateGlossaryTermRequest]):
    """GlossaryTerm entity operations"""

    _entity_class = GlossaryTermEntity
    _create_request_class = CreateGlossaryTermRequest

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return GlossaryTermEntity
