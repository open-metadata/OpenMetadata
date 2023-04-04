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
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Tile(BaseModel):
    id: str
    title: Optional[str]
    subTitle: Optional[str]
    embedUrl: Optional[str]
    datasetId: Optional[str]
    reportId: Optional[str]


class PowerBIDashboard(BaseModel):
    id: str
    displayName: str
    webUrl: Optional[str]
    embedUrl: Optional[str]
    tiles: Optional[List[Tile]] = []


class DashboardsResponse(BaseModel):
    odata_context: str = Field(alias="@odata.context")
    value: List[PowerBIDashboard]


class TilesResponse(BaseModel):
    odata_context: str = Field(alias="@odata.context")
    value: List[Tile]


class PowerBiTable(BaseModel):
    name: str


class TablesResponse(BaseModel):
    odata_context: str = Field(alias="@odata.context")
    value: List[PowerBiTable]


class Dataset(BaseModel):
    id: str
    name: str
    tables: Optional[List[PowerBiTable]] = []


class DatasetResponse(BaseModel):
    odata_context: str = Field(alias="@odata.context")
    value: List[Dataset]


class Group(BaseModel):
    id: str
    name: Optional[str]
    type: Optional[str]
    state: Optional[str]
    dashboards: Optional[List[PowerBIDashboard]] = []
    datasets: Optional[List[Dataset]] = []


class GroupsResponse(BaseModel):
    odata_context: str = Field(alias="@odata.context")
    odata_count: int = Field(alias="@odata.count")
    value: List[Group]


class WorkSpaceScanResponse(BaseModel):
    id: str
    createdDateTime: datetime
    status: Optional[str]


class Workspaces(BaseModel):
    workspaces: List[Group]


class PowerBiToken(BaseModel):
    expires_in: Optional[int]
    access_token: Optional[str]
