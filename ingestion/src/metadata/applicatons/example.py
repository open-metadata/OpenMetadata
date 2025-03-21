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
Example external application
"""
from metadata.generated.schema.metadataIngestion.application import OpenMetadataApplicationConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import app_logger
from metadata.workflow.application import AppRunner, InvalidAppConfiguration

logger = app_logger()


class HelloPipelines(AppRunner):
    """
    CollateAIApp Application
    You can execute it with `metadata app -c <path-to-yaml>`
    with a YAML file like:

    sourcePythonClass: metadata.applications.collateai.app.CollateAIApp
    appConfig:
      type: CollateAI
      filters: ...
    appPrivateConfig:
      token: "token"
      collateURL: "https://sandbox-beta.open-metadata.org"
      waiiInstance: "https://tweakit-dev.waii.ai/api/"
      limits:
        billingCycleStart: 2024-10-23
        actions:
          descriptions: 10
          queries: 5
    workflowConfig:
      loggerLevel: INFO
      openMetadataServerConfig:
        hostPort: http://localhost:8585/api
        authProvider: openmetadata
        securityConfig:
          jwtToken: "..."
    """

    def __init__(self, config: OpenMetadataApplicationConfig, metadata: OpenMetadata):
        super().__init__(config, metadata)

        if not isinstance(self.app_config, object):
            raise InvalidAppConfiguration(
                f"Hello pipelines received invalid configuration"
            )


    @property
    def name(self) -> str:
        return "HelloPipelines"

    def run(self) -> None:
        """
        Main entrypoint. We'll do a couple of things:
        1. First, we'll get the different tables that have been processed by the filter, and we'll
           organize them by the database they belong to. We have the relationship of: Collate DB <> WAII Connection.
        1. Then, iterate over each db (with the list of tables), index all the connections (dbs)
           and send the schema and sample data to WAII.
           1.1. We'll wait until WAII is done indexing.
           1.2. We might be able to figure out a way to manage new described tables by directly looking in the server,
                but we have all the data here. We'll send a request to bump the limit.
        2. Then we'll iterate over the connections and suggest descriptions for tables and columns.
        """
        print("this is running")

    def close(self) -> None:
        """Nothing to close"""
