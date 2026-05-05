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
from typing import Any, Dict, List, Optional  # noqa: UP035

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
    projects: Optional[List[MstrProject]] = None  # noqa: UP006, UP045


class MstrSearchResult(BaseModel):
    """
    Mstr Search Results model
    """

    name: str
    id: str
    type: int
    description: Optional[str] = None  # noqa: UP045
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
    totalItems: Optional[int] = 0  # noqa: N815, UP045
    result: Optional[List[MstrSearchResult]] = None  # noqa: UP006, UP045


class MstrDashboard(BaseModel):
    """
    Mstr Dashboard model
    """

    name: str
    id: str
    type: int
    description: Optional[str] = None  # noqa: UP045
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
    dashboards: Optional[List[MstrDashboard]] = None  # noqa: UP006, UP045


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
    visualizations: List[MstrVisualization]  # noqa: UP006


class MstrChapter(BaseModel):
    key: str
    name: str
    pages: List[MstrPage]  # noqa: UP006


class MstrAvailableObject(BaseModel):
    id: str
    name: str
    type: str
    forms: Optional[List[Dict[str, Any]]] = None  # noqa: UP006, UP045


class MstrDataset(BaseModel):
    id: str
    name: str
    availableObjects: Optional[List[MstrAvailableObject]] = None  # noqa: N815, UP006, UP045
    rows: Optional[List[Dict[str, Any]]] = None  # noqa: UP006, UP045
    columns: Optional[List[Dict[str, Any]]] = None  # noqa: UP006, UP045
    pageBy: Optional[List[Dict[str, Any]]] = None  # noqa: N815, UP006, UP045
    sqlStatement: Optional[str] = None  # noqa: N815, UP045


class MstrDashboardDetails(BaseModel):
    id: str
    name: str
    projectId: str  # noqa: N815
    projectName: str  # noqa: N815
    currentChapter: str  # noqa: N815
    chapters: List[MstrChapter]  # noqa: UP006
    datasets: List[MstrDataset]  # noqa: UP006


class AuthHeaderCookie(BaseModel):
    auth_header: dict
    auth_cookies: Any
