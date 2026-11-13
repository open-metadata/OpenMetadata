#  Copyright 2023 Collate
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
PowerBI Models
"""

from datetime import datetime

from pydantic import BaseModel, Field


class AuthToken(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str
    expires_in: int | None = 0


class Workbook(BaseModel):
    workbookId: str  # noqa: N815
    name: str | None = None
    ownerId: str | None = None  # noqa: N815


class WorkbookDetails(BaseModel):
    workbookId: str  # noqa: N815
    name: str | None = None
    createdAt: datetime  # noqa: N815
    updatedAt: datetime | None = None  # noqa: N815
    url: str
    path: str | None = None
    latestVersion: int | float | None = None  # noqa: N815
    ownerId: str | None = None  # noqa: N815
    isArchived: bool | None = None  # noqa: N815
    description: str | None = None
    # Not in the workbook response: Sigma returns the badge on the workbook's /files entry.
    badge: str | None = None
    # Not in Sigma's response: filled once by SigmaSource.get_dashboard_details for the chart and data model stages.
    elements: list["Elements"] = []
    # Read from the workbook's lineage on first use, then reused by every lineage step of the workbook.
    lineage: list["WorkbookLineageEntry"] | None = None


class WorkBookResponseDetails(BaseModel):
    entries: list[Workbook] | None = []
    total: int | None = None
    nextPage: str | None = None  # noqa: N815


class OwnerDetails(BaseModel):
    organizationId: str  # noqa: N815
    email: str


class WorkBookPage(BaseModel):
    pageId: str  # noqa: N815


class WorkBookPageResponse(BaseModel):
    entries: list[WorkBookPage] | None = []
    total: int | None = None
    nextPage: str | None = None  # noqa: N815


class Elements(BaseModel):
    elementId: str  # noqa: N815
    name: str | None = None
    type: str | None = Field(default=None)
    vizualizationType: str | None = None  # noqa: N815
    columns: list[str] | None = []

    @property
    def is_data_element(self) -> bool:
        """Whether the element supports data models and lineage."""
        if self.type is not None:
            return self.type in ("table", "pivot-table", "visualization")
        return bool(self.vizualizationType)


class ElementsResponse(BaseModel):
    entries: list[Elements] | None = []
    total: int | None = None
    nextPage: str | None = None  # noqa: N815


class EdgeSource(BaseModel):
    source: str
    target: str | None = None

    @property
    def node_id(self):
        """Extract node ID from source: handles inode-, slash-separated, or direct IDs"""
        if self.source:
            if "inode-" in self.source:
                return self.source.replace("inode-", "")
            elif "/" in self.source:  # noqa: RET505
                return self.source.split("/")[0]
            else:
                return self.source
        return None


class Dependency(BaseModel):
    nodeId: str  # noqa: N815
    type: str
    name: str | None = None
    elementId: str | None = None  # noqa: N815


class EdgeSourceResponse(BaseModel):
    edges: list[EdgeSource] | None = []
    dependencies: dict[str, Dependency] = {}


class NodeDetails(BaseModel):
    id: str
    name: str | None
    node_type: str = Field(alias="type")
    path: str | None = ""
    badge: str | None = None

    @property
    def node_schema(self):
        """Extract database.schema from path (searches for dotted format like DB.SCHEMA)"""
        if self.node_type in ["table", "dataset"] and self.path:  # noqa: SIM102
            if "/" in self.path:
                parts = self.path.split("/")
                for part in reversed(parts):
                    if "." in part and not part.startswith("."):
                        return part
                return parts[-1]
        return None


class DataModel(BaseModel):
    dataModelId: str  # noqa: N815
    name: str | None = None
    url: str | None = None
    ownerId: str | None = None  # noqa: N815


class DataModelsResponse(BaseModel):
    entries: list[DataModel] = []
    nextPage: str | None = None  # noqa: N815


class Connection(BaseModel):
    type: str


class WorkbookLineageEntry(BaseModel):
    connectionId: str | None = None  # noqa: N815
    elementId: str | None = None  # noqa: N815
    dataSourceIds: list[str] | None = None  # noqa: N815
    dataModelId: str | None = None  # noqa: N815


class WorkbookLineageResponse(BaseModel):
    entries: list[WorkbookLineageEntry] = []
    nextPage: str | None = None  # noqa: N815


class WorkbookQuery(BaseModel):
    elementId: str  # noqa: N815
    name: str | None = None
    sql: str | None = None
    error: str | None = None


class WorkbookQueriesResponse(BaseModel):
    entries: list[WorkbookQuery] | None = []
    total: int | None = None
    nextPage: str | None = None  # noqa: N815
