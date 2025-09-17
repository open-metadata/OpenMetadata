"""
GlossaryTerms entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.sdk.entities.base import BaseEntity


class GlossaryTerms(BaseEntity[GlossaryTerm, CreateGlossaryTermRequest]):
    """GlossaryTerms SDK class - plural to avoid conflict with generated GlossaryTerm entity"""

    @classmethod
    def entity_type(cls) -> Type[GlossaryTerm]:
        """Return the GlossaryTerm entity type"""
        return GlossaryTerm

    @classmethod
    def add_asset(cls, term_id: str, asset_id: str, asset_type: str) -> GlossaryTerm:
        """
        Add an asset to a glossary term

        Args:
            term_id: Term UUID
            asset_id: Asset UUID
            asset_type: Type of asset (table, dashboard, etc.)

        Returns:
            Updated glossary term
        """
        client = cls._get_client()
        json_patch = [
            {
                "op": "add",
                "path": "/assets/-",
                "value": {"id": asset_id, "type": asset_type},
            }
        ]
        return client.patch(
            entity=GlossaryTerm, entity_id=term_id, json_patch=json_patch
        )
