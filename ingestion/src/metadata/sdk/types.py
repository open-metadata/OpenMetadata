"""Common type aliases for the OpenMetadata SDK."""

from __future__ import annotations

from typing import Any, TypeAlias
from uuid import UUID

from metadata.generated.schema.type import basic as _basic
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata as _OMeta

JsonDict: TypeAlias = dict[str, Any]
UuidLike: TypeAlias = str | UUID | _basic.Uuid

OMetaClient: TypeAlias = _OMeta[BaseModel, BaseModel]


def ensure_uuid(value: UuidLike) -> _basic.Uuid:
    """Convert any UUID-like value to the schema Uuid type."""
    if isinstance(value, _basic.Uuid):
        return value
    if isinstance(value, UUID):
        return _basic.Uuid(value)
    return _basic.Uuid(UUID(str(value)))


__all__ = ["JsonDict", "UuidLike", "OMetaClient", "ensure_uuid"]
