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
Hex API Response Models
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Creator(BaseModel):
    """Creator information"""

    email: Optional[str] = None


class Owner(BaseModel):
    """Owner information"""

    email: Optional[str] = None


class ProjectStatus(BaseModel):
    """Project status"""

    name: Optional[str] = None


class Category(BaseModel):
    """Project category"""

    name: Optional[str] = None
    description: Optional[str] = None


class Reviews(BaseModel):
    """Project reviews settings"""

    required: Optional[bool] = None


class AppViews(BaseModel):
    """App view counts"""

    allTime: Optional[int] = Field(None, alias="all_time")
    lastSevenDays: Optional[int] = Field(None, alias="last_seven_days")
    lastFourteenDays: Optional[int] = Field(None, alias="last_fourteen_days")
    lastThirtyDays: Optional[int] = Field(None, alias="last_thirty_days")


class ProjectAnalytics(BaseModel):
    """Project analytics data"""

    appViews: Optional[AppViews] = Field(None, alias="app_views")
    lastViewedAt: Optional[datetime] = Field(None, alias="last_viewed_at")
    publishedResultsUpdatedAt: Optional[datetime] = Field(
        None, alias="published_results_updated_at"
    )


class Project(BaseModel):
    """Hex Project Model"""

    id: str
    title: str
    description: Optional[str] = None
    type: Optional[str] = None
    creator: Optional[Creator] = None
    owner: Optional[Owner] = None
    status: Optional[ProjectStatus] = None
    categories: List[Category] = Field(default_factory=list)
    reviews: Optional[Reviews] = None
    analytics: Optional[ProjectAnalytics] = None
    lastEditedAt: Optional[datetime] = Field(None, alias="last_edited_at")
    lastPublishedAt: Optional[datetime] = Field(None, alias="last_published_at")
    createdAt: Optional[datetime] = Field(None, alias="created_at")
    archivedAt: Optional[datetime] = Field(None, alias="archived_at")
    trashedAt: Optional[datetime] = Field(None, alias="trashed_at")
    schedules: List = Field(default_factory=list)


class Pagination(BaseModel):
    """Pagination information"""

    after: Optional[str] = None
    before: Optional[str] = None


class ProjectListResponse(BaseModel):
    """List Projects API Response"""

    values: List[Project] = Field(default_factory=list)
    pagination: Optional[Pagination] = None


class ProjectRunInput(BaseModel):
    """Project run input parameter"""

    name: str
    value: Optional[str] = None


class ProjectRun(BaseModel):
    """Project run information"""

    projectId: str = Field(alias="project_id")
    runId: str = Field(alias="run_id")
    status: Optional[str] = None
    startedAt: Optional[datetime] = Field(None, alias="started_at")
    completedAt: Optional[datetime] = Field(None, alias="completed_at")
    inputs: List[ProjectRunInput] = Field(default_factory=list)


class ProjectRunsResponse(BaseModel):
    """Get Project Runs API Response"""

    runs: List[ProjectRun] = Field(default_factory=list)
    nextPage: Optional[str] = Field(None, alias="next_page")


class DataConnection(BaseModel):
    """Data connection information"""

    id: str
    name: str
    type: Optional[str] = None
    description: Optional[str] = None


class DataConnectionsResponse(BaseModel):
    """Data Connections API Response"""

    connections: List[DataConnection] = Field(default_factory=list)
    nextPage: Optional[str] = Field(None, alias="next_page")
