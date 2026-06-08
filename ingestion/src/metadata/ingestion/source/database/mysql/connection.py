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

from contextlib import suppress
from typing import TYPE_CHECKING, cast

from sqlalchemy.engine import Engine
from sqlalchemy.event import listen

from metadata.clients.aws_client import RdsIamAuthTokenManager
from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.checks.database import (
    DatabaseStep,
    list_schemas,
    list_tables,
    list_views,
    ping,
    run_sql,
)
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.common.gcpCloudSqlConfig import (
    GcpCloudsqlConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MySQLConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MySQLScheme,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.engine_strategy import EngineStrategy
from metadata.ingestion.source.database.mysql.queries import (
    MYSQL_TEST_GET_QUERIES,
    MYSQL_TEST_GET_QUERIES_SLOW_LOGS,
)
from metadata.utils.credentials import get_azure_access_token, set_google_credentials

if TYPE_CHECKING:
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.records import Evidence


# Error numbers are from the MySQL 8.0 error references (server:
# https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html,
# client: .../client-error-reference.html). PyMySQL exposes the code at
# ``exception.args[0]`` and SQLAlchemy preserves it at ``exception.orig``, so we
# match on the stable code rather than message text where one exists.
MYSQL_ERRORS = ErrorPack(
    when(Matchers.errno(1045)).diagnose(  # ER_ACCESS_DENIED_ERROR
        "Authentication failed",
        fix="Check the username and password, and that this host is allowed to connect.",
    ),
    when(Matchers.errno(1044)).diagnose(  # ER_DBACCESS_DENIED_ERROR
        "No access to the database",
        fix="Grant the user access to the configured databaseSchema.",
    ),
    when(Matchers.errno(1049)).diagnose(  # ER_BAD_DB_ERROR
        "Database not found",
        fix="Verify the configured databaseSchema exists and the user can see it.",
    ),
    when(Matchers.errno(1142, 1143)).diagnose(  # ER_TABLEACCESS/COLUMNACCESS_DENIED
        "Query history table not accessible",
        fix="Grant SELECT on the configured query history table "
        "(mysql.general_log, or mysql.slow_log when useSlowLogs is set), or query "
        "usage and lineage won't be collected.",
    ),
    when(Matchers.errno(2003)).diagnose(  # CR_CONN_HOST_ERROR (refused / DNS / connect timeout)
        "Cannot reach the MySQL host",
        fix="Check hostPort, that the server is running, and that the network / IP allow-list permits the connection.",
    ),
    when(Matchers.errno(2013)).diagnose(  # CR_SERVER_LOST (read timeout / dropped mid-query)
        "Lost connection to MySQL",
        fix="The server answered but the connection dropped or timed out; check server load and read timeouts.",
    ),
    when(Matchers.errno(2026)).diagnose(  # CR_SSL_CONNECTION_ERROR
        "TLS/SSL connection error",
        fix="Check the SSL/TLS configuration and the server certificate.",
    ),
    # MySQL 8's default caching_sha2_password won't send the password over a plain
    # connection: it needs TLS or RSA public-key exchange. The server may reject
    # with errno 3159 (ER_SECURE_TRANSPORT_REQUIRED) or PyMySQL may raise a
    # no-errno "Couldn't receive server's public key" - match both.
    when(Matchers.errno(3159)).diagnose(
        "Secure connection required (MySQL 8 caching_sha2_password)",
        fix="Enable TLS/SSL (or allow public-key retrieval); MySQL 8's default auth "
        "plugin will not send the password over a plain connection.",
    ),
    when(Matchers.contains("Couldn't receive server's public key")).diagnose(
        "Secure connection required (MySQL 8 caching_sha2_password)",
        fix="Enable TLS/SSL (or allow public-key retrieval); MySQL 8's default auth "
        "plugin will not send the password over a plain connection.",
    ),
)


class MySQLChecks:
    """Test-connection checks for MySQL."""

    errors = MYSQL_ERRORS

    # MySQL 8 system databases - skipped when auto-selecting a schema to probe.
    SYSTEM_SCHEMAS = frozenset({"information_schema", "performance_schema", "mysql", "sys"})

    def __init__(self, client: Engine, schema: str | None, queries_statement: str) -> None:
        self.client = client
        self.schema = schema
        self.queries_statement = queries_statement

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return list_tables(self.client, self.schema, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return list_views(self.client, self.schema, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        return run_sql(self.client, self.queries_statement, lambda _: "query history accessible")


def _basic_engine(connection: MySQLConnectionConfig) -> Engine:
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


class _BasicStrategy(EngineStrategy[MySQLConnectionConfig]):
    """Username/password (and other URL-based) auth."""

    def build(self) -> Engine:
        self._engine = _basic_engine(self._connection)
        return self._engine


class _AzureStrategy(EngineStrategy[MySQLConnectionConfig]):
    """Azure AD: fetch an access token and present it as the password.

    Builds from a copy so the caller's ``service_connection`` is never mutated
    (the original keeps its Azure ``authType``; a token is also short-lived, so a
    fresh one is fetched on each build)."""

    def build(self) -> Engine:
        auth = cast("AzureConfigurationSource", self._connection.authType)
        access_token = get_azure_access_token(auth)
        connection = self._connection.model_copy(deep=True)
        connection.authType = BasicAuth(password=access_token)  # type: ignore[assignment]
        self._engine = _basic_engine(connection)
        return self._engine


class _CloudSqlStrategy(EngineStrategy[MySQLConnectionConfig]):
    """GCP CloudSQL: connect through a ``Connector`` that owns the secure tunnel.

    ``close()`` disposes the engine and closes the connector; ``__del__`` is the
    safety net for the ingestion path, where the connection object is discarded
    without an explicit ``close()``.
    """

    def __init__(self, connection: MySQLConnectionConfig) -> None:
        super().__init__(connection)
        self._connector = None

    def build(self) -> Engine:
        try:
            from google.cloud.sql.connectors import Connector  # noqa: PLC0415
        except ImportError:
            raise ImportError(  # noqa: B904
                "google-cloud-sql-connector is required for GCP CloudSQL connections. "
                "Install it with: pip install 'cloud-sql-python-connector[pymysql]>=1.0.0'"
            )

        connection = self._connection
        auth = cast("GcpCloudsqlConfigurationSource", connection.authType)
        if auth.gcpConfig:
            set_google_credentials(auth.gcpConfig)

        connector = Connector()
        self._connector = connector
        enable_iam_auth = auth.enableIamAuth or False
        password = auth.password.get_secret_value() if auth.password else ""

        def getconn():
            connect_kwargs = {
                "instance_connection_string": connection.hostPort,
                "driver": "pymysql",
                "user": connection.username,
                "db": connection.databaseSchema or "",
            }
            if enable_iam_auth:
                connect_kwargs["enable_iam_auth"] = True
            else:
                connect_kwargs["password"] = password
            return connector.connect(**connect_kwargs)

        try:
            self._engine = create_generic_db_connection(
                connection=connection,
                get_connection_url_fn=lambda _: f"{(connection.scheme or MySQLScheme.mysql_pymysql).value}://",
                get_connection_args_fn=get_connection_args_common,
                creator=getconn,
            )
        except Exception:
            # The Connector is already running; release it so a failed build
            # leaves nothing alive, without relying on __del__/GC.
            self.close()
            raise
        return self._engine

    def close(self) -> None:
        super().close()
        if self._connector is not None:
            self._connector.close()
            self._connector = None

    def __del__(self) -> None:
        # Safety net for paths that skip close(); __del__ must never raise.
        with suppress(Exception):
            self.close()


def _iam_url(connection: MySQLConnectionConfig) -> str:
    """Build the URL like ``get_connection_url_common`` but without a password;
    the ``do_connect`` listener injects a fresh RDS IAM token per connection."""
    url_connection = connection.model_copy()
    url_connection.authType = BasicAuth(password="")  # type: ignore[assignment]
    return get_connection_url_common(url_connection)


class _IamStrategy(EngineStrategy[MySQLConnectionConfig]):
    """AWS RDS IAM: a ``do_connect`` listener mints a fresh token per connection,
    so a long ingestion never opens connections with a stale ~15-minute token."""

    def build(self) -> Engine:
        auth = cast("IamAuthConfigurationSource", self._connection.authType)
        if auth.awsConfig is None:
            raise ValueError("awsConfig is required for MySQL RDS IAM authentication")
        host, port = self._connection.hostPort.split(":")
        token_manager = RdsIamAuthTokenManager(
            host=host,
            port=port,
            username=self._connection.username,
            aws_config=auth.awsConfig,
        )
        self._engine = create_generic_db_connection(
            connection=self._connection,
            get_connection_url_fn=_iam_url,
            get_connection_args_fn=get_connection_args_common,
        )

        def inject_iam_token(_dialect, _conn_rec, _cargs, cparams: dict) -> None:
            cparams["password"] = token_manager.get_token()
            # RDS IAM requires TLS; a truthy ssl dict makes PyMySQL treat it as
            # required (an empty dict only yields PREFERRED). Any explicit ssl
            # config is preserved.
            if "ssl" not in cparams:
                cparams["ssl"] = {"check_hostname": True}

        listen(self._engine, "do_connect", inject_iam_token)
        return self._engine


class MySQLConnection(BaseConnection[MySQLConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """Build the engine via the auth-specific strategy and register the
        strategy's teardown, so ``close()`` releases the engine (and any aux)."""
        strategy = self._engine_strategy()
        engine = strategy.build()
        self._on_close(strategy.close)
        return engine

    def _engine_strategy(self) -> EngineStrategy[MySQLConnectionConfig]:
        match self.service_connection.authType:
            case AzureConfigurationSource():
                return _AzureStrategy(self.service_connection)
            case GcpCloudsqlConfigurationSource():
                return _CloudSqlStrategy(self.service_connection)
            case IamAuthConfigurationSource():
                return _IamStrategy(self.service_connection)
            case _:
                return _BasicStrategy(self.service_connection)

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        raise NotImplementedError("get_connection_dict is not implemented for MySQL")

    def _test_queries_statement(self) -> str:
        if self.service_connection.useSlowLogs:
            template, default_table = MYSQL_TEST_GET_QUERIES_SLOW_LOGS, "mysql.slow_log"
        else:
            template, default_table = MYSQL_TEST_GET_QUERIES, "mysql.general_log"
        table = self.service_connection.queryHistoryTable or default_table
        return template.format(query_history_table=table)

    def checks(self) -> ChecksProvider:
        return MySQLChecks(
            client=self.client,
            schema=self.service_connection.databaseSchema,
            queries_statement=self._test_queries_statement(),
        )
