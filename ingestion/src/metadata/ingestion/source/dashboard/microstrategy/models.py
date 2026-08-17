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
MicroStrategy Models
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class MstrOwner(BaseModel):
    """
    MSTR owner model
    """

    name: str
    id: str


class MstrProject(BaseModel):
    """
    MSTR project model
    """

    acg: int
    id: str
    name: str
    status: int
    alias: str
    description: str
    dateCreated: datetime  # noqa: N815
    dateModified: datetime  # noqa: N815
    owner: MstrOwner


class MstrProjectList(BaseModel):
    projects: list[MstrProject] | None = None


class MstrSearchResult(BaseModel):
    """
    Mstr Search Results model
    """

    name: str
    id: str
    type: int
    description: str | None = None
    subtype: int
    dateCreated: str  # noqa: N815
    dateModified: str  # noqa: N815
    version: str
    acg: int
    owner: MstrOwner
    extType: int  # noqa: N815
    viewMedia: int  # noqa: N815
    certifiedInfo: dict  # noqa: N815
    templateInfo: dict  # noqa: N815
    projectId: str  # noqa: N815


class MstrSearchResultList(BaseModel):
    totalItems: int | None = 0  # noqa: N815
    result: list[MstrSearchResult] | None = None


class MstrDashboard(BaseModel):
    """
    Mstr Dashboard model
    """

    name: str
    id: str
    type: int
    description: str | None = None
    subtype: int
    dateCreated: str  # noqa: N815
    dateModified: str  # noqa: N815
    version: str
    acg: int
    owner: MstrOwner
    extType: int  # noqa: N815
    viewMedia: int  # noqa: N815
    certifiedInfo: dict  # noqa: N815
    templateInfo: dict  # noqa: N815
    projectId: str  # noqa: N815
    projectName: str  # noqa: N815


class MstrDashboardList(BaseModel):
    dashboards: list[MstrDashboard] | None = None


class MstrAttribute(BaseModel):
    id: str
    type: int
    name: str


class MstrMetric(BaseModel):
    id: str
    type: int
    name: str


class MstrVisualization(BaseModel):
    key: str
    name: str
    visualizationType: str  # noqa: N815


class MstrPage(BaseModel):
    key: str
    name: str
    visualizations: list[MstrVisualization]


class MstrChapter(BaseModel):
    key: str
    name: str
    pages: list[MstrPage]


class MstrAvailableObject(BaseModel):
    id: str
    name: str
    type: str
    forms: list[dict[str, Any]] | None = None


class MstrDataset(BaseModel):
    id: str
    name: str
    availableObjects: list[MstrAvailableObject] | None = None  # noqa: N815
    rows: list[dict[str, Any]] | None = None
    columns: list[dict[str, Any]] | None = None
    pageBy: list[dict[str, Any]] | None = None  # noqa: N815
    sqlStatement: str | None = None  # noqa: N815


class MstrDashboardDetails(BaseModel):
    id: str
    name: str
    projectId: str  # noqa: N815
    projectName: str  # noqa: N815
    currentChapter: str  # noqa: N815
    chapters: list[MstrChapter]
    datasets: list[MstrDataset]


class AuthHeaderCookie(BaseModel):
    auth_header: dict
    auth_cookies: Any
