#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""BigTable connection"""
from typing import List, Optional

from google.cloud.bigtable import Client

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.bigTableConnection import (
    BigTableConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    SingleProjectId,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.bigtable.client import MultiProjectClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection(connection: BigTableConnection):
    set_google_credentials(connection.credentials)
    project_ids = None
    if isinstance(connection.credentials.gcpConfig, GcpCredentialsValues):
        project_ids = (
            [connection.credentials.gcpConfig.projectId.root]
            if isinstance(connection.credentials.gcpConfig.projectId, SingleProjectId)
            else connection.credentials.gcpConfig.projectId.root
        )
    # admin=True is required to list instances and tables
    return MultiProjectClient(client_class=Client, project_ids=project_ids, admin=True)


def get_nested_index(lst: list, index: List[int], default=None):
    try:
        for i in index:
            lst = lst[i]
        return lst
    except IndexError:
        return default


class Tester:
    """
    A wrapper class that holds state. We need it because the different testing stages
    are not independent of each other. For example, we need to list instances before we can list
    """

    def __init__(self, client: MultiProjectClient):
        self.client = client
        self.project_id = None
        self.instance = None
        self.table = None

    def list_instances(self):
        self.project_id = list(self.client.clients.keys())[0]
        instances = list(self.client.list_instances(project_id=self.project_id))
        self.instance = get_nested_index(instances, [0, 0])

    def list_tables(self):
        if not self.instance:
            raise SourceConnectionException(
                f"No instances found in project {self.project_id}"
            )
        tables = list(self.instance.list_tables())
        self.table = tables[0]

    def get_row(self):
        if not self.table:
            raise SourceConnectionException(
                f"No tables found in project {self.instance.project_id} and instance {self.instance.instance_id}"
            )
        self.table.read_rows(limit=1)


def test_connection(
    metadata: OpenMetadata,
    client: MultiProjectClient,
    service_connection: BigTableConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    tester = Tester(client)

    test_fn = {
        "GetInstances": tester.list_instances,
        "GetTables": tester.list_tables,
        "GetRows": tester.get_row,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
