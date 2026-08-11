"""
Glossaries entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.sdk.entities.base import BaseEntity


class Glossaries(BaseEntity[Glossary, CreateGlossaryRequest]):
    """Glossaries SDK class - plural to avoid conflict with generated Glossary entity"""

    @classmethod
    def entity_type(cls) -> Type[Glossary]:  # noqa: UP006
        """Return the Glossary entity type"""
        return Glossary
