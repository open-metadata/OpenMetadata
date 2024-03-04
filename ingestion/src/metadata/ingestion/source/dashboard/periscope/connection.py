from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Extra, Field

from metadata.ingestion.models.custom_pydantic import CustomSecretStr


class PeriscopeType(Enum):
    Periscope = 'Periscope'


class PeriscopeConnection(BaseModel):
    class Config:
        extra = Extra.forbid

    type: Optional[PeriscopeType] = Field(
        PeriscopeType.Periscope, description='Service Type', title='Service Type'
    )
    cookies: str = Field(
        ...,
        description='Cookies to connect to Periscope. This user should have privileges to read all the metadata in Periscope.',
        title='Cookies',
    )
    client_site_id: str = Field(
        None,
        description='Client Site ID. This is the unique identifier for the Periscope instance.',
        title='Client Site ID',
    )
    supportsMetadataExtraction: Optional[bool] = Field(None, title='Supports Metadata Extraction')
