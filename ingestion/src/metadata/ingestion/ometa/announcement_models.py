#  Copyright 2026 Collate
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
Announcement models for the Python OMeta fluent client.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import ConfigDict

from metadata.generated.schema.type import basic, entityReference
from metadata.ingestion.models.custom_pydantic import BaseModel


class AnnouncementStatus(str, Enum):
    Active = "Active"
    Expired = "Expired"
    Scheduled = "Scheduled"


class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    name: Optional[basic.EntityName] = None
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None
    displayName: Optional[str] = None
    description: basic.Markdown
    entityLink: Optional[basic.EntityLink] = None
    startTime: basic.Timestamp
    endTime: basic.Timestamp
    status: Optional[AnnouncementStatus] = None
    createdBy: Optional[str] = None
    updatedBy: Optional[str] = None
    owners: Optional[List[entityReference.EntityReference]] = None
    domains: Optional[List[entityReference.EntityReference]] = None
    createdAt: Optional[basic.Timestamp] = None
    updatedAt: Optional[basic.Timestamp] = None
    version: Optional[float] = None
    href: Optional[basic.Href] = None
    deleted: Optional[bool] = None


class CreateAnnouncementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[basic.EntityName] = None
    displayName: Optional[str] = None
    description: basic.Markdown
    entityLink: Optional[basic.EntityLink] = None
    startTime: basic.Timestamp
    endTime: basic.Timestamp
    owners: Optional[List[str]] = None
