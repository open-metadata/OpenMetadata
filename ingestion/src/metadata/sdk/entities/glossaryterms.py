"""
GlossaryTerms entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.sdk.entities.base import BaseEntity


class GlossaryTerms(BaseEntity[GlossaryTerm, CreateGlossaryTermRequest]):
    """GlossaryTerms SDK class - plural to avoid conflict with generated GlossaryTerm entity"""

    @classmethod
    def entity_type(cls) -> Type[GlossaryTerm]:  # noqa: UP006
        """Return the GlossaryTerm entity type"""
        return GlossaryTerm
