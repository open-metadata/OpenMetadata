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

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AirbyteWorkspace(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaceId: str
    name: Optional[str] = None


class AirbyteStream(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    namespace: Optional[str] = None


class AirbyteSyncCatalogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stream: Optional[AirbyteStream] = None


class AirbyteSyncCatalog(BaseModel):
    model_config = ConfigDict(extra="ignore")

    streams: Optional[List[AirbyteSyncCatalogEntry]] = None


class AirbyteConnectionModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connectionId: str
    name: Optional[str] = None
    sourceId: Optional[str] = None
    destinationId: Optional[str] = None
    syncCatalog: Optional[AirbyteSyncCatalog] = None


class AirbyteJobAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    createdAt: Optional[int] = None
    endedAt: Optional[int] = None


class AirbyteSelfHostedJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    attempts: Optional[List[AirbyteJobAttempt]] = None


class AirbyteCloudJob(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str
    startTime: Optional[str] = None
    lastUpdatedAt: Optional[str] = None


class AirbyteSourceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sourceName: Optional[str] = None
    connectionConfiguration: Optional[dict] = None


class AirbyteDestinationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    destinationName: Optional[str] = None
    connectionConfiguration: Optional[dict] = None


# --- Internal API list wrappers ---


class AirbyteWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    workspaces: List[AirbyteWorkspace] = []


class AirbyteConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connections: List[AirbyteConnectionModel] = []


class AirbyteSelfHostedJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    jobs: List[AirbyteSelfHostedJob] = []


# --- Public API paginated list wrappers ---


class AirbytePublicWorkspaceList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteWorkspace] = []
    next: Optional[str] = None


class AirbytePublicConnectionList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteConnectionModel] = []
    next: Optional[str] = None


class AirbytePublicCloudJobList(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: List[AirbyteCloudJob] = []
    next: Optional[str] = None
