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

from __future__ import annotations

from typing import TYPE_CHECKING

from pymongo import MongoClient
from pymongo.errors import ConfigurationError, ServerSelectionTimeoutError

from metadata.core.connections.test_connection import ErrorPack, Evidence, Matchers, check, when
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.scope import ProbeScope, probe_targets
from metadata.core.connections.test_connection.checks.summary import count, enumerated
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.core.connections.test_connection.records import Diagnosis
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.ingestion.connections.builders import get_connection_url_common
from metadata.ingestion.connections.connection import BaseConnection

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider


MONGODB_ERRORS = ErrorPack(
    when(Matchers.contains("authentication failed")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that `authSource` in connectionOptions names the "
        "database the user was created in (`admin` for most deployments). Note that setting "
        "`Database Schema` puts that database in the connection URI, which is where the driver "
        "authenticates unless `authSource` says otherwise.",
    ),
    when(Matchers.contains("not authorized")).diagnose(
        "Not authorized",
        fix="Grant the user `listCollections` on the databases it should read (the `read` role on "
        "each of them is enough), or narrow `Database Schema` / `Schema Filter Pattern` to the "
        "databases it can read.",
    ),
    when(Matchers.exception(ServerSelectionTimeoutError)).diagnose(
        "No server could be reached",
        fix="Check hostPort, that the deployment is running, and that it is reachable from where "
        "ingestion runs. A replica set also has to advertise hostnames the client can resolve.",
    ),
    when(Matchers.exception(ConfigurationError)).diagnose(
        "Connection settings rejected",
        fix="The driver could not use these settings: check the scheme (`mongodb+srv` requires a "
        "host with no port and a resolvable SRV record) and the keys in connectionOptions.",
    ),
).including(NETWORK_ERRORS)


class MongoDBChecks:
    """Test-connection checks for MongoDB.

    Databases are ingested as OpenMetadata schemas, so `databaseSchema` and
    `schemaFilterPattern` are what say which of them a run would read - and
    therefore which are worth probing.
    """

    errors = MONGODB_ERRORS

    def __init__(self, client: Borrowed[MongoClient], scope: ProbeScope) -> None:
        self._client = client
        self._scope = scope
        self._targeted: list[str] | None = None

    def _targeted_databases(self) -> list[str]:
        """The databases the configured scope would read.

        Memoized, and resolved lazily so no listing runs ahead of the gate step.
        A pinned `databaseSchema` needs no listing at all - which also keeps the
        step working for a user that cannot run `listDatabases`.
        """
        if self._targeted is None:
            if self._scope.pinned:
                self._targeted = self._scope.targets([])
            else:
                self._targeted = self._scope.targets(self._client.client.list_database_names())
        return self._targeted

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        info = self._client.client.server_info()
        return Evidence(
            summary=f"connected to MongoDB {info.get('version', 'unknown')}",
            command="buildInfo",
        )

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        command = "listDatabases" if not self._scope.pinned else f"database({self._scope.pinned!r})"
        try:
            targeted = self._targeted_databases()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(
            summary=enumerated(len(targeted), "database"),
            command=command,
            caveat=None if targeted else _nothing_in_scope(),
        )

    @check(DatabaseStep.GetCollections)
    def get_collections(self) -> Evidence:
        """Read the collections of the databases in scope, passing on the first that answers.

        A user restricted to the databases it ingests is unauthorized on every
        other one, so a single database refusing `listCollections` must not fail
        the step - only every database in scope refusing it does.
        """
        targeted = self._targeted_databases()
        command = "listCollections"
        if not targeted:
            return Evidence(
                summary="no database in scope to read collections from",
                command=command,
                caveat=_nothing_in_scope(),
            )

        found: dict[str, int] = {}

        def probe(database: str) -> None:
            found[database] = len(self._client.client.get_database(database).list_collection_names())

        try:
            database = probe_targets(targeted, probe)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause

        number = found.get(database, 0) if database else 0
        return Evidence(
            summary=f"{count(number, 'collection')} in database '{database}'",
            command=command,
            caveat=None if number else _nothing_visible(str(database)),
        )


def _nothing_in_scope() -> Diagnosis:
    return Diagnosis(
        title="No database in scope",
        remediation="No database survived `Database Schema` / `Schema Filter Pattern`, or none is "
        "visible to this user. Ingestion would collect nothing as configured.",
    )


def _nothing_visible(database: str) -> Diagnosis:
    return Diagnosis(
        title="No collections visible",
        remediation=f"The read succeeded but database '{database}' exposes no collection. Confirm it "
        "is not empty, and that the user can list the collections it should ingest.",
    )


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

    def checks(self) -> ChecksProvider:
        # Borrowed, not built: reading the client is what dials the deployment, so
        # a connection failure lands inside the gate step.
        connection = self.service_connection
        return MongoDBChecks(
            client=self.borrow(),
            scope=ProbeScope(pinned=connection.databaseSchema, excluded=connection.schemaFilterPattern),
        )
