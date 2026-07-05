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
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.sql import text

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
    list_schemas,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection as RedshiftConnectionConfig,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATIONS,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_TEST_GET_QUERIES_MAP,
)
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.engine import Row

    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

logger = ingestion_logger()


def _is_serverless_host(host: str) -> bool:
    return "redshift-serverless" in host


def _get_serverless_workgroup(host: str) -> str:
    """
    Extract the workgroup name from a Redshift Serverless host.
    Serverless hosts follow: workgroup-name.account-id.region.redshift-serverless.amazonaws.com
    """
    return host.split(".")[0]  # noqa: PLC0207


def _get_provisioned_cluster_identifier(host: str) -> str:
    """
    Extract the cluster identifier from a Redshift Provisioned host.
    Provisioned hosts follow: cluster-id.xxxxx.region.redshift.amazonaws.com
    """
    return host.split(".")[0]  # noqa: PLC0207


def _get_serverless_iam_credentials(connection: RedshiftConnectionConfig, host: str) -> tuple:
    workgroup = _get_serverless_workgroup(host)
    try:
        aws_client = AWSClient(config=connection.authType.awsConfig).get_redshift_serverless_client()

        kwargs = {"workgroupName": workgroup, "dbName": connection.database or "dev"}

        response = aws_client.get_credentials(**kwargs)
        return response["dbUser"], response["dbPassword"]
    except Exception as exc:
        raise SourceConnectionException(
            f"Failed to retrieve IAM credentials for Redshift Serverless workgroup '{workgroup}': {exc}"
        ) from exc


def _get_provisioned_iam_credentials(connection: RedshiftConnectionConfig, host: str) -> tuple:
    cluster_identifier = _get_provisioned_cluster_identifier(host)
    try:
        aws_client = AWSClient(config=connection.authType.awsConfig).get_redshift_client()

        kwargs = {
            "DbUser": connection.username,
            "ClusterIdentifier": cluster_identifier,
            "AutoCreate": False,
        }
        if connection.database:
            kwargs["DbName"] = connection.database

        response = aws_client.get_cluster_credentials(**kwargs)
        return response["DbUser"], response["DbPassword"]
    except Exception as exc:
        raise SourceConnectionException(
            f"Failed to retrieve IAM credentials for Redshift cluster '{cluster_identifier}': {exc}"
        ) from exc


def _get_redshift_iam_credentials(connection: RedshiftConnectionConfig) -> tuple:
    """
    Get temporary credentials for Redshift using IAM authentication.
    Detects Serverless vs Provisioned from the host and uses the appropriate API.
    """
    host = connection.hostPort.split(":")[0]

    if _is_serverless_host(host):
        return _get_serverless_iam_credentials(connection, host)
    return _get_provisioned_iam_credentials(connection, host)


def get_redshift_connection_url(connection: RedshiftConnectionConfig) -> str:
    """
    Build the Redshift connection URL.
    Handles both basic auth and IAM auth.
    """
    if (
        hasattr(connection, "authType")
        and connection.authType
        and isinstance(connection.authType, IamAuthConfigurationSource)
    ):
        username, password = _get_redshift_iam_credentials(connection)

        url = f"{connection.scheme.value}://"
        url += f"{quote_plus(username)}:{quote_plus(password)}@"
        url += connection.hostPort
        url += f"/{connection.database}" if connection.database else ""

        options = get_connection_options_dict(connection)
        if options:
            if not connection.database:
                url += "/"
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            url = f"{url}?{params}"

        return url

    return get_connection_url_common(connection)


def get_redshift_instance_type(engine: Engine) -> RedshiftInstanceType:
    """
    Detect whether the connected Amazon Redshift deployment is Provisioned
    or Serverless by probing for STL system table availability.

    Serverless deployments do not have access to STL_* system tables due to
    their architecture. Use SYS_* views instead for Serverless compatibility.

    Reference: https://docs.aws.amazon.com/redshift/latest/dg/cm_chap_system-tables.html#sys_view_migration-use_cases

    Args:
        engine (Engine): SQLAlchemy engine connected to a Redshift endpoint.

    Returns:
        RedshiftInstanceType: PROVISIONED if STL tables are accessible,
                              SERVERLESS otherwise.
    """
    probe_query = text("SELECT 1 FROM pg_catalog.stl_query LIMIT 1")

    try:
        with engine.connect() as conn:
            conn.execute(probe_query)

        logger.info("Redshift instance type detected: PROVISIONED (STL tables accessible)")
        return RedshiftInstanceType.PROVISIONED  # noqa: TRY300

    except ProgrammingError:
        logger.info("Redshift instance type detected: SERVERLESS (STL tables not accessible, will use SYS_* views)")
        return RedshiftInstanceType.SERVERLESS


def _pgcode(error: BaseException) -> str | None:
    """The PostgreSQL SQLSTATE on the error or anywhere in its cause chain.

    The Redshift dialect rides on the psycopg2 driver, which exposes the SQLSTATE
    on ``.pgcode``; SQLAlchemy preserves the original DBAPI error at ``.orig``, so
    we check both across the chain. SQLSTATE is only populated for *query-execution*
    errors - a failed connection (bad password, missing database) raises before a
    session exists, so those carry no code and must be matched on message text.
    """
    for current in exception_chain(error):
        code = getattr(current, "pgcode", None)
        if code is None:
            code = getattr(getattr(current, "orig", None), "pgcode", None)
        if code is not None:
            return code
    return None


def _sqlstate(*codes: str) -> Matcher:
    """Match a PostgreSQL SQLSTATE - the stable signal for query-execution errors,
    where the message text varies by locale."""
    wanted = frozenset(codes)
    return lambda error: _pgcode(error) in wanted


