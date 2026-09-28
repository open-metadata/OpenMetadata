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
    name: basic.EntityName | None = None
    fullyQualifiedName: basic.FullyQualifiedEntityName | None = None  # noqa: N815
    displayName: str | None = None  # noqa: N815
    description: basic.Markdown
    entityLink: basic.EntityLink | None = None  # noqa: N815
    startTime: basic.Timestamp  # noqa: N815
    endTime: basic.Timestamp  # noqa: N815
    status: AnnouncementStatus | None = None
    createdBy: str | None = None  # noqa: N815
    updatedBy: str | None = None  # noqa: N815
    owners: list[entityReference.EntityReference] | None = None
    domains: list[entityReference.EntityReference] | None = None
    createdAt: basic.Timestamp | None = None  # noqa: N815
    updatedAt: basic.Timestamp | None = None  # noqa: N815
    version: float | None = None
    href: basic.Href | None = None
    deleted: bool | None = None


class CreateAnnouncementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: basic.EntityName | None = None
    displayName: str | None = None  # noqa: N815
    description: basic.Markdown
    entityLink: basic.EntityLink | None = None  # noqa: N815
    startTime: basic.Timestamp  # noqa: N815
    endTime: basic.Timestamp  # noqa: N815
    owners: list[str] | None = None
