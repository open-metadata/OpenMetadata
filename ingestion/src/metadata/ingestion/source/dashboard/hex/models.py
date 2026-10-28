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
from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class Creator(BaseModel):
    """Creator information"""

    email: Optional[str] = None  # noqa: UP045


class Owner(BaseModel):
    """Owner information"""

    email: Optional[str] = None  # noqa: UP045


class ProjectStatus(BaseModel):
    """Project status"""

    name: Optional[str] = None  # noqa: UP045


class Category(BaseModel):
    """Project category"""

    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045


class Reviews(BaseModel):
    """Project reviews settings"""

    required: Optional[bool] = None  # noqa: UP045


class AppViews(BaseModel):
    """App view counts"""

    allTime: Optional[int] = Field(None, alias="all_time")  # noqa: N815, UP045
    lastSevenDays: Optional[int] = Field(None, alias="last_seven_days")  # noqa: N815, UP045
    lastFourteenDays: Optional[int] = Field(None, alias="last_fourteen_days")  # noqa: N815, UP045
    lastThirtyDays: Optional[int] = Field(None, alias="last_thirty_days")  # noqa: N815, UP045


class ProjectAnalytics(BaseModel):
    """Project analytics data"""

    appViews: Optional[AppViews] = Field(None, alias="app_views")  # noqa: N815, UP045
    lastViewedAt: Optional[datetime] = Field(None, alias="last_viewed_at")  # noqa: N815, UP045
    publishedResultsUpdatedAt: Optional[datetime] = Field(None, alias="published_results_updated_at")  # noqa: N815, UP045


class Project(BaseModel):
    """Hex Project Model"""

    id: str
    title: str
    description: Optional[str] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    creator: Optional[Creator] = None  # noqa: UP045
    owner: Optional[Owner] = None  # noqa: UP045
    status: Optional[ProjectStatus] = None  # noqa: UP045
    categories: List[Category] = Field(default_factory=list)  # noqa: UP006
    reviews: Optional[Reviews] = None  # noqa: UP045
    analytics: Optional[ProjectAnalytics] = None  # noqa: UP045
    lastEditedAt: Optional[datetime] = Field(None, alias="last_edited_at")  # noqa: N815, UP045
    lastPublishedAt: Optional[datetime] = Field(None, alias="last_published_at")  # noqa: N815, UP045
    createdAt: Optional[datetime] = Field(None, alias="created_at")  # noqa: N815, UP045
    archivedAt: Optional[datetime] = Field(None, alias="archived_at")  # noqa: N815, UP045
    trashedAt: Optional[datetime] = Field(None, alias="trashed_at")  # noqa: N815, UP045
    schedules: List = Field(default_factory=list)  # noqa: UP006


class Pagination(BaseModel):
    """Pagination information"""

    after: Optional[str] = None  # noqa: UP045
    before: Optional[str] = None  # noqa: UP045


class PagedResponse(BaseModel):
    pagination: Pagination | None = None


class ProjectListResponse(PagedResponse):
    """List Projects API Response"""

    values: list[Project] = Field(default_factory=list)


class ProjectRunInput(BaseModel):
    """Project run input parameter"""

    name: str
    value: Optional[str] = None  # noqa: UP045


class ProjectRun(BaseModel):
    """Project run information"""

    projectId: str = Field(alias="project_id")  # noqa: N815
    runId: str = Field(alias="run_id")  # noqa: N815
    status: Optional[str] = None  # noqa: UP045
    startedAt: Optional[datetime] = Field(None, alias="started_at")  # noqa: N815, UP045
    completedAt: Optional[datetime] = Field(None, alias="completed_at")  # noqa: N815, UP045
    inputs: List[ProjectRunInput] = Field(default_factory=list)  # noqa: UP006


class ProjectRunsResponse(BaseModel):
    """Get Project Runs API Response"""

    runs: List[ProjectRun] = Field(default_factory=list)  # noqa: UP006
    nextPage: Optional[str] = Field(None, alias="next_page")  # noqa: N815, UP045


class DataConnection(BaseModel):
    """Data connection information"""

    id: str
    name: str
    type: str | None = None
    description: str | None = None
    # Keyed by type, e.g. {"snowflake": {"database": "analytics", ...}}
    connectionDetails: dict | None = None  # noqa: N815

    @property
    def default_database(self) -> str | None:
        return self._details.get("database")

    @property
    def default_schema(self) -> str | None:
        return self._details.get("schema")

    @property
    def _details(self) -> dict:
        details = (self.connectionDetails or {}).get(self.type or "")
        return details if isinstance(details, dict) else {}


class DataConnectionsResponse(PagedResponse):
    """List Data Connections API Response"""

    values: list[DataConnection] = Field(default_factory=list)


class SqlCellContents(BaseModel):
    source: str | None = None


class CellContents(BaseModel):
    sqlCell: SqlCellContents | None = None  # noqa: N815


class Cell(BaseModel):
    """Hex notebook cell"""

    id: str
    staticId: str | None = None  # noqa: N815
    cellType: str | None = None  # noqa: N815
    label: str | None = None
    dataConnectionId: str | None = None  # noqa: N815
    # Name later SQL cells use to query this cell's result; only the export API returns it
    resultVariableName: str | None = None  # noqa: N815
    contents: CellContents | None = None

    @property
    def sql(self) -> str | None:
        return self.contents.sqlCell.source if self.contents and self.contents.sqlCell else None


class ProjectExport(BaseModel):
    """Export Project API Response: the project as YAML"""

    content: str


class CellListResponse(PagedResponse):
    """List Cells API Response"""

    values: list[Cell] = Field(default_factory=list)
