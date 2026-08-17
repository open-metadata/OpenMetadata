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
"""Custom Storage connector yielding a deterministic in-memory container tree."""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
    FileFormat,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.storage.customStorageConnection import (
    CustomStorageConnection,
)
from metadata.generated.schema.entity.services.storageService import StorageServiceType
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata

ROOT_CONTAINER = "my_bucket"
CHILD_CONTAINER = "my_prefix"


class CustomStorageSource(Source):
    """Yields a root container and a child container carrying a described data model."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomStorageSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomStorageConnection):
            raise InvalidSourceException(f"Expected CustomStorageConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateStorageServiceRequest(
                name=service_name,
                serviceType=StorageServiceType.CustomStorage,
                connection=self.config.serviceConnection.root,
                displayName="Custom Storage Demo",
                description="Object store served by the custom storage connector",
            )
        )
        yield Either(
            right=CreateContainerRequest(
                name=ROOT_CONTAINER,
                service=service_name,
                displayName="My Bucket",
                description="Bucket produced by the custom storage connector",
                prefix="/",
                fullPath=f"s3://{ROOT_CONTAINER}",
            )
        )
        # parent is an EntityReference by id, so the root container must already be
        # persisted; the sink writes CreateContainerRequest eagerly, not buffered.
        parent = self.metadata.get_by_name(entity=Container, fqn=f"{service_name}.{ROOT_CONTAINER}")
        yield Either(
            right=CreateContainerRequest(
                name=CHILD_CONTAINER,
                service=service_name,
                displayName="My Prefix",
                description="Partitioned event data under the bucket",
                parent=EntityReference(id=parent.id, type="container") if parent else None,
                prefix=f"/{CHILD_CONTAINER}",
                fullPath=f"s3://{ROOT_CONTAINER}/{CHILD_CONTAINER}",
                numberOfObjects=42,
                size=1024,
                fileFormats=[FileFormat.parquet],
                dataModel=ContainerDataModel(
                    isPartitioned=False,
                    columns=[
                        Column(
                            name="event_id",
                            dataType=DataType.STRING,
                            dataLength=64,
                            description="Unique event identifier",
                        ),
                        Column(
                            name="event_ts",
                            dataType=DataType.TIMESTAMP,
                            description="Event time in UTC",
                        ),
                    ],
                ),
            )
        )
