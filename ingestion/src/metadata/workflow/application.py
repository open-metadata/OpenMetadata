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
from typing import List, Optional

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger
from metadata.workflow.base import BaseWorkflow
from metadata.workflow.workflow_status_mixin import SUCCESS_THRESHOLD_VALUE

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

    def __init__(self, config_dict: dict):
        self.runner = None  # Will be passed in post-init
        # TODO: Create a parse_gracefully method
        self.config = OpenMetadataApplicationConfig.model_validate(config_dict)

        # Applications are associated to the OpenMetadata Service
        self.service_type: ServiceType = ServiceType.Metadata

        metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
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

    def calculate_success(self) -> float:
        return self.runner.get_status().calculate_success()

    def get_failures(self) -> List[StackTraceError]:
        return self.workflow_steps()[0].get_status().failures

    def workflow_steps(self) -> List[Step]:
        return [self.runner]

    def raise_from_status_internal(self, raise_warnings=False):
        """Check failed status in the runner"""
        if (
            self.runner.get_status().failures
            and self.calculate_success() < SUCCESS_THRESHOLD_VALUE
        ):
            raise WorkflowExecutionError(
                f"{self.runner.name} reported errors: {Summary.from_step(self.runner)}"
            )

        if raise_warnings and self.runner.get_status().warnings:
            raise WorkflowExecutionError(
                f"{self.runner.name} reported warning: {Summary.from_step(self.runner)}"
            )
