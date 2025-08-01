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

from metadata.generated.schema.entity.applications.app import App
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.ingestion.api.step import Step
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger
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
        self.metadata = metadata
        self.private_config = self._retrieve_app_private_config(
            config.appPrivateConfig.root if config.appPrivateConfig else None,
            config.ingestionPipelineFQN,
        )

        super().__init__()

    def _retrieve_app_private_config(
        self, private_config: Any, ingestion_pipeline_fqn: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve private config from the API using the bot token.
        Bots will get the service unmasked (without fernet encryption).

        Args:
            private_config: The private config from the request (may be None or dict)
            ingestion_pipeline_fqn: Fully qualified name of the ingestion pipeline (e.g., "OpenMetadata.AppName")

        Returns:
            Dictionary containing the private config or None if not found
        """
        try:
            if isinstance(private_config, dict):
                logger.debug("Private config is already a dictionary")
                return private_config
            # Extract app name from ingestion pipeline FQN
            # Format: "OpenMetadata.AppName" -> "AppName"
            if not isinstance(ingestion_pipeline_fqn, str):
                logger.debug(
                    f"ingestion_pipeline_fqn is not a string: {type(ingestion_pipeline_fqn)}"
                )
                return None
            app_name = (
                ingestion_pipeline_fqn.split(".")[-1]
                if "." in ingestion_pipeline_fqn
                else ingestion_pipeline_fqn
            )
            # Use the bot to fetch the app from the API (bots get unmasked data)
            app: App = self.metadata.get_by_name(
                entity=App,
                fqn=app_name,
            )
            if app and app.privateConfiguration:
                # The bot gets the unmasked private config from the API
                fetched_private_config = app.privateConfiguration.root
                if isinstance(fetched_private_config, dict):
                    parsed_private_config = self._mask_private_config_token(
                        fetched_private_config
                    )
                    logger.debug(
                        "Successfully retrieved app private config from API using bot token"
                    )
                    return parsed_private_config
                elif isinstance(
                    fetched_private_config, str
                ) and fetched_private_config.startswith("secret:"):
                    # The bot gets the masked private config and fetch the secret from the secrets manager
                    fetched_private_config = fetched_private_config.replace(
                        "secret:", ""
                    )
                    secrets_manager = SecretsManagerFactory().get_secrets_manager()
                    fetched_private_config = secrets_manager.get_string_value(
                        fetched_private_config
                    )
                    if fetched_private_config:
                        parsed_private_config = json.loads(fetched_private_config)
                        parsed_private_config = self._mask_private_config_token(
                            parsed_private_config
                        )
                        logger.debug(
                            "Successfully retrieved private config from secrets manager"
                        )
                        return parsed_private_config
                    else:
                        logger.debug("No private config found in secrets manager")
                        return None
                else:
                    logger.debug("App private config is not a dictionary or string")
                    return None
            else:
                logger.debug("App not found or has no private config")
                return None
        except Exception as exc:
            logger.debug(f"Failed to retrieve private config: {exc}")
            logger.debug("App will run without private config due to error")
        return None

    def _mask_private_config_token(
        self, private_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Mask the token in the private config
        """
        if private_config.get("token") and isinstance(private_config["token"], str):
            private_config["token"] = CustomSecretStr(private_config["token"])
            logger.debug("Masked token in private config")
        return private_config

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
