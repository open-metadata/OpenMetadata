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
"""Entity Utilities"""
from enum import Enum
from typing import Type

from metadata.generated.schema.entity.services.apiService import (
    ApiService,
    ApiServiceType,
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


class ServiceClass(Enum):
    """Kinds of supported services"""

    DATABASE = DatabaseService
    API = ApiService
    DASHBOARD = DashboardService
    PIPELINE = PipelineService
    MESSAGING = MessagingService
    METADATA = MetadataService
    ML_MODEL = MlModelService
    SEARCH = SearchService
    STORAGE = StorageService


SERVICE_TYPE_MAP = {
    DatabaseService: DatabaseServiceType,
    ApiService: ApiServiceType,
    DashboardService: DashboardServiceType,
    PipelineService: PipelineServiceType,
    MessagingService: MessagingServiceType,
    MetadataService: MetadataServiceType,
    MlModelService: MlModelServiceType,
    SearchService: SearchServiceType,
    StorageService: StorageServiceType,
}


def service_class(service_type) -> Type:
    """Get the service class based on the service type

    Args:
        service_type (str): Service type
    Returns:
        str
    """
    for service in ServiceClass:
        if service_type.casefold() in {
            key.casefold() for key in SERVICE_TYPE_MAP[service.value].__members__
        }:
            return service.value
    raise ValueError(f"Unsupported service type: {service_type}")
