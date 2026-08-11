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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class AuthToken(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None  # noqa: UP045
    token_type: str
    expires_in: Optional[int] = 0  # noqa: UP045


class Workbook(BaseModel):
    workbookId: str  # noqa: N815
    name: Optional[str] = None  # noqa: UP045
    ownerId: Optional[str] = None  # noqa: N815, UP045


class WorkbookDetails(BaseModel):
    workbookId: str  # noqa: N815
    name: Optional[str] = None  # noqa: UP045
    createdAt: str  # noqa: N815
    url: str
    path: Optional[str] = None  # noqa: UP045
    ownerId: Optional[str] = None  # noqa: N815, UP045
    isArchived: bool  # noqa: N815
    description: Optional[str] = None  # noqa: UP045


class WorkBookResponseDetails(BaseModel):
    entries: Optional[List[Workbook]] = []  # noqa: UP006, UP045
    total: int
    nextPage: Optional[str] = None  # noqa: N815, UP045


class OwnerDetails(BaseModel):
    organizationId: str  # noqa: N815
    email: str


class WorkBookPage(BaseModel):
    pageId: str  # noqa: N815


class WorkBookPageResponse(BaseModel):
    entries: Optional[List[WorkBookPage]] = []  # noqa: UP006, UP045
    total: int
    nextPage: Optional[str] = None  # noqa: N815, UP045


class Elements(BaseModel):
    elementId: str  # noqa: N815
    name: Optional[str] = None  # noqa: UP045
    vizualizationType: Optional[str] = None  # noqa: N815, UP045
    columns: Optional[List[str]] = []  # noqa: UP006, UP045


class ElementsResponse(BaseModel):
    entries: Optional[List[Elements]] = []  # noqa: UP006, UP045
    total: int
    nextPage: Optional[str] = None  # noqa: N815, UP045


class EdgeSource(BaseModel):
    source: str

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
    name: Optional[str]  # noqa: UP045
    elementId: Optional[str]  # noqa: N815, UP045


class EdgeSourceResponse(BaseModel):
    edges: Optional[List[EdgeSource]] = []  # noqa: UP006, UP045
    dependencies: Optional[dict] = {}  # noqa: UP045


class NodeDetails(BaseModel):
    id: str
    name: Optional[str]  # noqa: UP045
    node_type: str = Field(alias="type")
    path: Optional[str] = ""  # noqa: UP045

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


class WorkbookQuery(BaseModel):
    elementId: str  # noqa: N815
    name: Optional[str]  # noqa: UP045
    sql: Optional[str] = None  # noqa: UP045
    error: Optional[str] = None  # noqa: UP045


class WorkbookQueriesResponse(BaseModel):
    entries: Optional[List[WorkbookQuery]] = []  # noqa: UP006, UP045
    total: int
    nextPage: Optional[str] = None  # noqa: N815, UP045
