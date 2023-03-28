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
Entrypoint to run an automation workflow
"""
import os

import yaml

from metadata.automations.runner import execute
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)


def main():
    """
    We will receive in the config env var the Automations Workflow YAML,
    for example, for a Test Connection Request:

    ```json
    id: d8afbfd4-f8da-4e0b-8b37-53a26a774d54
    name: test-connection-mysql-01
    description: mysql test connection workflow
    fullyQualifiedName: test-connection-mysql-01
    workflowType: TEST_CONNECTION
    status: Successful
    request:
      connection:
        config:
          type: Mysql
          scheme: mysql+pymysql
          username: openmetadata_user
          password: openmetadata_password
          hostPort: 'mysql:3306'
      serviceType: Database
      connectionType: Mysql
      serviceName: mysql_local_01
      secretsManagerProvider: noop
    openMetadataServerConnection:
      clusterName: openmetadata
      type: OpenMetadata
      hostPort: 'http://openmetadata-server:8585/api'
      authProvider: openmetadata
    ```
    """

    config = os.getenv("config")
    if not config:
        raise RuntimeError(
            "Missing environment variable `config` with the Automations Workflow dict."
        )

    automation_workflow_dict = yaml.safe_load(config)
    automation_workflow = AutomationWorkflow.parse_obj(automation_workflow_dict)

    execute(automation_workflow)


if __name__ == "__main__":
    main()
