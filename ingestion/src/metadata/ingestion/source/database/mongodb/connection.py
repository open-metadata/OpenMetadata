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

from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import OperationFailure

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import get_connection_url_common
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN

# Server-internal databases. Locked-down users usually cannot list their collections,
# so they are only tried when nothing else is visible.
SYSTEM_DATABASES = frozenset({"admin", "config", "local"})


class DatabaseHolder(BaseModel):
    databases: list[str] = []


def _get_databases(client: MongoClient, holder: DatabaseHolder, database_name: str | None = None) -> None:
    # If database name is provided, use it directly instead of listing all databases
    if database_name:
        holder.databases = [database_name]
    else:
        names = client.list_database_names()
        holder.databases = [name for name in names if name not in SYSTEM_DATABASES] or names


def _get_collections(client: MongoClient, holder: DatabaseHolder) -> None:
    """Pass if the user can list collections in any one database.

    A user scoped to a few databases is not authorized on the rest, and the
    ingestion filters skip those anyway, so one denied database must not fail the step.
    """
    # None falls back to the default database of the connection URL
    *others, last = holder.databases or [None]
    for name in others:
        try:
            client.get_database(name).list_collection_names()
        except OperationFailure:
            continue
        else:
            return
    client.get_database(last).list_collection_names()


class MongoDBConnection(BaseConnection[MongoDBConnectionConfig, MongoClient]):
    def _get_client(self) -> MongoClient:
        connection = self.service_connection
        mongo_url = get_connection_url_common(connection)
        args = {}

        # Extended timeout configuration in connectionOptions:
        # serverSelectionTimeoutMS, connectTimeoutMS, socketTimeoutMS
        if connection.connectionOptions and connection.connectionOptions.root:
            args = connection.connectionOptions.root

        client = MongoClient(mongo_url, **args)  # pyright: ignore[reportArgumentType]
        self._on_close(client.close)
        return client

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        client = self.client
        service_connection = self.service_connection

        holder = DatabaseHolder()

        test_fn = {
            "CheckAccess": client.server_info,
            "GetDatabases": partial(_get_databases, client, holder, service_connection.databaseSchema),
            "GetCollections": partial(_get_collections, client, holder),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
