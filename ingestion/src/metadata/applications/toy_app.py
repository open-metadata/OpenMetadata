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
Toy to test applications
"""
from metadata.utils.logger import app_logger
from metadata.workflow.application import AppRunner

logger = app_logger()


class ToyApp(AppRunner):
    """
    Toy Application
    You can execute it with `metadata app -c <path-to-yaml>`
    with a YAML file like:

    sourcePythonClass: metadata.applications.toy_app.ToyApp
    config:
      key: value
    workflowConfig:
      loggerLevel: INFO
      openMetadataServerConfig:
        hostPort: http://localhost:8585/api
        authProvider: openmetadata
        securityConfig:
          jwtToken: "..."
    """

    def run(self) -> None:
        """Test run"""

        logger.info(f"I am {__name__} running with {self.config}.")

    def close(self) -> None:
        """Nothing to close"""
