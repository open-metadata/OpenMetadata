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
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.filters import filter_by_schema
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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

    def _get_databases_in_scope(self, client: MongoClient) -> list[str]:
        """Databases the ingestion would actually read.

        MongoDB databases are ingested as OpenMetadata schemas, so `databaseSchema`
        and `schemaFilterPattern` are what narrow them down.
        """
        connection = self.service_connection
        if connection.databaseSchema:
            return [connection.databaseSchema]
        return [
            database
            for database in client.list_database_names()
            if not filter_by_schema(connection.schemaFilterPattern, database)
        ]

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

        class DatabaseHolder(BaseModel):
            """Databases resolved by GetDatabases for GetCollections to probe"""

            databases: list[str] = []
            listed: bool = False

        holder = DatabaseHolder()

        def test_get_databases(client_: MongoClient, holder_: DatabaseHolder):
            holder_.databases = self._get_databases_in_scope(client_)
            holder_.listed = True
            if not holder_.databases:
                logger.warning("No database is in scope: check `Database Schema` and `Schema Filter Pattern`.")

        def test_get_collections(client_: MongoClient, holder_: DatabaseHolder):
            """Probe `listCollections` on the databases in scope, passing on the first success.

            Restricted users often hold `listCollections` only on the databases they
            ingest, so probing one arbitrary database fails the whole test connection
            for a configuration that would ingest fine.
            """
            if not holder_.listed:
                raise SourceConnectionException(
                    "The databases to probe could not be listed, see the GetDatabases step."
                )

            error: Exception | None = None
            for database in holder_.databases:
                try:
                    client_.get_database(database).list_collection_names()
                except Exception as exc:
                    error = exc
                    logger.debug("Failed to list collections of database [%s]: %s", database, exc)
                else:
                    return
            if error is not None:
                raise error

        test_fn = {
            "CheckAccess": client.server_info,
            "GetDatabases": partial(test_get_databases, client, holder),
            "GetCollections": partial(test_get_collections, client, holder),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
