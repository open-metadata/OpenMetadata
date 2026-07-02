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

from typing import TYPE_CHECKING, Any, Optional
from urllib.parse import quote_plus

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

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
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import (
    NETWORK_ERRORS,
    NetworkUnreachableError,
    tcp_probe,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection as SnowflakeConnectionConfig,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.models.custom_pydantic import _CustomSecretStr
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_ACCESS_HISTORY_PROBE,
    SNOWFLAKE_GET_DATABASES,
    SNOWFLAKE_TEST_FETCH_TAG,
    SNOWFLAKE_TEST_GET_QUERIES,
    SNOWFLAKE_TEST_GET_STREAMS,
    SNOWFLAKE_TEST_GET_TABLES,
    SNOWFLAKE_TEST_GET_VIEWS,
)
from metadata.utils.credentials import normalize_pem_string
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.engine import Row

    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

logger = ingestion_logger()

# Default value of the ``accountUsageSchema`` connection field, used to key the
# account_usage-denial diagnosis when no custom schema is configured.
DEFAULT_ACCOUNT_USAGE_SCHEMA = "SNOWFLAKE.ACCOUNT_USAGE"

# The Snowflake driver connects to ``<account>.snowflakecomputing.com:443``; the
# SQLAlchemy URL only carries the bare account as its host, so the shared TCP
# preflight in ``ping`` cannot run (no port). CheckAccess folds in an explicit
# probe to this host:port instead.
SNOWFLAKE_HOST_SUFFIX = ".snowflakecomputing.com"
SNOWFLAKE_PORT = 443


class SnowflakeEngineWrapper(BaseModel):
    service_connection: SnowflakeConnectionConfig
    engine: Any
    database_name: Optional[str] = None  # noqa: UP045


def _init_database(engine_wrapper: SnowflakeEngineWrapper):
    """
    Initialize database
    """
    if not engine_wrapper.service_connection.database:
        if not engine_wrapper.database_name:
            with engine_wrapper.engine.connect() as conn:
                databases = conn.execute(text(SNOWFLAKE_GET_DATABASES)).all()
            for database in databases:
                if filter_by_database(
                    engine_wrapper.service_connection.databaseFilterPattern,
                    database.name,
                ):
                    continue

                engine_wrapper.database_name = database.name
                break
    else:
        engine_wrapper.database_name = engine_wrapper.service_connection.database


def execute_inspector_func(engine_wrapper: SnowflakeEngineWrapper, func_name: str):
    """
    Method to test connection via inspector functions,
    this function creates the inspector object and fetches
    the function with name `func_name` and executes it
    """
    _init_database(engine_wrapper)
    with engine_wrapper.engine.connect() as conn:
        conn.execute(text(f'USE DATABASE "{engine_wrapper.database_name}"'))
        inspector = inspect(conn)
        inspector_fn = getattr(inspector, func_name)
        inspector_fn()


