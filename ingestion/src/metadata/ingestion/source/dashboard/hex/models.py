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

from pydantic import BaseModel, Field


class Creator(BaseModel):
    """Creator information"""

    email: str | None = None


class Owner(BaseModel):
    """Owner information"""

    email: str | None = None


class ProjectStatus(BaseModel):
    """Project status"""

    name: str | None = None


class Category(BaseModel):
    """Project category"""

    name: str | None = None
    description: str | None = None


class Reviews(BaseModel):
    """Project reviews settings"""

    required: bool | None = None


class AppViews(BaseModel):
    """App view counts"""

    allTime: int | None = Field(None, alias="all_time")  # noqa: N815
    lastSevenDays: int | None = Field(None, alias="last_seven_days")  # noqa: N815
    lastFourteenDays: int | None = Field(None, alias="last_fourteen_days")  # noqa: N815
    lastThirtyDays: int | None = Field(None, alias="last_thirty_days")  # noqa: N815


class ProjectAnalytics(BaseModel):
    """Project analytics data"""

    appViews: AppViews | None = Field(None, alias="app_views")  # noqa: N815
    lastViewedAt: datetime | None = Field(None, alias="last_viewed_at")  # noqa: N815
    publishedResultsUpdatedAt: datetime | None = Field(None, alias="published_results_updated_at")  # noqa: N815


class Project(BaseModel):
    """Hex Project Model"""

    id: str
    title: str
    description: str | None = None
    type: str | None = None
    creator: Creator | None = None
    owner: Owner | None = None
    status: ProjectStatus | None = None
    categories: list[Category] = Field(default_factory=list)
    reviews: Reviews | None = None
    analytics: ProjectAnalytics | None = None
    lastEditedAt: datetime | None = Field(None, alias="last_edited_at")  # noqa: N815
    lastPublishedAt: datetime | None = Field(None, alias="last_published_at")  # noqa: N815
    createdAt: datetime | None = Field(None, alias="created_at")  # noqa: N815
    archivedAt: datetime | None = Field(None, alias="archived_at")  # noqa: N815
    trashedAt: datetime | None = Field(None, alias="trashed_at")  # noqa: N815
    schedules: list = Field(default_factory=list)


class Pagination(BaseModel):
    """Pagination information"""

    after: str | None = None
    before: str | None = None


class ProjectListResponse(BaseModel):
    """List Projects API Response"""

    values: list[Project] = Field(default_factory=list)
    pagination: Pagination | None = None


class ProjectRunInput(BaseModel):
    """Project run input parameter"""

    name: str
    value: str | None = None


class ProjectRun(BaseModel):
    """Project run information"""

    projectId: str = Field(alias="project_id")  # noqa: N815
    runId: str = Field(alias="run_id")  # noqa: N815
    status: str | None = None
    startedAt: datetime | None = Field(None, alias="started_at")  # noqa: N815
    completedAt: datetime | None = Field(None, alias="completed_at")  # noqa: N815
    inputs: list[ProjectRunInput] = Field(default_factory=list)


class ProjectRunsResponse(BaseModel):
    """Get Project Runs API Response"""

    runs: list[ProjectRun] = Field(default_factory=list)
    nextPage: str | None = Field(None, alias="next_page")  # noqa: N815


class DataConnection(BaseModel):
    """Data connection information"""

    id: str
    name: str
    type: str | None = None
    description: str | None = None


class DataConnectionsResponse(BaseModel):
    """Data Connections API Response"""

    connections: list[DataConnection] = Field(default_factory=list)
    nextPage: str | None = Field(None, alias="next_page")  # noqa: N815
