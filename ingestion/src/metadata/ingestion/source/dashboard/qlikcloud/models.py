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
from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field, field_validator


class QlikSpaceType(Enum):
    MANAGED = "Managed"
    SHARED = "Shared"
    PERSONAL = "Personal"
    DATA = "Data"


# Space Models
class QlikSpace(BaseModel):
    """QlikCloud Space Model"""

    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
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

    description: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    id: str
    app_id: Optional[str] = Field(None, alias="resourceId")  # noqa: UP045
    space_id: Optional[str] = Field("", alias="spaceId")  # noqa: UP045
    published: Optional[bool] = None  # noqa: UP045


class QlikLink(BaseModel):
    href: Optional[str] = None  # noqa: UP045


class QlikLinks(BaseModel):
    next: Optional[QlikLink] = None  # noqa: UP045


class QlikSpaceResponse(BaseModel):
    """QlikCloud Spaces List"""

    spaces: Optional[List[QlikSpace]] = Field(None, alias="data")  # noqa: UP006, UP045
    links: Optional[QlikLinks] = None  # noqa: UP045


class QlikAppResponse(BaseModel):
    """QlikCloud Apps List"""

    apps: Optional[List[QlikApp]] = Field(None, alias="data")  # noqa: UP006, UP045
    links: Optional[QlikLinks] = None  # noqa: UP045


class QlikScript(BaseModel):
    qScript: Optional[str] = None  # noqa: N815, UP045


class QlikScriptResult(BaseModel):
    result: Optional[QlikScript] = QlikScript()  # noqa: UP045


class QlikDataFile(BaseModel):
    id: str
    name: str
    folder: bool = False


class QlikDataFiles(BaseModel):
    data: Optional[List[QlikDataFile]] = None  # noqa: UP006, UP045
