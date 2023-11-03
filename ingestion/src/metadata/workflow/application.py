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
Generic Workflow entrypoint to execute Applications
"""
from abc import ABC, abstractmethod
from typing import TypeVar, Generic

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.metadataIngestion.application import OpenMetadataApplicationConfig
from metadata.generated.schema.metadataIngestion.workflow import LogLevels

from build.lib.metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.workflow.base import BaseWorkflow

# Configuration class
C = TypeVar("C")


class ApplicationWorkflow(BaseWorkflow, ABC, Generic[C]):
    """
    Base Application Workflow implementation
    """
    config: OpenMetadataApplicationConfig

    def __init__(self, config_dict: dict):

        self.config = OpenMetadataApplicationConfig.parse_obj(config_dict)

        # Applications are associated to the OpenMetadata Service
        self.service_type: ServiceType = ServiceType.Metadata

        metadata_config: OpenMetadataConnection = self.config.workflowConfig.openMetadataServerConfig
        log_level: LogLevels = self.config.workflowConfig.loggerLevel

        super().__init__(
            config=self.config,
            log_level=log_level,
            metadata_config=metadata_config,
            service_type=self.service_type,
        )

    @classmethod
    def create(cls, config_dict: dict):
        return cls(config_dict)

    @abstractmethod
    def post_init(self) -> None:
        """Method to execute after we have initialized all the internals"""

    @abstractmethod
    def execute_internal(self) -> None:
        """Workflow-specific logic to execute safely"""
