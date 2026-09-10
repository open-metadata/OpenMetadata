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

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_db_common,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.azuresql.connection import (
    DEFAULT_SQL_SERVER_PORT,
)
from metadata.ingestion.source.database.azuresql.connection import (
    get_connection_url as get_pyodbc_connection_url,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_CURRENT_DATABASE,
    MSSQL_GET_DATABASE,
    MSSQL_TEST_GET_QUERIES,
    MSSQL_TEST_GET_QUERIES_FROM_QUERY_STORE,
)
from metadata.ingestion.source.database.mssql.utils import is_query_store_enabled
from metadata.utils.constants import THREE_MIN

DEFAULT_ODBC_DRIVER = "ODBC Driver 18 for SQL Server"
FREETDS_ODBC_DRIVER = "FreeTDS"


def _odbc_driver_for_data_diff(connection: MssqlConnectionConfig) -> str:
    """The ODBC driver whose auth capability matches `connection.scheme`.

    data-diff is pyodbc-only, so a non-ODBC scheme still has to resolve to an ODBC
    driver. Only FreeTDS splits a `DOMAIN\\user` login and negotiates NTLM;
    msodbcsql offers it as a SQL login name, which SQL Server rejects with 18456
    (a backslash is illegal in a SQL login, so the account can only be a Windows
    one). pymssql is itself a FreeTDS binding, hence the mapping. pytds is
    SQL-auth-only, so msodbcsql matches it exactly - routing it to FreeTDS would
    let the diff authenticate more than metadata ingestion can. See issue #32582.

    `connection.driver` is read only under pyodbc: it is documented as pyodbc-only
    and otherwise sits at its schema default, so trusting it elsewhere would be a
    no-op for exactly the configuration this resolves.
    """
    scheme = connection.scheme or MssqlScheme.mssql_pytds
    if scheme.value == MssqlScheme.mssql_pyodbc.value:
        return connection.driver or DEFAULT_ODBC_DRIVER
    if scheme.value == MssqlScheme.mssql_pymssql.value:
        return FREETDS_ODBC_DRIVER
    return DEFAULT_ODBC_DRIVER


def get_connection_url(connection: MssqlConnectionConfig) -> str:
    if connection.scheme.value == connection.scheme.mssql_pyodbc.value:
        return get_pyodbc_connection_url(connection)
    return get_connection_url_common(connection)


def get_connection(connection: MssqlConnectionConfig) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: MssqlConnectionConfig,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    queries = {
        "GetQueries": (
            MSSQL_TEST_GET_QUERIES_FROM_QUERY_STORE
            if is_query_store_enabled(engine)
            else MSSQL_TEST_GET_QUERIES
        ),
        "GetDatabases": MSSQL_GET_DATABASE
        if service_connection.ingestAllDatabases
        else MSSQL_GET_CURRENT_DATABASE,
    }

    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
        timeout_seconds=timeout_seconds,
    )


class MssqlConnection(BaseConnection[MssqlConnectionConfig, Engine]):
    def __init__(self, connection: MssqlConnectionConfig):
        super().__init__(connection)

    def _get_client(self) -> Engine:
        return get_connection(self.service_connection)

    def get_connection_dict(self) -> dict:
        """Return the connection parameters for data-diff.

        Preferred over a rendered SQLAlchemy URL because it bypasses URI parsing
        entirely: credentials reach data-diff verbatim, so usernames holding
        reserved characters need no encode/decode round trip (see #31124/#31134),
        and `odbc_driver` can carry the driver the URL has no room for.
        """
        connection = self.service_connection
        if not connection.hostPort:
            # `hostPort` is optional in the schema. Defaulting the host to "" would be
            # worse than refusing: ODBC reads a blank server as the local machine, so
            # the diff would quietly connect somewhere unintended. Falling back to a
            # rendered URL cannot work either - it raises a bare TypeError - and this
            # must stay outside (ValueError, AttributeError, NotImplementedError), or
            # BaseTableParameter._get_service_connection_config downgrades it to that
            # fallback and swallows the message.
            raise SourceConnectionException(
                "MSSQL connection has no hostPort configured, so the table diff has nothing "
                "to connect to. Set 'Host and Port' on the service connection."
            )

        host, _, port = connection.hostPort.partition(":")
        if port and not port.isdigit():
            # Same reasoning as above, from the other side: `int(port)` would raise
            # ValueError, which that fallback catches, so a typo'd port would drop
            # the diff back onto the URL path and take the derived ODBC driver with
            # it. Quietly defaulting to 1433 is no better - it connects somewhere
            # the user did not ask for.
            raise SourceConnectionException(
                f"MSSQL hostPort {connection.hostPort!r} has a non-numeric port, so the table "
                "diff cannot connect. Set 'Host and Port' to 'host:port', or to 'host' alone "
                f"to use the default {DEFAULT_SQL_SERVER_PORT}."
            )

        return {
            # connectionOptions used to ride along as query params on the rendered
            # URL and land in pyodbc's kwargs. This dict replaces that URL, so it
            # has to carry them or extra ODBC keywords stop applying to diffs. The
            # derived values below win: they are what makes domain auth work.
            **(get_connection_options_dict(connection) or {}),
            "driver": (connection.scheme or MssqlScheme.mssql_pytds).value,
            "host": host,
            "port": int(port) if port else DEFAULT_SQL_SERVER_PORT,
            "user": connection.username,
            "password": connection.password.get_secret_value()
            if connection.password
            else None,
            "database": connection.database,
            "odbc_driver": _odbc_driver_for_data_diff(connection),
        }

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        return test_connection(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
