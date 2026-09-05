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
from typing import Any

from pydantic import BaseModel, Field


class GrafanaUser(BaseModel):
    """Grafana user model"""

    id: int
    email: str | None = None
    name: str | None = None
    login: str | None = None


class GrafanaFolder(BaseModel):
    """Grafana folder model"""

    id: int
    uid: str
    title: str
    url: str | None = None
    type: str | None = None
    tags: list[str] | None = None
    created: datetime | None = None
    updated: datetime | None = None
    createdBy: str | None = None  # noqa: N815
    updatedBy: str | None = None  # noqa: N815
    version: int | None = None


class GrafanaDatasource(BaseModel):
    """Grafana datasource model"""

    id: int | None = None
    uid: str | None = None
    name: str
    type: str
    url: str | None = None
    database: str | None = None
    isDefault: bool | None = None  # noqa: N815
    jsonData: dict[str, Any] | None = None  # noqa: N815


class GrafanaTarget(BaseModel):
    """Grafana panel target/query model"""

    refId: str | None = None  # noqa: N815
    datasource: str | dict[str, Any] | None = None
    rawSql: str | None = None  # noqa: N815
    query: str | None = None
    expr: str | None = None  # For Prometheus queries
    format: Any | None = None
    hide: bool | None = False


class GrafanaPanel(BaseModel):
    """Grafana panel model"""

    id: int
    type: str
    title: str | None = None
    description: str | None = None
    datasource: str | dict[str, Any] | None = None
    targets: list[GrafanaTarget] | None = Field(default_factory=list)
    gridPos: dict[str, int] | None = None  # noqa: N815
    options: dict[str, Any] | None = None
    fieldConfig: dict[str, Any] | None = None  # noqa: N815
    transparent: bool | None = None
    pluginVersion: str | None = None  # noqa: N815
    collapsed: bool | None = None
    panels: list["GrafanaPanel"] | None = Field(default_factory=list)


GrafanaPanel.model_rebuild()


class GrafanaDashboard(BaseModel):
    """Grafana dashboard model"""

    id: int | None = None
    uid: str
    title: str
    tags: list[str] | None = Field(default_factory=list)
    style: str | None = None
    timezone: str | None = None
    panels: list[GrafanaPanel] | None = Field(default_factory=list)
    editable: bool | None = None
    time: dict[str, Any] | None = None
    timepicker: dict[str, Any] | None = None
    templating: dict[str, Any] | None = None
    annotations: dict[str, Any] | None = None
    refresh: str | bool | None = None
    schemaVersion: int | None = None  # noqa: N815
    version: int | None = None
    description: str | None = None
    gnetId: Any | None = None  # noqa: N815
    links: list[dict[str, Any]] | None = None


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
    expires: datetime | None = None
    created: datetime | None = None
    updated: datetime | None = None
    updatedBy: str | None = None  # noqa: N815
    createdBy: str | None = None  # noqa: N815
    version: int | None = None
    hasAcl: bool | None = None  # noqa: N815
    isFolder: bool | None = None  # noqa: N815
    folderId: int | None = None  # noqa: N815
    folderUid: str | None = None  # noqa: N815
    folderTitle: str | None = None  # noqa: N815
    folderUrl: str | None = None  # noqa: N815
    provisioned: bool | None = None
    provisionedExternalId: str | None = None  # noqa: N815
    annotationsPermissions: dict[str, Any] | None = None  # noqa: N815


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
    tags: list[str] | None = Field(default_factory=list)
    isStarred: bool  # noqa: N815
    folderId: int | None = None  # noqa: N815
    folderUid: str | None = None  # noqa: N815
    folderTitle: str | None = None  # noqa: N815
    folderUrl: str | None = None  # noqa: N815
