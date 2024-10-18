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
"""
Local webserver pydantic models
"""
from enum import Enum
from typing import Optional

from metadata.generated.schema.entity.services.apiService import (
    ApiService,
    ApiServiceType,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.entity.services.metadataService import (
    MetadataService,
    MetadataServiceType,
)
from metadata.generated.schema.entity.services.mlmodelService import (
    MlModelService,
    MlModelServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.entity.services.searchService import (
    SearchService,
    SearchServiceType,
)
from metadata.generated.schema.entity.services.storageService import (
    StorageService,
    StorageServiceType,
)
from metadata.generated.schema.type import basic
from pydantic import BaseModel, Field, ConfigDict, computed_field
from pydantic_core import Url
from typing_extensions import Annotated


class ServiceClass(Enum):
    """Kinds of supported services"""

    DATABASE = DatabaseService.__name__
    API = ApiService.__name__
    DASHBOARD = DashboardService.__name__
    PIPELINE = PipelineService.__name__
    MESSAGING = MessagingService.__name__
    METADATA = MetadataService.__name__
    ML_MODEL = MlModelService.__name__
    SEARCH = SearchService.__name__
    STORAGE = StorageService.__name__


SERVICE_TYPE_MAP = {
    DatabaseService.__name__: DatabaseServiceType,
    ApiService.__name__: ApiServiceType,
    DashboardService.__name__: DashboardServiceType,
    PipelineService.__name__: PipelineServiceType,
    MessagingService.__name__: MessagingServiceType,
    MetadataService.__name__: MetadataServiceType,
    MlModelService.__name__: MlModelServiceType,
    SearchService.__name__: SearchServiceType,
    StorageService.__name__: StorageServiceType,
}


class OMetaServerModel(BaseModel):
    """Init request to start the local server instance"""

    model_config = ConfigDict(
        extra="forbid",
    )

    server_url: Annotated[
        Url,
        Field(
            description="OpenMetadata or Collate server instance URL. E.g., http://localhost:8585/api"
        ),
    ]
    token: Annotated[str, Field(description="Token to authenticate the server")]


class ServiceModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    id: Annotated[
        basic.Uuid, Field(description="Unique identifier of this service instance.")
    ]
    name: Annotated[
        basic.EntityName, Field(description="Name that identifies this API service.")
    ]
    description: Annotated[
        Optional[basic.Markdown],
        Field(None, description="Description of a API service instance."),
    ]
    serviceType: Annotated[str, Field(description="Type of service.")]
    connection: Annotated[
        ServiceConnection, Field(description="Connection details for the service.")
    ]

    @computed_field(alias="serviceClass")
    @property
    def service_class(self) -> ServiceClass:
        """Get the service class based on the service type"""
        for clazz, service in ServiceClass.__members__.items():
            if self.serviceType in SERVICE_TYPE_MAP[service].__members__:
                return ServiceClass.__members__[clazz]
