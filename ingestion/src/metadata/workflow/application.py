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
Generic Workflow entrypoint to execute Applications
"""
from abc import ABC, abstractmethod
from typing import List, Optional

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.ingestion.api.step import Step
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger
from metadata.workflow.base import BaseWorkflow

logger = ingestion_logger()


class InvalidAppConfiguration(Exception):
    """
    To be raised if the config received by the App
    is not the one expected
    """


class AppRunner(Step, ABC):
    """Class that knows how to execute the Application logic."""

    def __init__(
        self,
        config: OpenMetadataApplicationConfig,
        metadata: OpenMetadata,
    ):
        self.app_config = config.appConfig.root if config.appConfig else None
        self.private_config = (
            config.appPrivateConfig.root if config.appPrivateConfig else None
        )
        self.metadata = metadata

        super().__init__()

    @property
    def name(self) -> str:
        return "AppRunner"

    @abstractmethod
    def run(self) -> None:
        """App logic to execute"""

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        config = OpenMetadataApplicationConfig.model_validate(config_dict)
        return cls(config=config, metadata=metadata)


class ApplicationWorkflow(BaseWorkflow, ABC):
    """Base Application Workflow implementation"""

    config: OpenMetadataApplicationConfig
    runner: Optional[AppRunner]

    def __init__(self, config: OpenMetadataApplicationConfig):
        self.runner = None  # Will be passed in post-init
        self.config = config

        # Applications are associated to the OpenMetadata Service
        self.service_type: ServiceType = ServiceType.Metadata

        super().__init__(
            config=self.config,
            workflow_config=config.workflowConfig,
            service_type=self.service_type,
        )

    @classmethod
    def create(cls, config_dict: dict):
        # TODO: Create a parse_gracefully method
        config = OpenMetadataApplicationConfig.model_validate(config_dict)
        return cls(config)

    def post_init(self) -> None:
        """
        Method to execute after we have initialized all the internals.
        Here we will load the runner since it needs the `metadata` object
        """
        runner_class = import_from_module(self.config.sourcePythonClass)
        if not issubclass(runner_class, AppRunner):
            raise ValueError(
                "We need a valid AppRunner to initialize the ApplicationWorkflow!"
            )

        try:
            self.runner = runner_class(
                config=self.config,
                metadata=self.metadata,
            )
        except Exception as exc:
            logger.error(
                f"Error trying to init the AppRunner [{self.config.sourcePythonClass}] due to [{exc}]"
            )
            raise exc

    def execute_internal(self) -> None:
        """Workflow-specific logic to execute safely"""
        self.runner.run()

    def get_failures(self) -> List[StackTraceError]:
        return self.workflow_steps()[0].get_status().failures

    def workflow_steps(self) -> List[Step]:
        return [self.runner]
