"""Glossary terms entity SDK."""
from __future__ import annotations

from typing import Type

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.sdk.entities.base import BaseEntity


class GlossaryTerms(BaseEntity[GlossaryTerm, CreateGlossaryTermRequest]):
    """SDK facade for glossary term entities."""

    @classmethod
    def entity_type(cls) -> Type[GlossaryTerm]:
        return GlossaryTerm
