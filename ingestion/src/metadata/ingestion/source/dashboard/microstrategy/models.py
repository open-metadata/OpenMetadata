#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
MicroStrategy Models
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class MicroStrategyOwner(BaseModel):
    """
    MicroStrategy owner model
    """

    name: str
    id: str


class MicroStrategyProject(BaseModel):
    """
    MicroStrategy project model
    """

    acg: int
    id: str
    name: str
    status: int
    alias: str
    description: str
    dateCreated: datetime
    dateModified: datetime
    owner: MicroStrategyOwner


class MicroStrategyProjectList(BaseModel):
    projects: Optional[List[MicroStrategyProject]] = None


class MicroStrategySearchResult(BaseModel):
    """
    MicroStrategy Search Results model
    """

    name: str
    id: str
    type: int
    description: Optional[str] = None
    subtype: int
    dateCreated: str
    dateModified: str
    version: str
    acg: int
    owner: MicroStrategyOwner
    extType: int
    viewMedia: int
    certifiedInfo: dict
    templateInfo: dict
    projectId: str


class MicroStrategySearchResultList(BaseModel):
    results: Optional[List[MicroStrategySearchResult]]


class MicroStrategyDashboard(BaseModel):
    """
    MicroStrategy Dashboard model
    """

    name: str
    id: str
    type: int
    description: Optional[str] = None
    subtype: int
    dateCreated: str
    dateModified: str
    version: str
    acg: int
    owner: MicroStrategyOwner
    extType: int
    viewMedia: int
    certifiedInfo: dict
    templateInfo: dict
    projectId: str
    projectName: str


class MicroStrategyDashboardList(BaseModel):
    dashboards: Optional[List[MicroStrategyDashboard]] = None


class MicroStrategyAttribute(BaseModel):
    id: str
    type: int
    name: str


class MicroStrategyMetric(BaseModel):
    id: str
    type: int
    name: str


class MicroStrategyVisualization(BaseModel):
    key: str
    name: str
    visualizationType: str


class MicroStrategyPage(BaseModel):
    key: str
    name: str
    visualizations: List[MicroStrategyVisualization]


class MicroStrategyChapter(BaseModel):
    key: str
    name: str
    pages: List[MicroStrategyPage]


class MicroStrategyAvailableObject(BaseModel):
    id: str
    name: str
    type: str


class MicroStrategyDashboardDetails(BaseModel):
    id: str
    name: str
    projectId: str
    projectName: str
    currentChapter: str
    chapters: List[MicroStrategyChapter]
