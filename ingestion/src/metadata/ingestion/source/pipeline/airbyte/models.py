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
Airbyte Source Model module
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict


class AirbyteWorkspace(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaceId: str  # noqa: N815
    name: Optional[str] = None  # noqa: UP045


class AirbyteStream(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    namespace: Optional[str] = None  # noqa: UP045


class AirbyteSyncCatalogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stream: Optional[AirbyteStream] = None  # noqa: UP045


class AirbyteSyncCatalog(BaseModel):
    model_config = ConfigDict(extra="ignore")

    streams: Optional[List[AirbyteSyncCatalogEntry]] = None  # noqa: UP006, UP045


class AirbyteConnectionModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connectionId: str  # noqa: N815
    name: Optional[str] = None  # noqa: UP045
    sourceId: Optional[str] = None  # noqa: N815, UP045
    destinationId: Optional[str] = None  # noqa: N815, UP045
    syncCatalog: Optional[AirbyteSyncCatalog] = None  # noqa: N815, UP045


class AirbyteJobAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    createdAt: Optional[int] = None  # noqa: N815, UP045
    endedAt: Optional[int] = None  # noqa: N815, UP045


class AirbyteSelfHostedJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    attempts: Optional[List[AirbyteJobAttempt]] = None  # noqa: UP006, UP045


class AirbyteCloudJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    startTime: Optional[str] = None  # noqa: N815, UP045
    lastUpdatedAt: Optional[str] = None  # noqa: N815, UP045


class AirbyteSourceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Internal API (`/sources/get`) returns `sourceName` + `connectionConfiguration`;
    # the public API (`/api/public/v1/sources/{id}`) returns `sourceType` + `configuration`.
    sourceName: Optional[str] = None  # noqa: N815, UP045
    sourceType: Optional[str] = None  # noqa: N815, UP045
    connectionConfiguration: Optional[dict] = None  # noqa: N815, UP045
    configuration: Optional[dict] = None  # noqa: UP045

    @property
    def resolved_type(self) -> Optional[str]:  # noqa: UP045
        """Connector type from whichever API responded (display name or slug)."""
        return self.sourceName or self.sourceType

    @property
    def resolved_configuration(self) -> dict:
        """Connection config from whichever API responded."""
        return self.connectionConfiguration or self.configuration or {}


class AirbyteDestinationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    destinationName: Optional[str] = None  # noqa: N815, UP045
    destinationType: Optional[str] = None  # noqa: N815, UP045
    connectionConfiguration: Optional[dict] = None  # noqa: N815, UP045
    configuration: Optional[dict] = None  # noqa: UP045

    @property
    def resolved_type(self) -> Optional[str]:  # noqa: UP045
        return self.destinationName or self.destinationType

    @property
    def resolved_configuration(self) -> dict:
        return self.connectionConfiguration or self.configuration or {}


# --- Internal API list wrappers ---


class AirbyteWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaces: List[AirbyteWorkspace] = []  # noqa: UP006


class AirbyteConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connections: List[AirbyteConnectionModel] = []  # noqa: UP006


class AirbyteSelfHostedJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    jobs: List[AirbyteSelfHostedJob] = []  # noqa: UP006


# --- Public API paginated list wrappers ---


class AirbytePublicWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteWorkspace] = []  # noqa: UP006
    next: Optional[str] = None  # noqa: UP045


class AirbytePublicConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteConnectionModel] = []  # noqa: UP006
    next: Optional[str] = None  # noqa: UP045


class AirbytePublicCloudJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteCloudJob] = []  # noqa: UP006
    next: Optional[str] = None  # noqa: UP045
