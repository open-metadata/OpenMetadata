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
from functools import partial

# from functools import partial
from typing import Optional

from pydantic import BaseModel
from pymongo import MongoClient

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import get_connection_url_common
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection(connection: MongoDBConnection):
    """
    Create connection
    """
    mongo_url = get_connection_url_common(connection)
    return MongoClient(mongo_url)


def test_connection(
    metadata: OpenMetadata,
    client: MongoClient,
    service_connection: MongoDBConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    class SchemaHolder(BaseModel):
        database: Optional[str] = None

    holder = SchemaHolder()

    def test_get_databases(client_: MongoClient, holder_: SchemaHolder):
        for database in client_.list_database_names():
            holder_.database = database
            break

    def test_get_collections(client_: MongoClient, holder_: SchemaHolder):
        database = client_.get_database(holder_.database)
        database.list_collection_names()

    test_fn = {
        "CheckAccess": client.server_info,
        "GetDatabases": partial(test_get_databases, client, holder),
        "GetCollections": partial(test_get_collections, client, holder),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
