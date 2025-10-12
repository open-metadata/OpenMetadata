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
Grafana API response models
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class GrafanaUser(BaseModel):
    """Grafana user model"""

    id: int
    email: Optional[str] = None
    name: Optional[str] = None
    login: Optional[str] = None


class GrafanaFolder(BaseModel):
    """Grafana folder model"""

    id: int
    uid: str
    title: str
    url: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[List[str]] = None
    created: Optional[datetime] = None
    updated: Optional[datetime] = None
    createdBy: Optional[str] = None
    updatedBy: Optional[str] = None
    version: Optional[int] = None


class GrafanaDatasource(BaseModel):
    """Grafana datasource model"""

    id: Optional[int] = None
    uid: Optional[str] = None
    name: str
    type: str
    url: Optional[str] = None
    database: Optional[str] = None
    isDefault: Optional[bool] = None
    jsonData: Optional[Dict[str, Any]] = None


class GrafanaTarget(BaseModel):
    """Grafana panel target/query model"""

    refId: Optional[str] = None
    datasource: Optional[Union[str, Dict[str, Any]]] = None
    rawSql: Optional[str] = None
    query: Optional[str] = None
    expr: Optional[str] = None  # For Prometheus queries
    format: Optional[str] = None
    hide: Optional[bool] = False


class GrafanaPanel(BaseModel):
    """Grafana panel model"""

    id: int
    type: str
    title: Optional[str] = None
    description: Optional[str] = None
    datasource: Optional[Union[str, Dict[str, Any]]] = None
    targets: Optional[List[GrafanaTarget]] = Field(default_factory=list)
    gridPos: Optional[Dict[str, int]] = None
    options: Optional[Dict[str, Any]] = None
    fieldConfig: Optional[Dict[str, Any]] = None
    transparent: Optional[bool] = None
    pluginVersion: Optional[str] = None


class GrafanaDashboard(BaseModel):
    """Grafana dashboard model"""

    id: Optional[int] = None
    uid: str
    title: str
    tags: Optional[List[str]] = Field(default_factory=list)
    style: Optional[str] = None
    timezone: Optional[str] = None
    panels: Optional[List[GrafanaPanel]] = Field(default_factory=list)
    editable: Optional[bool] = None
    time: Optional[Dict[str, Any]] = None
    timepicker: Optional[Dict[str, Any]] = None
    templating: Optional[Dict[str, Any]] = None
    annotations: Optional[Dict[str, Any]] = None
    refresh: Optional[Union[str, bool]] = None
    schemaVersion: Optional[int] = None
    version: Optional[int] = None
    description: Optional[str] = None
    gnetId: Optional[Any] = None
    links: Optional[List[Dict[str, Any]]] = None


class GrafanaDashboardMeta(BaseModel):
    """Grafana dashboard metadata model"""

    type: str
    canSave: bool
    canEdit: bool
    canAdmin: bool
    canStar: bool
    canDelete: bool
    slug: str
    url: str
    expires: Optional[datetime] = None
    created: Optional[datetime] = None
    updated: Optional[datetime] = None
    updatedBy: Optional[str] = None
    createdBy: Optional[str] = None
    version: Optional[int] = None
    hasAcl: Optional[bool] = None
    isFolder: Optional[bool] = None
    folderId: Optional[int] = None
    folderUid: Optional[str] = None
    folderTitle: Optional[str] = None
    folderUrl: Optional[str] = None
    provisioned: Optional[bool] = None
    provisionedExternalId: Optional[str] = None
    annotationsPermissions: Optional[Dict[str, Any]] = None


class GrafanaDashboardResponse(BaseModel):
    """Full Grafana dashboard API response"""

    dashboard: GrafanaDashboard
    meta: GrafanaDashboardMeta


class GrafanaSearchResult(BaseModel):
    """Grafana search API result model"""

    id: int
    uid: str
    title: str
    uri: str
    url: str
    slug: str
    type: str  # "dash-db" for dashboards, "dash-folder" for folders
    tags: Optional[List[str]] = Field(default_factory=list)
    isStarred: bool
    folderId: Optional[int] = None
    folderUid: Optional[str] = None
    folderTitle: Optional[str] = None
    folderUrl: Optional[str] = None
