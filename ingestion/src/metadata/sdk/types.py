"""Common type aliases for the OpenMetadata SDK."""
from __future__ import annotations

from typing import Any, TypeAlias
from uuid import UUID

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata as _OMeta

JsonDict: TypeAlias = dict[str, Any]
UuidLike: TypeAlias = str | UUID

OMetaClient: TypeAlias = _OMeta[BaseModel, BaseModel]

__all__ = ["JsonDict", "UuidLike", "OMetaClient"]
