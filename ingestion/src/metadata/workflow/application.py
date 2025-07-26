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
import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet

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
from metadata.utils.secrets.db_secrets_manager import DBSecretsManager
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
from metadata.workflow.base import BaseWorkflow

logger = ingestion_logger()

FERNET_KEY = "FERNET_KEY"
# default ferney key provided in openmetadata.yaml
DEFAULT_FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA="


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
        private_config = (
            config.appPrivateConfig.root if config.appPrivateConfig else None
        )
        self.private_config = self._retrieve_app_private_config(private_config)

        super().__init__()

    def _retrieve_app_private_config(
        self, private_config: Any
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve private config from secrets manager for applications.

        Args:
            pipeline_fqn: Fully qualified name of the ingestion pipeline (e.g., "OpenMetadata.appName")

        Returns:
            Dictionary containing the private config or None if not found
        """
        try:
            # If it's already a dictionary, return it as-is
            if isinstance(private_config, dict):
                logger.debug("Private config is already a dictionary")
                return private_config
            # If it's None or empty, return None
            elif not private_config:
                logger.debug("Private config is None or empty")
                return None
            # If it's not a string, return None
            elif not isinstance(private_config, str):
                logger.warning(
                    f"Private config has unexpected type: {type(private_config)}"
                )
                return None
            else:
                logger.debug("Private config is a string")

            secrets_manager = SecretsManagerFactory().get_secrets_manager()
            logger.debug(f"Secrets manager used: {str(type(secrets_manager))}")
            if isinstance(secrets_manager, DBSecretsManager):
                logger.debug("Using db secrets manager with Fernet encryption")
                private_config_decrypted = None
                if isinstance(private_config, str):
                    private_config_decrypted = self._decrypt_fernet_private_config(
                        private_config
                    )
                if private_config_decrypted:
                    try:
                        private_config_json = json.loads(private_config_decrypted)
                        if private_config_json.get("token") and isinstance(
                            private_config_json["token"], str
                        ):
                            private_config_json["token"] = CustomSecretStr(
                                private_config_json["token"]
                            )
                        logger.debug(
                            "Successfully retrieved and decrypted private config from db secrets manager"
                        )
                        return private_config_json
                    except json.JSONDecodeError as json_exc:
                        logger.error(
                            f"Failed to parse decrypted private config as JSON: {json_exc}"
                        )
                        return None
                else:
                    logger.debug(
                        "Could not decrypt private config from db secrets manager"
                    )
            else:
                if isinstance(private_config, str) and private_config.startswith(
                    "secret:"
                ):
                    private_config = private_config.replace("secret:", "")
                private_config_fetched = secrets_manager.get_string_value(
                    private_config
                )
                if private_config_fetched:
                    private_config_json = json.loads(private_config_fetched)
                    if private_config_json.get("token") and isinstance(
                        private_config_json["token"], str
                    ):
                        private_config_json["token"] = CustomSecretStr(
                            private_config_json["token"]
                        )
                    logger.debug(
                        f"Successfully retrieved private config from external secrets manager"
                    )
                    return private_config_json
                else:
                    logger.debug(f"No private config found in external secrets manager")
            return None

        except Exception as exc:
            logger.error(
                f"Failed to retrieve private config from secrets manager: {exc}"
            )
            logger.debug(
                "App will run without private config due to secrets manager error"
            )
            return None

    def _get_fernet_key(self) -> Optional[str]:
        """Get Fernet key from various sources in priority order"""
        # Priority 1: Environment variable
        fernet_key = os.getenv(FERNET_KEY)
        if fernet_key and fernet_key != DEFAULT_FERNET_KEY:
            logger.debug("Using Fernet key from environment variable")
            return fernet_key

        # Priority 2: Default key as last resort (with warning)
        if DEFAULT_FERNET_KEY:
            logger.warning(
                "Using default Fernet key - this should only be used for development"
            )
            return DEFAULT_FERNET_KEY
        return None

    def _process_fernet_key(self, fernet_key: str) -> Optional[str]:
        """Process Fernet key to match Java format conversion"""
        try:
            # Convert base64 to base64url (matching Java logic exactly)
            processed_key = (
                fernet_key.replace("/", "_").replace("+", "-").replace("=", "")
            )

            # Take first key if comma-separated (matching Java behavior)
            processed_key = processed_key.split(",")[0].strip()

            # Validate key length (Fernet keys should be 32 bytes)
            # When base64url encoded without padding, this is typically 43 chars
            if len(processed_key) < 32:
                logger.error(
                    f"Fernet key too short: {len(processed_key)} characters (minimum 32)"
                )
                return None

            # Add proper base64url padding
            padding_needed = 4 - (len(processed_key) % 4)
            if padding_needed != 4:
                processed_key += "=" * padding_needed

            # Test key validity by attempting to create Fernet instance
            try:
                test_fernet = Fernet(processed_key.encode())
                # If we get here, the key format is valid
                return processed_key
            except Exception as fernet_exc:
                logger.error(f"Invalid Fernet key format: {fernet_exc}")
                return None

        except Exception as exc:
            logger.error(f"Failed to process Fernet key: {exc}")
            return None

    def _decrypt_fernet_private_config(self, encrypted_config: str) -> Optional[str]:
        """
        Decrypt Fernet-encrypted private config using the server's Fernet key

        Args:
            encrypted_config: Fernet-encrypted string starting with "fernet:"

        Returns:
            Decrypted private config as JSON string, or None if decryption fails
        """
        if not encrypted_config.startswith("fernet:"):
            logger.error(
                f"Input does not appear to be Fernet encrypted: {encrypted_config[:10]}***"
            )
            return None

        try:
            fernet_key = self._get_fernet_key()
            if not fernet_key:
                logger.error("No Fernet key available for decryption")
                return None

            fernet_key = self._process_fernet_key(fernet_key)
            if not fernet_key:
                logger.error("Failed to process Fernet key")
                return None

            # Create Fernet instance
            fernet_instance = Fernet(fernet_key.encode())

            # Remove "fernet:" prefix and decrypt
            encrypted_data = encrypted_config.replace("fernet:", "")
            decrypted_json = fernet_instance.decrypt(encrypted_data.encode()).decode()

            logger.debug(f"Successfully decrypted Fernet-encrypted private config")
            return decrypted_json

        except Exception as exc:
            logger.error(f"Failed to decrypt Fernet-encrypted private config: {exc}")
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
