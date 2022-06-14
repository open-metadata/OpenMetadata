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
Helper mixin to handle services
"""
from typing import Type, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

# The naming convention is T for Entity Types and C for Create Types
C = TypeVar("C", bound=BaseModel)
T = TypeVar("T", bound=BaseModel)


class OMetaServiceMixin:
    """
    OpenMetadata API methods related to service.

    To be inherited by OpenMetadata
    """

    def get_create_service_from_source(
        self, entity: Type[T], config: WorkflowSource
    ) -> C:
        """
        Prepare a CreateService request from source config
        :param entity: Service Type
        :param config: WorkflowSource
        :return: CreateService request
        """

        create_entity_class = self.get_create_entity_type(entity=entity)
        return create_entity_class(
            name=config.serviceName,
            serviceType=config.serviceConnection.__root__.config.type.value,
            connection=config.serviceConnection.__root__,
        )

    def create_service_from_source(self, entity: Type[T], config: WorkflowSource) -> T:
        """
        Create a service of type T.

        We need to extract from the WorkflowSource:
        - name: serviceName
        - serviceType: Type Enum
        - connection: (DatabaseConnection, DashboardConnection...)

        :param entity: Service Type
        :param config: WorkflowSource
        :return: Created Service
        """

        create_service = self.get_create_service_from_source(
            entity=entity, config=config
        )
        return self.create_or_update(create_service)

    def get_service_or_create(self, entity: Type[T], config: WorkflowSource) -> T:
        """
        Fetches a service by name, or creates
        it using the WorkflowSource config
        :param entity: Entity Type to get or create
        :param config: WorkflowSource
        :return: Entity Service of T
        """
        return self.get_by_name(
            entity, config.serviceName
        ) or self.create_service_from_source(entity, config)
