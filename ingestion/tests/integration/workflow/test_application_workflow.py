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
Validate the initialization of the App Workflow
"""
import yaml

from metadata.workflow.application import ApplicationWorkflow, AppRunner


class TestApp(AppRunner):
    """Test App class"""

    def close(self) -> None:
        """I am a test"""

    def run(self) -> None:
        """I am a test"""


def test_init_app() -> None:
    """We can properly instantiate the app"""

    config = f"""
            sourcePythonClass: "{__name__}.TestApp"
            appConfig:
              type: Automator
              resources:
                type: [table]
                queryFilter: "..."
              actions:
                - type: LineagePropagationAction
                  overwriteMetadata: false
            workflowConfig:
              openMetadataServerConfig:
                hostPort: "http://localhost:8585/api"
                authProvider: "openmetadata"
                securityConfig:
                  jwtToken: "..."
            """

    workflow = ApplicationWorkflow.create(yaml.safe_load(config))
    assert isinstance(workflow, ApplicationWorkflow)
