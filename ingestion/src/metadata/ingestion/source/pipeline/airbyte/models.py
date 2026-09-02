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

from pydantic import BaseModel, ConfigDict


class AirbyteWorkspace(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaceId: str  # noqa: N815
    name: str | None = None


class AirbyteStream(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    namespace: str | None = None


class AirbyteSyncCatalogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stream: AirbyteStream | None = None


class AirbyteSyncCatalog(BaseModel):
    model_config = ConfigDict(extra="ignore")

    streams: list[AirbyteSyncCatalogEntry] | None = None


class AirbyteConnectionModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connectionId: str  # noqa: N815
    name: str | None = None
    sourceId: str | None = None  # noqa: N815
    destinationId: str | None = None  # noqa: N815
    syncCatalog: AirbyteSyncCatalog | None = None  # noqa: N815


class AirbyteJobAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    createdAt: int | None = None  # noqa: N815
    endedAt: int | None = None  # noqa: N815


class AirbyteSelfHostedJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    attempts: list[AirbyteJobAttempt] | None = None


class AirbyteCloudJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    startTime: str | None = None  # noqa: N815
    lastUpdatedAt: str | None = None  # noqa: N815


class AirbyteSourceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Internal API (`/sources/get`) returns `sourceName` + `connectionConfiguration`;
    # the public API (`/api/public/v1/sources/{id}`) returns `sourceType` + `configuration`.
    sourceName: str | None = None  # noqa: N815
    sourceType: str | None = None  # noqa: N815
    connectionConfiguration: dict | None = None  # noqa: N815
    configuration: dict | None = None

    @property
    def resolved_type(self) -> str | None:
        """Connector type from whichever API responded (display name or slug)."""
        return self.sourceName or self.sourceType

    @property
    def resolved_configuration(self) -> dict:
        """Connection config from whichever API responded."""
        return self.connectionConfiguration or self.configuration or {}


class AirbyteDestinationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    destinationName: str | None = None  # noqa: N815
    destinationType: str | None = None  # noqa: N815
    connectionConfiguration: dict | None = None  # noqa: N815
    configuration: dict | None = None

    @property
    def resolved_type(self) -> str | None:
        return self.destinationName or self.destinationType

    @property
    def resolved_configuration(self) -> dict:
        return self.connectionConfiguration or self.configuration or {}


# --- Internal API list wrappers ---


class AirbyteWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaces: list[AirbyteWorkspace] = []


class AirbyteConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connections: list[AirbyteConnectionModel] = []


class AirbyteSelfHostedJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    jobs: list[AirbyteSelfHostedJob] = []


# --- Public API paginated list wrappers ---


class AirbytePublicWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: list[AirbyteWorkspace] = []
    next: str | None = None


class AirbytePublicConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: list[AirbyteConnectionModel] = []
    next: str | None = None


class AirbytePublicCloudJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: list[AirbyteCloudJob] = []
    next: str | None = None
