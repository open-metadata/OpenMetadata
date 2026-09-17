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

from pydantic import BaseModel, Field, field_validator


class QlikSpaceType(Enum):
    MANAGED = "Managed"
    SHARED = "Shared"
    PERSONAL = "Personal"
    DATA = "Data"


# Space Models
class QlikSpace(BaseModel):
    """QlikCloud Space Model"""

    name: str | None = None
    description: str | None = None
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

    description: str | None = None
    name: str | None = None
    id: str
    app_id: str | None = Field(None, alias="resourceId")
    space_id: str | None = Field("", alias="spaceId")
    published: bool | None = None


class QlikLink(BaseModel):
    href: str | None = None


class QlikLinks(BaseModel):
    next: QlikLink | None = None


class QlikSpaceResponse(BaseModel):
    """QlikCloud Spaces List"""

    spaces: list[QlikSpace] | None = Field(None, alias="data")
    links: QlikLinks | None = None


class QlikAppResponse(BaseModel):
    """QlikCloud Apps List"""

    apps: list[QlikApp] | None = Field(None, alias="data")
    links: QlikLinks | None = None


class QlikScript(BaseModel):
    qScript: str | None = None  # noqa: N815


class QlikScriptResult(BaseModel):
    result: QlikScript | None = QlikScript()


class QlikDataFile(BaseModel):
    id: str
    name: str
    folder: bool = False


class QlikDataFiles(BaseModel):
    data: list[QlikDataFile] | None = None
