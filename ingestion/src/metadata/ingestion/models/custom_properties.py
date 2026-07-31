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
from typing import Optional, Type, TypeVar  # noqa: UP035

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
    entity_type: Type[T]  # noqa: UP006
    createCustomPropertyRequest: CreateCustomPropertyRequest  # noqa: N815


class CustomPropertyType(BaseModel):
    """
    Pydantic Model for custom properties
    """

    id: basic.Uuid
    name: basic.EntityName
    displayName: Optional[str] = None  # noqa: N815, UP045
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None  # noqa: N815, UP045
    description: Optional[basic.Markdown] = None  # noqa: UP045
    category: Optional[str] = None  # noqa: UP045
    nameSpace: Optional[str] = None  # noqa: N815, UP045
    version: Optional[entityHistory.EntityVersion] = None  # noqa: UP045
    updatedAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    updatedBy: Optional[str] = None  # noqa: N815, UP045
    href: Optional[basic.Href] = None  # noqa: UP045
