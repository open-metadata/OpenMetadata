"""
GlossaryTerms entity SDK with fluent API
"""

from __future__ import annotations

import uuid
from typing import Any, Optional, Sequence, Type, Union  # noqa: UP035

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike

DEFAULT_RELATION_TYPE = "relatedTo"
_GLOSSARY_TERM_TYPE = "glossaryTerm"

TermRef = Union[str, GlossaryTerm, UuidLike]  # noqa: UP007


class GlossaryTerms(BaseEntity[GlossaryTerm, CreateGlossaryTermRequest]):
    """GlossaryTerms SDK class - plural to avoid conflict with generated GlossaryTerm entity"""

    @classmethod
    def entity_type(cls) -> Type[GlossaryTerm]:  # noqa: UP006
        """Return the GlossaryTerm entity type"""
        return GlossaryTerm

    # ------------------------------------------------------------------
    # Typed relations
    # ------------------------------------------------------------------
    @classmethod
    def add_relation(
        cls,
        from_term: TermRef,
        to_term: TermRef,
        relation_type: str = DEFAULT_RELATION_TYPE,
    ) -> GlossaryTerm:
        """Add a typed relation from one glossary term to another.

        ``from_term`` / ``to_term`` accept a glossary term entity, a UUID/id, or a
        fully-qualified name. ``relation_type`` is any built-in (``broader``,
        ``narrower``, ``synonym``, ...) or a custom type registered via
        :meth:`metadata.sdk.Settings.define_glossary_relation_type`.
        """
        rest_client, endpoint = cls._relations_context()
        payload = {
            "term": {"id": cls._resolve_term_id(to_term), "type": _GLOSSARY_TERM_TYPE},
            "relationType": relation_type,
        }
        response = rest_client.post(
            f"{endpoint}/{cls._resolve_term_id(from_term)}/relations",
            json=payload,
        )
        return cls._coerce_entity(response)

    @classmethod
    def remove_relation(
        cls,
        from_term: TermRef,
        to_term: TermRef,
        relation_type: Optional[str] = None,  # noqa: UP045
    ) -> GlossaryTerm:
        """Remove a relation from one glossary term to another.

        When ``relation_type`` is ``None`` all relation types between the two terms
        are removed.
        """
        rest_client, endpoint = cls._relations_context()
        from_id = cls._resolve_term_id(from_term)
        to_id = cls._resolve_term_id(to_term)
        path = f"{endpoint}/{from_id}/relations/{to_id}"
        if relation_type:
            path = f"{path}?relationType={relation_type}"
        response = rest_client.delete(path)
        return cls._coerce_entity(response)

    @classmethod
    def relations_graph(
        cls,
        term: TermRef,
        *,
        depth: int = 1,
        relation_types: Optional[Sequence[str]] = None,  # noqa: UP045
    ) -> dict[str, Any]:
        """Fetch the relation graph rooted at ``term`` (a ``nodes`` + ``edges`` map)."""
        rest_client, endpoint = cls._relations_context()
        path = f"{endpoint}/{cls._resolve_term_id(term)}/relationsGraph?depth={depth}"
        if relation_types:
            path = f"{path}&relationTypes={','.join(relation_types)}"
        return rest_client.get(path)

    @classmethod
    def relation_type_usage(cls) -> dict[str, int]:
        """Return per-relation-type usage counts across all glossary terms."""
        rest_client, endpoint = cls._relations_context()
        return rest_client.get(f"{endpoint}/relationTypes/usage")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @classmethod
    def _relations_context(cls) -> tuple[Any, str]:
        client = cls._get_client()
        return cls._get_rest_client(client), cls._get_endpoint_path(client)

    @classmethod
    def _resolve_term_id(cls, term: TermRef) -> str:
        identifier = getattr(term, "id", None)
        if identifier is not None:
            return cls._stringify_identifier(identifier)
        value = cls._stringify_identifier(term)
        try:
            uuid.UUID(value)
            resolved = value
        except ValueError:
            resolved = cls._stringify_identifier(cls.retrieve_by_name(value).id)
        return resolved
