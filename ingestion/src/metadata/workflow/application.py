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
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

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
from metadata.utils.secrets.external_secrets_manager import ExternalSecretsManager
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
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

        # If private_config is None/empty and we have ingestion pipeline FQN,
        # try to retrieve it from secrets manager (for external apps)
        if (
            not self.private_config
            and config.ingestionPipelineFQN
            and self._is_external_secrets_manager_available()
        ):
            self.private_config = self._retrieve_external_app_private_config(
                config.ingestionPipelineFQN
            )

        super().__init__()

    def _is_external_secrets_manager_available(self) -> bool:
        """Check if external secrets manager is available and configured"""
        try:
            secrets_manager = SecretsManagerFactory().get_secrets_manager()
            return isinstance(secrets_manager, ExternalSecretsManager)
        except Exception:
            return False

    def _retrieve_external_app_private_config(
        self, pipeline_fqn: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve private config from external secrets manager for external apps.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline (e.g., "OpenMetadata.appName")

        Returns:
            Dictionary containing the private config or None if not found
        """
        try:
            # Extract app name from FQN (format: "OpenMetadata.{appName}")
            app_name = self._extract_app_name_from_fqn(pipeline_fqn)
            if not app_name:
                logger.debug(f"Could not extract app name from FQN: {pipeline_fqn}")
                return None

            # Construct secret ID following the Java pattern
            secret_id = f"external-app-{app_name.lower()}-private-config"

            # Retrieve from secrets manager
            secrets_manager = SecretsManagerFactory().get_secrets_manager()
            if isinstance(secrets_manager, ExternalSecretsManager):
                private_config_json = secrets_manager.get_string_value(secret_id)
                if private_config_json:
                    private_config = json.loads(private_config_json)
                    logger.info(
                        f"Successfully retrieved private config from secrets manager for external app: {app_name}"
                    )
                    return private_config
                else:
                    logger.debug(
                        f"No private config found in secrets manager for app: {app_name}"
                    )
                    return None
            else:
                logger.debug("External secrets manager not available")
                return None

        except Exception as exc:
            logger.error(
                f"Failed to retrieve private config from secrets manager for FQN {pipeline_fqn}: {exc}"
            )
            logger.debug(f"External app will run without private config")
            return None

    def _extract_app_name_from_fqn(self, pipeline_fqn: str) -> Optional[str]:
        """
        Extract app name from ingestion pipeline FQN.

        Args:
            pipeline_fqn: Fully qualified name like "OpenMetadata.appName"

        Returns:
            App name or None if extraction fails
        """
        try:
            # FQN format is "OpenMetadata.{appName}" based on Java implementation
            parts = pipeline_fqn.split(".")
            if len(parts) >= 2 and parts[0] == "OpenMetadata":
                # Return the app name (second part)
                return parts[1]
            else:
                logger.debug(f"Unexpected FQN format: {pipeline_fqn}")
                return None
        except Exception as exc:
            logger.error(f"Error extracting app name from FQN {pipeline_fqn}: {exc}")
            return None

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
