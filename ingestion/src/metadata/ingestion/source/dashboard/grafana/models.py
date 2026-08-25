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
from typing import Any, Dict, List, Optional, Union  # noqa: UP035

from pydantic import BaseModel, Field


class GrafanaUser(BaseModel):
    """Grafana user model"""

    id: int
    email: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    login: Optional[str] = None  # noqa: UP045


class GrafanaFolder(BaseModel):
    """Grafana folder model"""

    id: int
    uid: str
    title: str
    url: Optional[str] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    tags: Optional[List[str]] = None  # noqa: UP006, UP045
    created: Optional[datetime] = None  # noqa: UP045
    updated: Optional[datetime] = None  # noqa: UP045
    createdBy: Optional[str] = None  # noqa: N815, UP045
    updatedBy: Optional[str] = None  # noqa: N815, UP045
    version: Optional[int] = None  # noqa: UP045


class GrafanaDatasource(BaseModel):
    """Grafana datasource model"""

    id: Optional[int] = None  # noqa: UP045
    uid: Optional[str] = None  # noqa: UP045
    name: str
    type: str
    url: Optional[str] = None  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045
    isDefault: Optional[bool] = None  # noqa: N815, UP045
    jsonData: Optional[Dict[str, Any]] = None  # noqa: N815, UP006, UP045


class GrafanaTarget(BaseModel):
    """Grafana panel target/query model"""

    refId: Optional[str] = None  # noqa: N815, UP045
    datasource: Optional[Union[str, Dict[str, Any]]] = None  # noqa: UP006, UP007, UP045
    rawSql: Optional[str] = None  # noqa: N815, UP045
    query: Optional[str] = None  # noqa: UP045
    expr: Optional[str] = None  # For Prometheus queries  # noqa: UP045
    format: Optional[Any] = None  # noqa: UP045
    hide: Optional[bool] = False  # noqa: UP045


class GrafanaPanel(BaseModel):
    """Grafana panel model"""

    id: int
    type: str
    title: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    datasource: Optional[Union[str, Dict[str, Any]]] = None  # noqa: UP006, UP007, UP045
    targets: Optional[List[GrafanaTarget]] = Field(default_factory=list)  # noqa: UP006, UP045
    gridPos: Optional[Dict[str, int]] = None  # noqa: N815, UP006, UP045
    options: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    fieldConfig: Optional[Dict[str, Any]] = None  # noqa: N815, UP006, UP045
    transparent: Optional[bool] = None  # noqa: UP045
    pluginVersion: Optional[str] = None  # noqa: N815, UP045


class GrafanaDashboard(BaseModel):
    """Grafana dashboard model"""

    id: Optional[int] = None  # noqa: UP045
    uid: str
    title: str
    tags: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045
    style: Optional[str] = None  # noqa: UP045
    timezone: Optional[str] = None  # noqa: UP045
    panels: Optional[List[GrafanaPanel]] = Field(default_factory=list)  # noqa: UP006, UP045
    editable: Optional[bool] = None  # noqa: UP045
    time: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    timepicker: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    templating: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    annotations: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    refresh: Optional[Union[str, bool]] = None  # noqa: UP007, UP045
    schemaVersion: Optional[int] = None  # noqa: N815, UP045
    version: Optional[int] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    gnetId: Optional[Any] = None  # noqa: N815, UP045
    links: Optional[List[Dict[str, Any]]] = None  # noqa: UP006, UP045


class GrafanaDashboardMeta(BaseModel):
    """Grafana dashboard metadata model"""

    type: str
    canSave: bool  # noqa: N815
    canEdit: bool  # noqa: N815
    canAdmin: bool  # noqa: N815
    canStar: bool  # noqa: N815
    canDelete: bool  # noqa: N815
    slug: str
    url: str
    expires: Optional[datetime] = None  # noqa: UP045
    created: Optional[datetime] = None  # noqa: UP045
    updated: Optional[datetime] = None  # noqa: UP045
    updatedBy: Optional[str] = None  # noqa: N815, UP045
    createdBy: Optional[str] = None  # noqa: N815, UP045
    version: Optional[int] = None  # noqa: UP045
    hasAcl: Optional[bool] = None  # noqa: N815, UP045
    isFolder: Optional[bool] = None  # noqa: N815, UP045
    folderId: Optional[int] = None  # noqa: N815, UP045
    folderUid: Optional[str] = None  # noqa: N815, UP045
    folderTitle: Optional[str] = None  # noqa: N815, UP045
    folderUrl: Optional[str] = None  # noqa: N815, UP045
    provisioned: Optional[bool] = None  # noqa: UP045
    provisionedExternalId: Optional[str] = None  # noqa: N815, UP045
    annotationsPermissions: Optional[Dict[str, Any]] = None  # noqa: N815, UP006, UP045


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
    tags: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045
    isStarred: bool  # noqa: N815
    folderId: Optional[int] = None  # noqa: N815, UP045
    folderUid: Optional[str] = None  # noqa: N815, UP045
    folderTitle: Optional[str] = None  # noqa: N815, UP045
    folderUrl: Optional[str] = None  # noqa: N815, UP045