def probe_access_history_available(engine: Engine, account_usage_schema: str) -> bool:
    """
    Check whether the configured Snowflake role can read ACCOUNT_USAGE.ACCESS_HISTORY.

    Required for the ACCESS_HISTORY-based lineage path. Standard Edition accounts
    or roles without `IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE` will fail this
    probe and the caller should fall back to the legacy parser path.

    Logs failures at INFO (not WARNING) — Standard Edition is a legitimate state.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text(SNOWFLAKE_ACCESS_HISTORY_PROBE.format(account_usage=account_usage_schema)))
    except Exception as exc:
        logger.info(
            f"ACCESS_HISTORY probe failed (will fall back to legacy lineage path): {exc}. "
            f"Ensure the role has IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE and the account is Enterprise+."
        )
        return False
    return True


def _sf_errno(*codes: int) -> Matcher:
    """Match a Snowflake driver error number.

    Unlike PyMySQL (which puts the code in ``args[0]``), the snowflake connector
    carries it on the exception's ``.errno`` attribute, with the original DBAPI
    error preserved by SQLAlchemy at ``.orig``. We walk both across the cause
    chain. Codes are the stable signal - message text varies."""
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        result = False
        for current in exception_chain(error):
            for candidate in (current, getattr(current, "orig", None)):
                code = getattr(candidate, "errno", None)
                if isinstance(code, int) and code in wanted:
                    result = True
        return result

    return match


def _message(error: BaseException) -> str:
    """The lower-cased text of the error and its cause chain."""
    return " ".join(str(current) for current in exception_chain(error)).lower()


def _account_usage_denied(account_usage_schema: str | None) -> Matcher:
    """Match a privilege/visibility failure on the ACCOUNT_USAGE share
    (query_history, access_history, tag_references) rather than a generic missing
    object.

    Keys on the *configured* ``accountUsageSchema`` token (default
    ``SNOWFLAKE.ACCOUNT_USAGE``) plus an access-denial marker, so the rule holds
    for any value the schema is set to - not just the default one."""
    token = (account_usage_schema or DEFAULT_ACCOUNT_USAGE_SCHEMA).lower()

    def match(error: BaseException) -> bool:
        text_chain = _message(error)
        return token in text_chain and ("not authorized" in text_chain or "does not exist" in text_chain)

    return match


def _snowflake_errors(account_usage_schema: str | None) -> ErrorPack:
    """Build the Snowflake error pack, baking the configured ACCOUNT_USAGE schema
    into the account_usage-denial rule.

    Rule order matters (first match wins). The connect-phase errno 250001 is
    overloaded - a bad password, a missing role, and an MFA requirement all raise
    it - so the specific message-token rules (MFA, role) are placed BEFORE the
    250001 catch-all. Errnos and tokens below were confirmed against a live
    Snowflake account. Bad host / port on a custom endpoint raise before the
    driver and are caught by the TCP preflight in CheckAccess via NETWORK_ERRORS;
    a wrong *account* is not - Snowflake's wildcard DNS resolves any
    ``<account>.snowflakecomputing.com`` and accepts TCP on 443, so it is only
    rejected at the HTTP login layer (errno 290404), handled here."""
    return ErrorPack(
        when(_sf_errno(290404)).diagnose(
            "Snowflake account not found",
            fix="Check the account identifier - the login endpoint returned 404. Use the account "
            "from your Snowflake URL (e.g. <org>-<account> or <locator>.<region>.<cloud>).",
        ),
        when(Matchers.contains("multi-factor authentication")).diagnose(
            "Multi-factor authentication required",
            fix="This user requires MFA, which blocks password login for ingestion. Use key-pair "
            "authentication or a Programmatic Access Token instead of a password.",
        ),
        when(Matchers.contains("is not granted to this user")).diagnose(
            "Role not granted",
            fix="Grant the configured role to the user, or set a role the user already has "
            "(e.g. PUBLIC), so the connection can assume it.",
        ),
        when(_sf_errno(250001)).diagnose(
            "Authentication failed",
            fix="Check the username and password (or private key) and that the user is allowed to connect.",
        ),
        when(Matchers.contains("incorrect username or password")).diagnose(
            "Authentication failed",
            fix="Check the username and password (or private key) and that the user is allowed to connect.",
        ),
        when(_account_usage_denied(account_usage_schema)).diagnose(
            "Account usage not accessible",
            fix="Grant the role IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE (or SELECT on the "
            "snowflake.account_usage views) so query history, tags, and lineage can be read; "
            "otherwise usage and lineage won't be collected.",
        ),
        when(Matchers.contains("insufficient privileges")).diagnose(
            "Insufficient privileges",
            fix="Grant the role the privileges the failing step needs (USAGE on the database/schema "
            "and SELECT on its objects).",
        ),
        when(_sf_errno(3001)).diagnose(
            "Insufficient privileges",
            fix="Grant the role the privileges the failing step needs (USAGE on the database/schema "
            "and SELECT on its objects).",
        ),
        when(_sf_errno(2003, 2043)).diagnose(
            "Object not found",
            fix="Verify the configured database, schema, warehouse, and role exist and the role is "
            "authorized to use them.",
        ),
        when(Matchers.contains("object does not exist")).diagnose(
            "Object not found",
            fix="Verify the configured database, schema, warehouse, and role exist and the role is "
            "authorized to use them.",
        ),
        when(Matchers.contains("does not exist or not authorized")).diagnose(
            "Object not found",
            fix="Verify the configured database, schema, warehouse, and role exist and the role is "
            "authorized to use them.",
        ),
        when(Matchers.contains("no active warehouse")).diagnose(
            "No active warehouse",
            fix="Set a valid warehouse on the connection - verify the name, since a missing, "
            "misspelled, or inaccessible warehouse all fail here - and ensure the role has USAGE "
            "on it, so queries have compute to run on.",
        ),
    ).including(NETWORK_ERRORS)


# Default pack, keyed on the default ACCOUNT_USAGE schema. Each connection builds
# its own from the configured ``accountUsageSchema`` (see ``SnowflakeChecks``).
SNOWFLAKE_ERRORS = _snowflake_errors(DEFAULT_ACCOUNT_USAGE_SCHEMA)


def _summarize_databases(rows: Sequence[Row]) -> str:
    """``N databases enumerated``, with a trailing ``+`` when the probe hit the
    row cap so the figure is not read as an exact total."""
    suffix = "+" if len(rows) >= DEFAULT_SAMPLE_ROWS else ""
    return f"{len(rows)}{suffix} databases enumerated"


def _summarize_tables(rows: Sequence[Row]) -> str:
    """``N tables enumerated`` (``N+`` at the row cap), or ``no tables enumerated``
    when the database exposes none to the role.

    The probe excludes INFORMATION_SCHEMA (its views are always present regardless
    of grants), so an empty result is a real signal - the connection works but
    there is nothing to ingest. Surfacing that as a Warning caveat depends on the
    shared ``Evidence`` caveat support; until then it is reported in the summary."""
    if not rows:
        return "no tables enumerated"
    suffix = "+" if len(rows) >= DEFAULT_SAMPLE_ROWS else ""
    return f"{len(rows)}{suffix} tables enumerated"


def _snowflake_host(account: str) -> str:
    """The host the driver dials: the account with the Snowflake domain appended
    unless it is already a fully-qualified host."""
    if account.endswith(SNOWFLAKE_HOST_SUFFIX):
        return account
    return f"{account}{SNOWFLAKE_HOST_SUFFIX}"


class SnowflakeChecks:
    """Test-connection checks for Snowflake.

    The table/view/stream probes run custom queries (not the default inspector,
    whose ``SHOW`` is capped at 10000 rows - issue #12798), scoped to a database
    resolved lazily through ``SnowflakeEngineWrapper`` so no network call happens
    before the gate.
    """

    def __init__(self, client: Engine, service_connection: SnowflakeConnectionConfig) -> None:
        self.client = client
        self.service_connection = service_connection
        self.errors = _snowflake_errors(service_connection.accountUsageSchema)
        self._engine_wrapper = SnowflakeEngineWrapper(
            service_connection=service_connection,
            engine=client,
            database_name=None,
        )

    def _database(self) -> str | None:
        """Resolve (and cache) the database to probe. Runs ``SHOW DATABASES`` only
        when none is configured; called from a check, never at construction."""
        _init_database(self._engine_wrapper)
        return self._engine_wrapper.database_name

    def _probe_host(self) -> str | None:
        """The host the driver will actually dial. An explicit ``host`` in
        connectionArguments (a proxy, load balancer, or PrivateLink endpoint) wins
        over the synthesized account host, so the gate's reachability probe targets
        the real endpoint instead of a public host that may be unreachable. ``None``
        when neither is set, which skips the preflight."""
        arguments = self.service_connection.connectionArguments
        overrides = arguments.root if arguments else None
        host = overrides.get("host") if overrides else None
        if host:
            result = str(host)
        elif self.service_connection.account:
            result = _snowflake_host(self.service_connection.account)
        else:
            result = None
        return result

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        host = self._probe_host()
        if host:
            try:
                tcp_probe(host, SNOWFLAKE_PORT)
            except NetworkUnreachableError as error:
                raise CheckError(error, Evidence(command=f"TCP connect {host}:{SNOWFLAKE_PORT}")) from error
        return ping(self.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(self.client, SNOWFLAKE_GET_DATABASES, _summarize_databases)

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        execute_inspector_func(self._engine_wrapper, "get_schema_names")
        return Evidence(summary="schemas accessible")

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        statement = SNOWFLAKE_TEST_GET_TABLES.format(database_name=self._database())
        return run_sql(self.client, statement, _summarize_tables)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        statement = SNOWFLAKE_TEST_GET_VIEWS.format(database_name=self._database())
        return run_sql(self.client, statement, lambda _: "views accessible")

    @check(DatabaseStep.GetStreams)
    def get_streams(self) -> Evidence:
        statement = SNOWFLAKE_TEST_GET_STREAMS.format(database_name=self._database())
        return run_sql(self.client, statement, lambda _: "streams accessible")

    @check(DatabaseStep.GetTags)
    def get_tags(self) -> Evidence:
        statement = SNOWFLAKE_TEST_FETCH_TAG.format(account_usage=self.service_connection.accountUsageSchema)
        return run_sql(self.client, statement, lambda _: "tags accessible")

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        statement = SNOWFLAKE_TEST_GET_QUERIES.format(account_usage=self.service_connection.accountUsageSchema)
        return run_sql(self.client, statement, lambda _: "query history accessible")

    @check(DatabaseStep.GetAccessHistory)
    def get_access_history(self) -> Evidence:
        statement = SNOWFLAKE_ACCESS_HISTORY_PROBE.format(account_usage=self.service_connection.accountUsageSchema)
        return run_sql(self.client, statement, lambda _: "access history accessible")


class SnowflakeConnection(BaseConnection[SnowflakeConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Snowflake.
        """
        engine = self.get_connection()
        self._on_close(engine.dispose)
        return engine

    @staticmethod
    def get_connection_url(connection: SnowflakeConnectionConfig) -> str:
        """
        Set the connection URL
        """

        url = f"{connection.scheme.value}://"

        if connection.username:
            url += f"{quote_plus(connection.username)}"
            if not connection.password:
                connection.password = _CustomSecretStr("")
            url += f":{quote_plus(connection.password.get_secret_value())}" if connection else ""
            url += "@"

        url += connection.account
        url += f"/{connection.database}" if connection.database else ""

        options = get_connection_options_dict(connection)
        if options:
            if not connection.database:
                url += "/"
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            url = f"{url}?{params}"
        options = {
            "account": connection.account,
            "warehouse": connection.warehouse,
            "role": connection.role,
        }
        params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
        if params:
            url = f"{url}?{params}"
        return url

    def _get_private_key(self, encoding: serialization.Encoding = serialization.Encoding.DER) -> Optional[bytes]:  # noqa: UP045
        connection = self.service_connection
        if connection.privateKey:
            snowflake_private_key_passphrase = (
                connection.snowflakePrivatekeyPassphrase.get_secret_value()
                if connection.snowflakePrivatekeyPassphrase
                else ""
            )

            if not snowflake_private_key_passphrase:
                logger.warning("Snowflake Private Key Passphrase not found, replacing it with empty string")

            encrypted_private_key = normalize_pem_string(connection.privateKey.get_secret_value())

            p_key = serialization.load_pem_private_key(
                bytes(
                    encrypted_private_key,
                    "utf-8",
                ),
                password=snowflake_private_key_passphrase.encode() or None,
                backend=default_backend(),
            )
            pkb = p_key.private_bytes(
                encoding=encoding,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            return pkb  # noqa: RET504
        return None

    def _get_client_session_keep_alive(self) -> Optional[bool]:  # noqa: UP045
        connection = self.service_connection
        if connection.clientSessionKeepAlive:
            return connection.clientSessionKeepAlive
        return None

    def get_connection(self) -> Engine:
        """
        Create connection
        """
        connection = self.service_connection
        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()

        if private_key := self._get_private_key():
            connection.connectionArguments.root["private_key"] = private_key

        if keep_alive := self._get_client_session_keep_alive():
            connection.connectionArguments.root["client_session_keep_alive"] = keep_alive

        # Bound the Snowflake socket so a silently-severed TCP connection
        # (NAT/LB idle reaping in K8s/hybrid runners) surfaces as a network
        # error within 10 minutes instead of hanging the worker indefinitely.
        # User-supplied connectionArguments win via setdefault.
        if connection.connectionArguments.root is not None:
            connection.connectionArguments.root.setdefault("network_timeout", 600)

        engine = create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        if connection.connectionArguments.root and connection.connectionArguments.root.get("private_key"):
            del connection.connectionArguments.root["private_key"]
        return engine

    def checks(self) -> ChecksProvider:
        return SnowflakeChecks(
            client=self.client,
            service_connection=self.service_connection,
        )