def _message(error: BaseException) -> str:
    """The lower-cased text of the error and its cause chain."""
    return " ".join(str(current) for current in exception_chain(error)).lower()


def _database_not_found(error: BaseException) -> bool:
    """Redshift reports a missing database at connect time as
    ``FATAL: database "x" does not exist`` with no SQLSTATE. Match the quoted token
    ``database "`` so a query error whose embedded SQL mentions ``pg_database`` (or
    a missing relation) is not misread as a missing database."""
    text_ = _message(error)
    return 'database "' in text_ and "does not exist" in text_


# The GetQueries check raises a message carrying this token when the privilege
# probe reports a missing grant; the error pack matches on it. Shared here so the
# producer and the matcher cannot drift apart.
_QUERY_HISTORY_PRIVILEGE_TOKEN = "query-history views"


# Connect-phase failures (auth, missing database) carry no SQLSTATE, so they are
# matched on message text; query-phase failures are matched on the stable SQLSTATE
# psycopg2 surfaces on ``.pgcode``. Bad host / port raise before the driver and are
# caught by the TCP preflight in ``ping`` via NETWORK_ERRORS.
REDSHIFT_ERRORS = ErrorPack(
    when(Matchers.contains("password authentication failed")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the user is allowed to connect.",
    ),
    when(_sqlstate("28000", "28P01")).diagnose(  # invalid_authorization / invalid_password
        "Authentication failed",
        fix="Check the username and password, and that the user is allowed to connect.",
    ),
    when(_database_not_found).diagnose(
        "Database not found",
        fix="Verify the configured database exists and the user is allowed to connect to it.",
    ),
    # Raised by the GetQueries check when has_table_privilege reports the user lacks
    # SELECT on the query-history views; config-agnostic so it never names a view.
    when(Matchers.contains(_QUERY_HISTORY_PRIVILEGE_TOKEN)).diagnose(
        "Query history not accessible",
        fix="Grant the user SELECT on the Redshift query-history views (stl_* for Provisioned, "
        "sys_* for Serverless), or usage and lineage won't be collected.",
    ),
    when(_sqlstate("42501")).diagnose(  # insufficient_privilege
        "Insufficient privileges",
        fix="Grant the user SELECT on the objects the failing step reads.",
    ),
    # 42P01 (undefined_table) across the test steps can only come from the GetQueries
    # source probe - every other step reads catalogs that always exist - so it means
    # the query-history source view is missing, whatever it is named.
    when(_sqlstate("42P01")).diagnose(  # undefined_table
        "Query history source not found",
        fix="The Redshift query-history views are not available on this deployment. Verify the "
        "cluster type (Provisioned vs Serverless), or usage and lineage won't be collected.",
    ),
).including(NETWORK_ERRORS)


def _summarize_queries(instance_type: RedshiftInstanceType, rows: Sequence[Row]) -> str:
    """Confirm the privilege probe row reports SELECT on every query-history view.

    ``has_table_privilege`` returns a boolean per view rather than raising, so a
    missing grant surfaces as a ``False`` in the row, not an exception - raise here
    so the step fails and the error pack maps it to a privilege diagnosis.
    """
    row = rows[0] if rows else None
    if row is None or not all(row):
        family = "sys" if instance_type == RedshiftInstanceType.SERVERLESS else "stl"
        raise SourceConnectionException(
            f"Missing SELECT privilege on the Redshift {family} {_QUERY_HISTORY_PRIVILEGE_TOKEN} - {row}"
        )
    return "query history accessible"


def _summarize_databases(rows: Sequence[Row]) -> str:
    """``N databases reachable`` - suffixed ``+`` when the row sample is capped, so a
    cluster with more than ``DEFAULT_SAMPLE_ROWS`` databases is not reported as an
    exact total (``run_sql`` only fetches up to that many rows)."""
    suffix = "+" if len(rows) >= DEFAULT_SAMPLE_ROWS else ""
    return f"{len(rows)}{suffix} databases reachable"


class RedshiftChecks:
    """Test-connection checks for Amazon Redshift."""

    errors = REDSHIFT_ERRORS

    # The relations probe lists tables and views from any non-system schema; LIMIT 1
    # keeps it cheap since the step only proves the read is permitted.
    _RELATIONS_PROBE = REDSHIFT_GET_ALL_RELATIONS.format(schema_clause="", table_clause="", limit_clause="LIMIT 1")

    def __init__(self, client: Engine) -> None:
        self.client = client

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(self.client, REDSHIFT_GET_DATABASE_NAMES, _summarize_databases)

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return run_sql(self.client, self._RELATIONS_PROBE, lambda rows: f"{len(rows)} relations accessible")

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return run_sql(self.client, self._RELATIONS_PROBE, lambda rows: f"{len(rows)} relations accessible")

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        # Resolved here, not at construction, so the instance-type probe and the
        # privilege query run only after CheckAccess - never ahead of the gate.
        instance_type = get_redshift_instance_type(self.client)
        statement = REDSHIFT_TEST_GET_QUERIES_MAP[instance_type]
        try:
            evidence = run_sql(self.client, statement, lambda rows: _summarize_queries(instance_type, rows))
        except SourceConnectionException as missing_privilege:
            # The privilege probe raises from the summary callback, outside run_sql's
            # own CheckError wrapping - re-raise with the statement so the failed step
            # still reports the command it ran, like every other step.
            raise CheckError(missing_privilege, Evidence(command=statement)) from missing_privilege
        return evidence


class RedshiftConnection(BaseConnection[RedshiftConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_redshift_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        self._on_close(engine.dispose)
        return engine

    def checks(self) -> ChecksProvider:
        return RedshiftChecks(client=self.client)
