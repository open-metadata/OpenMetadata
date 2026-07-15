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

import os
from functools import singledispatch
from typing import TYPE_CHECKING, Any, Optional
from urllib.parse import quote, urlparse

from packaging import version
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import JSONDecodeError, SSLError, Timeout
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from airflow import __version__ as airflow_version
from airflow import settings
from airflow.models.serialized_dag import SerializedDagModel
from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import run_sql
from metadata.core.connections.test_connection.checks.pipeline import (
    PipelineStep,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import (
    NETWORK_ERRORS,
    NetworkUnreachableError,
    tcp_probe,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MysqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection as SQLiteConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection as AirflowConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.query_logger import attach_query_tracker
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.airflow.api.client import AirflowApiClient
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable

    from sqlalchemy.orm import Session

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

logger = ingestion_logger()

ORM_ACCESS_BLOCKED_ERROR = "Direct database access via the ORM"

try:
    IS_AIRFLOW_3 = version.parse(airflow_version).major >= 3
except Exception:  # pylint: disable=broad-except
    # Be conservative and keep the Airflow 2.x code path if we can't detect the version
    IS_AIRFLOW_3 = False


# Only import when needed
# pylint: disable=import-outside-toplevel
@singledispatch
def _get_connection(airflow_connection) -> Engine:
    """
    Internal call for Airflow connection build
    """
    raise NotImplementedError(f"Not support connection type {airflow_connection}")


@_get_connection.register
def _(_: BackendConnection) -> Engine:
    if IS_AIRFLOW_3:
        return _get_engine_from_env_vars()

    engine = _get_backend_engine_from_session()
    if not engine:
        raise SourceConnectionException(
            "Could not create an Airflow metadata DB engine using airflow.settings. "
            "If you are running Airflow >= 3, ensure the required DB_* environment "
            "variables are set."
        )
    return engine


def _get_backend_engine_from_session() -> Optional[Engine]:  # noqa: UP045
    """
    Try to get the Airflow metadata engine via airflow.settings.Session.
    This is allowed on Airflow 2.x but raises a RuntimeError on Airflow 3.x.
    """
    if settings.Session is None:
        return None
    try:
        with settings.Session() as session:
            return session.get_bind()
    except RuntimeError as exc:
        if ORM_ACCESS_BLOCKED_ERROR in str(exc):
            logger.info(
                "Airflow prevented direct ORM access (likely Airflow 3.x). "
                "Switching to the environment-based connection builder."
            )
            return None
        raise


def _get_engine_from_env_vars() -> Engine:
    """
    Build the Airflow metadata database URL based on the DB_* variables that
    ingestion_dependency.sh sets to keep docker + tests working.
    """

    scheme = os.environ.get("DB_SCHEME")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT")
    database = os.environ.get("AIRFLOW_DB")
    properties = os.environ.get("DB_PROPERTIES")

    missing = [
        name
        for name, value in (
            ("DB_SCHEME", scheme),
            ("DB_USER", user),
            ("DB_PASSWORD", password),
            ("DB_HOST", host),
            ("DB_PORT", port),
            ("AIRFLOW_DB", database),
        )
        if not value
    ]
    if missing:
        raise SourceConnectionException(
            "Airflow 3.x execution environments must define the following environment "
            f"variables to allow OpenMetadata to build the metadata DB connection: "
            f"{', '.join(missing)}"
        )

    encoded_user = quote(user, safe="")
    encoded_password = quote(password, safe="")
    properties = properties or ""

    sql_alchemy_conn = f"{scheme}://{encoded_user}:{encoded_password}@{host}:{port}/{database}{properties}"

    try:
        engine = create_engine(sql_alchemy_conn, pool_pre_ping=True)
        attach_query_tracker(engine)
        return engine  # noqa: TRY300
    except Exception as exc:  # pylint: disable=broad-except
        raise SourceConnectionException(
            "Failed to create SQLAlchemy engine using the DB_* environment variables. "
            "Double check the credentials and scheme."
        ) from exc


@_get_connection.register
def _(airflow_connection: MysqlConnectionConfig) -> Engine:
    from metadata.ingestion.source.database.mysql.connection import MySQLConnection  # noqa: PLC0415

    return MySQLConnection(airflow_connection)._get_client()


@_get_connection.register
def _(airflow_connection: PostgresConnectionConfig) -> Engine:
    from metadata.ingestion.source.database.postgres.connection import (  # noqa: PLC0415
        PostgresConnection,
    )

    return PostgresConnection(airflow_connection)._get_client()


@_get_connection.register
def _(airflow_connection: SQLiteConnectionConfig) -> Engine:
    from metadata.ingestion.source.database.sqlite.connection import (  # noqa: PLC0415
        SQLiteConnection,
    )

    return SQLiteConnection(airflow_connection)._get_client()


def get_connection(connection: AirflowConnectionConfig):
    """
    Create connection
    """
    from metadata.generated.schema.entity.utils.airflowRestApiConnection import (  # pylint: disable=import-outside-toplevel  # noqa: PLC0415
        AirflowRestApiConnection,
    )

    if isinstance(connection.connection, AirflowRestApiConnection):
        return AirflowApiClient(connection)

    try:
        return _get_connection(connection.connection)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


class AirflowTaskDetailsAccessError(Exception):
    """
    Raise when Task detail information is not retrieved
    """


def _test_task_detail_access(session) -> Optional[Any]:  # noqa: UP045
    """
    Verify task-level access to serialized_dag.
    Extracted to module level so it can be unit-tested directly.
    """
    try:
        json_data_column = (
            SerializedDagModel._data  # For 2.3.0 onwards # pylint: disable=protected-access
            if hasattr(SerializedDagModel, "_data")
            else SerializedDagModel.data  # For 2.2.5 and 2.1.4
        )
        result = session.query(json_data_column).first()

        if result is None:
            logger.warning(
                "No serialized DAGs found in the `serialized_dag` table. "
                "The table is accessible but empty — task detail access cannot be validated."
            )
            return None

        if result[0] is None:
            logger.debug(
                "Serialized DAG data column is NULL — COMPRESS_SERIALIZED_DAGS is enabled. "
                "Falling back to dag_id query to confirm `serialized_dag` table access."
            )
            return session.query(SerializedDagModel.dag_id).first()

        return result[0]["dag"]["tasks"]
    except Exception as e:
        raise AirflowTaskDetailsAccessError(f"Task details access error : {e}") from e


def _decorated_check_access(client, host, auth_config, verify: bool) -> Any:  # pyright: ignore[reportMissingParameterType]
    """
    Call client.get_version(); on failure, attempt a managed-flavor-specific
    diagnostic and raise SourceConnectionException with a combined message
    ("<original error>\\n\\n<hint>"). When no hint applies, the original
    exception is re-raised unchanged.
    """
    from metadata.ingestion.source.pipeline.airflow.api.diagnostics import (  # noqa: PLC0415
        diagnose,
    )

    result = None
    try:
        result = client.get_version()
    except Exception as exc:
        hint = diagnose(host, auth_config, verify, exc)
        if hint:
            raise SourceConnectionException(f"{exc}\n\n{hint}") from exc
        raise
    return result


def _http_status(*codes: int) -> Matcher:
    """Match an Airflow REST error by HTTP status, across the cause chain."""
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        return any(
            getattr(getattr(current, "response", None), "status_code", None) in wanted
            for current in exception_chain(error)
        )

    return match


def _db_message(*tokens: str) -> Matcher:
    """Match a metadata-DB driver error by message token.

    Requires a SQLAlchemy error in the cause chain, so a REST/transport failure
    that happens to carry the same words is never diagnosed as a database problem.
    """
    needles = [token.lower() for token in tokens]

    def match(error: BaseException) -> bool:
        chain = list(exception_chain(error))
        result = False
        if any(isinstance(current, SQLAlchemyError) for current in chain):
            text = " ".join(str(current).lower() for current in chain)
            result = any(needle in text for needle in needles)
        return result

    return match


# Only signals we exercised live or that follow directly from HTTP / driver
# documentation are diagnosed here; everything else keeps its raw error log.
AIRFLOW_ERRORS = ErrorPack(
    when(_http_status(401)).diagnose(
        "Authentication failed",
        fix="Airflow rejected the credentials. Check the username and password (or token) are "
        "correct and not expired.",
    ),
    when(_http_status(403)).diagnose(
        "Access denied",
        fix="The credentials are valid but lack access. Grant this user permission to read the "
        "Airflow REST API.",
    ),
    when(_http_status(404)).diagnose(
        "Endpoint not found",
        fix="Airflow returned 404 for this URL. Check the Host and Port point to the Airflow web "
        "server, not a UI or console page.",
    ),
    # A URL that is not the Airflow REST API (an SSO login page, the marketing
    # site) answers with HTML that fails to decode as JSON.
    when(Matchers.exception(JSONDecodeError)).diagnose(
        "Host is not the Airflow REST API",
        fix="The host replied with a web page, not the Airflow REST API. Point the Host and Port "
        "at the Airflow web server and make sure its REST API is enabled.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The server's certificate could not be verified. Check the Host, or uncheck "
        "'Verify SSL' if you use a self-signed certificate.",
    ),
    when(Matchers.exception(Timeout)).diagnose(
        "Connection timed out",
        fix="Airflow did not respond in time. Check the Host and Port and that a firewall allows "
        "access to it.",
    ),
    when(Matchers.exception(RequestsConnectionError)).diagnose(
        "Cannot reach the host",
        fix="Could not reach the host. Check the Host and Port for typos and that it is reachable.",
    ),
    # Metadata-DB backend path. MySQL answers a bad login with "Access denied"
    # (1045) and PostgreSQL with "password authentication failed" (28P01). Gated
    # to a SQLAlchemy error so a REST failure carrying the same words is never
    # mislabeled as a database problem.
    when(_db_message("access denied", "password authentication failed")).diagnose(
        "Database authentication failed",
        fix="The Airflow metadata database rejected the credentials. Check the database username "
        "and password.",
    ),
).including(NETWORK_ERRORS)


class AirflowChecks:
    """Test-connection checks for Airflow.

    The client is dual-mode: an ``AirflowApiClient`` (REST) or a SQLAlchemy
    ``Engine`` (metadata-DB backend). ``CheckAccess`` is the gate - it proves the
    host and credentials before the later steps run. The client is borrowed from
    the connection that owns it; a check never builds or authenticates its own.
    """

    errors = AIRFLOW_ERRORS

    def __init__(self, client: Borrowed[Any]) -> None:
        self._client = client

    @property
    def client(self) -> Any:
        return self._client.client

    @check(PipelineStep.CheckAccess)
    def check_access(self) -> Evidence:
        client = self.client
        if isinstance(client, AirflowApiClient):
            host, auth_config, verify = self._rest_context(client)
            self._preflight(client, host)
            return verify_access(
                lambda: _decorated_check_access(client, host, auth_config, verify),
                command="read the Airflow REST API version",
            )
        return run_sql(client, "SELECT 1", lambda _: "connection established")

    @staticmethod
    def _preflight(client: AirflowApiClient, host: str | None) -> None:
        """TCP-probe the host so an unreachable Airflow fails fast as a network
        error, instead of waiting out the REST client's connect-retry budget.

        Skipped for MWAA, whose transport is the AWS SDK rather than a socket to
        ``host``, and when the host carries no resolvable host:port.
        """
        if client.mwaa_client is not None or not host:
            return
        parsed = urlparse(host)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if parsed.hostname:
            try:
                tcp_probe(parsed.hostname, port)
            except NetworkUnreachableError as error:
                raise CheckError(error, Evidence(command=f"TCP connect {parsed.hostname}:{port}")) from error

    @staticmethod
    def _rest_context(client: AirflowApiClient) -> tuple[str | None, Any, bool]:
        """Derive host, auth config and verifySSL from the borrowed REST client.

        Read off the client the connection already built, so the provider never
        sees the raw config (which is the ability to build a second client).
        """
        config = client.config
        host = str(config.hostPort) if getattr(config, "hostPort", None) else None
        rest_config = config.connection
        auth_config = getattr(rest_config, "authConfig", None)
        verify = getattr(rest_config, "verifySSL", True)
        return host, auth_config, verify

    @check(PipelineStep.PipelineDetailsAccess)
    def pipeline_details_access(self) -> Evidence:
        client = self.client
        if isinstance(client, AirflowApiClient):
            return verify_access(
                lambda: client.list_dags(limit=1),
                command="list one DAG via the Airflow REST API",
            )
        return self._backend_step(
            lambda session: session.query(SerializedDagModel.dag_id).first(),
            command="SELECT dag_id FROM serialized_dag LIMIT 1",
            summary="serialized_dag reachable",
        )

    @check(PipelineStep.TaskDetailAccess)
    def task_detail_access(self) -> Evidence:
        client = self.client
        if isinstance(client, AirflowApiClient):
            return Evidence(summary="task details are read per-DAG during ingestion")
        return self._backend_step(
            _test_task_detail_access,
            command="SELECT data FROM serialized_dag LIMIT 1",
            summary="serialized_dag task payload reachable",
        )

    def _backend_step(self, run: Callable[[Session], object], command: str, summary: str) -> Evidence:
        """Run a query against a session bound to the borrowed engine.

        The session is a per-call working handle over the owned engine, not a
        second client. On failure re-raise as ``CheckError`` carrying the command,
        so the failed step still reports what it ran.
        """
        try:
            with sessionmaker(bind=self.client)() as session:
                run(session)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(summary=summary, command=command)


class AirflowConnection(BaseConnection[AirflowConnectionConfig, Any]):
    def _get_client(self) -> Any:
        client = get_connection(self.service_connection)
        if isinstance(client, Engine):
            self._on_close(client.dispose)
        return client

    def checks(self) -> ChecksProvider:
        return AirflowChecks(self.borrow())
