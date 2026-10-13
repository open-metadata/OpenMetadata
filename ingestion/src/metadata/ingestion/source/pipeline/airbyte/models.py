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

from pydantic import BaseModel, ConfigDict, field_validator

from .constants import (  # noqa: TID252
    NAMESPACE_CUSTOM_FORMATS,
    NAMESPACE_DESTINATION,
    NAMESPACE_SOURCE,
    SOURCE_NAMESPACE_TOKEN,
)


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


def _stream_name(item: object) -> str | None:
    """The ``name`` of a raw response entry or of an already-built stream, if it has one."""
    if isinstance(item, AirbyteStream):
        return item.name
    return item.get("name") if isinstance(item, dict) else None


class AirbyteConnectionConfigurations(BaseModel):
    model_config = ConfigDict(extra="ignore")

    streams: list[AirbyteStream] | None = None

    @field_validator("streams", mode="before")
    @classmethod
    def _drop_streams_without_name(cls, value: object) -> object:
        """Drop malformed entries before validation instead of failing the whole connection.

        The public API is not guaranteed to omit a stray nameless entry; one bad stream
        must not block lineage for every other stream on the connection. An entry that is
        already an ``AirbyteStream`` is kept, so building this model in code behaves the same
        as parsing it from a response -- a plain ``isinstance(item, dict)`` test dropped every
        such entry and left ``streams`` empty with no error, the same silent-loss failure this
        validator exists to contain.
        """
        if not isinstance(value, list):
            return value
        return [item for item in value if _stream_name(item)]


class AirbyteConnectionModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    connectionId: str  # noqa: N815
    name: str | None = None
    sourceId: str | None = None  # noqa: N815
    destinationId: str | None = None  # noqa: N815
    # The internal API (`/connections/list`) nests streams under `syncCatalog.streams[].stream`,
    # while the public API (`api/public/v1`) returns them flat under `configurations.streams`.
    syncCatalog: AirbyteSyncCatalog | None = None  # noqa: N815
    configurations: AirbyteConnectionConfigurations | None = None
    # Airbyte resolves the destination namespace from the connection, not from the namespace the
    # source reported, so every destination name depends on these two fields.
    namespaceDefinition: str | None = None  # noqa: N815
    namespaceFormat: str | None = None  # noqa: N815
    prefix: str | None = None

    @property
    def resolved_streams(self) -> list[AirbyteStream]:
        """Streams from whichever API responded (cf. resolved_type/resolved_configuration)."""
        if self.syncCatalog and self.syncCatalog.streams:
            return [entry.stream for entry in self.syncCatalog.streams if entry.stream]
        if self.configurations and self.configurations.streams:
            return self.configurations.streams
        return []

    def destination_namespace(self, stream: AirbyteStream) -> str | None:
        """
        The namespace the destination writes under, which is not always the one the source
        reported. ``destination`` is the API default, so an absent value means no namespace.
        """
        definition = self.namespaceDefinition or NAMESPACE_DESTINATION
        if definition == NAMESPACE_SOURCE:
            return stream.namespace
        if definition in NAMESPACE_CUSTOM_FORMATS:
            # Per the public API schema: a blank format behaves like ``destination``, and
            # ``${SOURCE_NAMESPACE}`` like ``source``.
            if not self.namespaceFormat:
                return None
            return self.namespaceFormat.replace(SOURCE_NAMESPACE_TOKEN, stream.namespace or "") or None
        return None

    def destination_stream(self, stream: AirbyteStream) -> AirbyteStream:
        """
        The stream as the destination writes it: prefixed name, connection-resolved namespace.

        ``prefix`` is prepended to the stream name before the destination ever sees it, so every
        destination name -- table, container path, topic, index -- is built from this stream
        rather than from the one the source reported.
        """
        return stream.model_copy(
            update={
                "name": f"{self.prefix or ''}{stream.name}",
                "namespace": self.destination_namespace(stream),
            }
        )


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
