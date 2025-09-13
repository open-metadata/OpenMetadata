"""
Glossary entity operations for OpenMetadata SDK.
"""
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.entity.data.glossary import Glossary as GlossaryEntity
from metadata.sdk.entities.base import BaseEntity


class Glossary(BaseEntity[GlossaryEntity, CreateGlossaryRequest]):
    """Glossary entity operations"""

    _entity_class = GlossaryEntity
    _create_request_class = CreateGlossaryRequest

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return GlossaryEntity
