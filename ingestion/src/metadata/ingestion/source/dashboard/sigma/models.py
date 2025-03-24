#  Copyright 2023 Collate
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
PowerBI Models
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class AuthToken(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str
    expires_in: Optional[int] = 0


class Workbook(BaseModel):
    workbookId: str
    name: Optional[str] = None
    ownerId: Optional[str] = None


class WorkbookDetails(BaseModel):
    workbookId: str
    name: Optional[str] = None
    createdAt: str
    url: str
    path: Optional[str] = None
    ownerId: Optional[str] = None
    isArchived: bool
    description: Optional[str] = None


class WorkBookResponseDetails(BaseModel):
    entries: Optional[List[Workbook]] = []
    total: int
    nextPage: Optional[str] = None


class OwnerDetails(BaseModel):
    organizationId: str
    email: str


class WorkBookPage(BaseModel):
    pageId: str


class WorkBookPageResponse(BaseModel):
    entries: Optional[List[WorkBookPage]] = []
    total: int
    nextPage: Optional[str] = None


class Elements(BaseModel):
    elementId: str
    name: Optional[str] = None
    vizualizationType: Optional[str] = None
    columns: Optional[List[str]] = []


class ElementsResponse(BaseModel):
    entries: Optional[List[Elements]] = []
    total: int
    nextPage: Optional[str] = None


class EdgeSource(BaseModel):
    source: str

    @property
    def node_id(self):
        if self.source:
            if "inode-" in self.source:
                return self.source.replace("inode-", "")
        return None


class EdgeSourceResponse(BaseModel):
    edges: Optional[List[EdgeSource]] = []


class NodeDetails(BaseModel):
    id: str
    name: Optional[str]
    node_type: str = Field(alias="type")
    path: Optional[str] = ""

    @property
    def node_schema(self):
        if self.node_type == "table" and self.path:
            if "/" in self.path:
                return self.path.split("/", maxsplit=-1)[-1]
        return None
