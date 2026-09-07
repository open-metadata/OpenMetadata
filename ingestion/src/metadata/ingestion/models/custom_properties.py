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
Custom models for custom properties
"""

from enum import Enum
from typing import TypeVar

from pydantic import BaseModel

from metadata.generated.schema.api.data.createCustomProperty import (
    CreateCustomPropertyRequest,
)
from metadata.generated.schema.type import basic, entityHistory

T = TypeVar("T", bound=BaseModel)


class CustomPropertyDataTypes(Enum):
    STRING = "string"
    INTEGER = "integer"
    MARKDOWN = "markdown"
    DATE = "date-cp"
    DATETIME = "dateTime-cp"
    DURATION = "duration"
    EMAIL = "email"
    NUMBER = "number"
    SQLQUERY = "sqlQuery"
    TIME = "time-cp"
    TIMEINTERVAL = "timeInterval"
    TIMESTAMP = "timestamp"
    ENUM = "enum"
    ENTITY_REFERENCE = "entityReference"
    ENTITY_REFERENCE_LIST = "entityReferenceList"


class OMetaCustomProperties(BaseModel):
    entity_type: type[T]
    createCustomPropertyRequest: CreateCustomPropertyRequest  # noqa: N815


class CustomPropertyType(BaseModel):
    """
    Pydantic Model for custom properties
    """

    id: basic.Uuid
    name: basic.EntityName
    displayName: str | None = None  # noqa: N815
    fullyQualifiedName: basic.FullyQualifiedEntityName | None = None  # noqa: N815
    description: basic.Markdown | None = None
    category: str | None = None
    nameSpace: str | None = None  # noqa: N815
    version: entityHistory.EntityVersion | None = None
    updatedAt: basic.Timestamp | None = None  # noqa: N815
    updatedBy: str | None = None  # noqa: N815
    href: basic.Href | None = None
