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
from typing import Optional, Type, TypeVar

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
    entity_type: Type[T]
    createCustomPropertyRequest: CreateCustomPropertyRequest


class CustomPropertyType(BaseModel):
    """
    Pydantic Model for custom properties
    """

    id: basic.Uuid
    name: basic.EntityName
    displayName: Optional[str] = None
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None
    description: Optional[basic.Markdown] = None
    category: Optional[str] = None
    nameSpace: Optional[str] = None
    version: Optional[entityHistory.EntityVersion] = None
    updatedAt: Optional[basic.Timestamp] = None
    updatedBy: Optional[str] = None
    href: Optional[basic.Href] = None
