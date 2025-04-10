#  Copyright 2025 Collate
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
Example external application
"""
from time import sleep
from typing import Any

from metadata.generated.schema.entity.applications.configuration.internal.helloPipelinesConfiguration import (
    HelloPipelinesAppConfiguration,
)
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import app_logger
from metadata.workflow.application import AppRunner, InvalidAppConfiguration

logger = app_logger()


class HelloPipelines(AppRunner):
    """
    Example external application that sleeps for a given time and then echoes a message.
    You can execute it with `metadata app -c <path-to-yaml>`
    with a YAML file like:

    sourcePythonClass: metadata.applications.example.HelloPipelines
    appConfig:
      type: HelloPipelines
      sleep: 5
      echo: this will be echoed
    workflowConfig:
      loggerLevel: INFO
      openMetadataServerConfig:
        hostPort: http://localhost:8585/api
        authProvider: openmetadata
        securityConfig:
          jwtToken: "..."
    """

    def __init__(
        self, config: OpenMetadataApplicationConfig, metadata: OpenMetadata[Any, Any]
    ):
        super().__init__(config, metadata)  # pyright: ignore [reportUnknownMemberType]
        try:
            self.app_config: HelloPipelinesAppConfiguration = (
                HelloPipelinesAppConfiguration.model_validate(self.app_config)
            )
        except Exception as e:
            raise InvalidAppConfiguration(
                f"Hello pipelines received invalid configuration: {e}"
            )

    @property
    def name(self) -> str:
        return "HelloPipelines"

    def run(self) -> None:
        logger.info(f"sleeping for {self.app_config.sleep}")
        sleep(self.app_config.sleep)
        logger.info("echoing")
        logger.info(self.app_config.echo)

    def close(self) -> None:
        """Nothing to close"""
