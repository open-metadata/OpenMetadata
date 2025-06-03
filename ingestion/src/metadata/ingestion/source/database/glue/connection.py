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
Source connection handler
"""
from typing import Optional

from sqlalchemy.engine import Engine

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection(connection: GlueConnection) -> Engine:
    """
    Create connection
    """
    return AWSClient(connection.awsConfig).get_glue_client()


def test_connection(
    metadata: OpenMetadata,
    client: AWSClient,
    service_connection: GlueConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor_for_database():
        paginator = client.get_paginator("get_databases")
        list(paginator.paginate())

    def custom_executor_for_table():
        paginator = client.get_paginator("get_databases")
        for page in paginator.paginate():
            for schema in page["DatabaseList"]:
                database_name = schema["Name"]
                paginator = client.get_paginator("get_tables")
                tables = paginator.paginate(DatabaseName=database_name)
                return list(tables)
        return None

    test_fn = {
        "GetDatabases": custom_executor_for_database,
        "GetTables": custom_executor_for_table,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
