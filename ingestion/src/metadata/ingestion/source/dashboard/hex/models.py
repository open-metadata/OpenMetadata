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


class PagedResponse(BaseModel):
    pagination: Pagination | None = None


class ProjectListResponse(PagedResponse):
    """List Projects API Response"""

    values: list[Project] = Field(default_factory=list)


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
