#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
QlikCloud Models
"""
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class QlikSpaceType(Enum):
    MANAGED = "Managed"
    SHARED = "Shared"
    PERSONAL = "Personal"


# Space Models
class QlikSpace(BaseModel):
    """QlikCloud Space Model"""

    name: Optional[str] = None
    description: Optional[str] = None
    id: str
    type: QlikSpaceType

    # Field validator for normalizing and validating space type
    @field_validator("type", mode="before")
    @classmethod
    def normalize_and_validate_type(cls, value):
        """
        Normalize the space type by capitalizing the input value and
        ensure it corresponds to a valid QlikSpaceType enum.

        Args:
            value (str): The space type to validate.

        Returns:
            QlikSpaceType: The corresponding enum member of QlikSpaceType.
        """
        if isinstance(value, str):
            value = value.capitalize()
        return QlikSpaceType(value)


# App Models
class QlikApp(BaseModel):
    """QlikCloud App model"""

    description: Optional[str] = None
    name: Optional[str] = None
    id: str
    app_id: Optional[str] = Field(None, alias="resourceId")
    space_id: Optional[str] = Field("", alias="spaceId")
    published: Optional[bool] = None


class QlikLink(BaseModel):
    href: Optional[str] = None


class QlikLinks(BaseModel):
    next: Optional[QlikLink] = None


class QlikSpaceResponse(BaseModel):
    """QlikCloud Spaces List"""

    spaces: Optional[List[QlikSpace]] = Field(None, alias="data")
    links: Optional[QlikLinks] = None


class QlikAppResponse(BaseModel):
    """QlikCloud Apps List"""

    apps: Optional[List[QlikApp]] = Field(None, alias="data")
    links: Optional[QlikLinks] = None
