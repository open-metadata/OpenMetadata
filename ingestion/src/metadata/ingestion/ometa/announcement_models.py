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
from typing import List, Optional  # noqa: UP035

from pydantic import ConfigDict

from metadata.generated.schema.type import basic, entityReference  # noqa: TC001
from metadata.ingestion.models.custom_pydantic import BaseModel


class AnnouncementStatus(str, Enum):
    Active = "Active"
    Expired = "Expired"
    Scheduled = "Scheduled"


class Announcement(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: basic.Uuid
    name: Optional[basic.EntityName] = None  # noqa: UP045
    fullyQualifiedName: Optional[basic.FullyQualifiedEntityName] = None  # noqa: N815, UP045
    displayName: Optional[str] = None  # noqa: N815, UP045
    description: basic.Markdown
    entityLink: Optional[basic.EntityLink] = None  # noqa: N815, UP045
    startTime: basic.Timestamp  # noqa: N815
    endTime: basic.Timestamp  # noqa: N815
    status: Optional[AnnouncementStatus] = None  # noqa: UP045
    createdBy: Optional[str] = None  # noqa: N815, UP045
    updatedBy: Optional[str] = None  # noqa: N815, UP045
    owners: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    domains: Optional[List[entityReference.EntityReference]] = None  # noqa: UP006, UP045
    createdAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    updatedAt: Optional[basic.Timestamp] = None  # noqa: N815, UP045
    version: Optional[float] = None  # noqa: UP045
    href: Optional[basic.Href] = None  # noqa: UP045
    deleted: Optional[bool] = None  # noqa: UP045


class CreateAnnouncementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[basic.EntityName] = None  # noqa: UP045
    displayName: Optional[str] = None  # noqa: N815, UP045
    description: basic.Markdown
    entityLink: Optional[basic.EntityLink] = None  # noqa: N815, UP045
    startTime: basic.Timestamp  # noqa: N815
    endTime: basic.Timestamp  # noqa: N815
    owners: Optional[List[str]] = None  # noqa: UP006, UP045
