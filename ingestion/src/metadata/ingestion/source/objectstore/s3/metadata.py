#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""S3 object store extraction metadata"""
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.objectstore.s3ObjectStoreConnection import (
    S3Storeconnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.objectstore.objectstore_service import (
    ObjectStoreServiceSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class S3Source(ObjectStoreServiceSource):
    """
    blabla
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: S3Storeconnection = config.serviceConnection.__root__.config
        if not isinstance(connection, S3Storeconnection):
            raise InvalidSourceException(
                f"Expected S3Storeconnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_containers_list(self) -> Optional[List[str]]:
        """
        Boto3 will list here all the stuff about the containers
        s3.list
        """
        return ["XYZ", "ABC"]

    def yield_container(
        self, container_details: str
    ) -> Iterable[CreateContainerRequest]:

        yield CreateContainerRequest(
            name=container_details,
            service=self.context.objectstore_service.fullyQualifiedName,
        )
