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

from copy import deepcopy
from typing import TYPE_CHECKING, Optional
from urllib.parse import quote_plus

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import (
    NotFound,
    PermissionDenied,
    ResourceDoesNotExist,
    Unauthenticated,
)
from databricks.sdk.service.catalog import TableType
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.core.connections.test_connection.network import (
    NETWORK_ERRORS,
    NetworkUnreachableError,
    tcp_probe,
)
from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection as UnityCatalogConnectionConfig,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.databricks.auth import (
    get_auth_config,
    normalize_host_port,
)
from metadata.ingestion.source.database.databricks.log_filters import (
    suppress_user_agent_entry_deprecation_log,
)
from metadata.ingestion.source.database.unitycatalog.models import DatabricksTable
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_GET_ALL_SCHEMA_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_TAGS,
    UNITY_CATALOG_GET_CATALOGS_TAGS,
    UNITY_CATALOG_TEST_COLUMN_LINEAGE,
    UNITY_CATALOG_TEST_TABLE_LINEAGE,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

suppress_user_agent_entry_deprecation_log()

INTERNAL_CATALOG = "__databricks_internal"
VIEW_TABLE_TYPES = {TableType.VIEW, TableType.MATERIALIZED_VIEW}
VIEW_LISTING_SCAN_LIMIT = 100
DEFAULT_UNITY_CATALOG_PORT = 443

UNITY_CATALOG_ERRORS = ErrorPack(
    when(Matchers.exception(Unauthenticated)).diagnose(
        "Authentication failed",
        fix="The workspace rejected the credentials. Verify the personal access token, OAuth "
        "client secret, or Azure AD credentials are valid and not expired.",
    ),
    when(Matchers.contains("invalid access token")).diagnose(
        "Authentication failed",
        fix="The workspace rejected the access token. Verify it is valid, not expired, and "
        "belongs to a user with access to this workspace.",
    ),
    when(Matchers.contains("token is expired")).diagnose(
        "Access token expired",
        fix="The access token has expired. Generate a new token and update the connection.",
    ),
    when(Matchers.exception(PermissionDenied)).diagnose(
        "Insufficient privileges",
        fix="Grant the connection's principal the privileges the failing step needs: USE CATALOG "
        "on the catalog, USE SCHEMA on the schema, and SELECT on its tables.",
    ),
    when(Matchers.contains("permission_denied")).diagnose(
        "Insufficient privileges",
        fix="Grant the connection's principal the privileges the failing step needs: USE CATALOG "
        "on the catalog, USE SCHEMA on the schema, and SELECT on its tables.",
    ),
    when(Matchers.contains("insufficient_permissions")).diagnose(
        "Insufficient privileges",
        fix="Grant the connection's principal the privileges the failing step needs: USE CATALOG "
        "on the catalog, USE SCHEMA on the schema, and SELECT on its tables.",
    ),
    when(Matchers.exception(ResourceDoesNotExist, NotFound)).diagnose(
        "Object not found",
        fix="The configured catalog or schema does not exist, or is not visible to the "
        "connection's principal. Verify the names and the USE CATALOG / USE SCHEMA grants.",
    ),
    when(Matchers.contains("no_such_catalog")).diagnose(
        "Catalog not found",
        fix="The configured catalog does not exist or is not visible. Verify the catalog name and "
        "that the principal has USE CATALOG on it.",
    ),
    when(Matchers.contains("no_such_schema")).diagnose(
        "Schema not found",
        fix="The configured schema does not exist or is not visible. Verify the schema name and "
        "that the principal has USE SCHEMA on it.",
    ),
    when(Matchers.contains("table_or_view_not_found")).diagnose(
        "Table or view not found",
        fix="The referenced table or view does not exist or is not visible. Verify the object "
        "exists and the principal has SELECT on it.",
    ),
    when(Matchers.contains("malformed_request")).diagnose(
        "Invalid HTTP path",
        fix="The HTTP Path is malformed. Copy it from the SQL warehouse (or cluster) Connection "
        "Details in Databricks - it must look like /sql/1.0/warehouses/<warehouseId>.",
    ),
    when(Matchers.contains("no valid connection settings")).diagnose(
        "SQL warehouse not configured",
        fix="The GetQueries and GetTags steps open a SQL connection, which needs an HTTP Path. Set "
        "it to a running SQL warehouse (/sql/1.0/warehouses/<warehouseId>). Metadata ingestion "
        "works without it, but query-log lineage and tag extraction do not.",
    ),
    when(Matchers.contains("failed to connect to the database")).diagnose(
        "SQL warehouse not reachable",
        fix="Could not open a SQL connection over the configured HTTP Path. Verify the SQL "
        "warehouse is running and the principal can use it, and that the HTTP Path is correct.",
    ),
    when(Matchers.contains("does not exist")).diagnose(
        "Object not found",
        fix="Verify the configured catalog, schema, and HTTP path exist and the connection's "
        "principal is authorized to use them.",
    ),
).including(NETWORK_ERRORS)


def _require_resolved_catalog_and_schema(table_obj: DatabricksTable) -> tuple[str, str]:
    """
    Fail the test connection step loudly when the previous steps could not
    resolve a catalog and schema, instead of silently passing.
    """
    if not (table_obj.catalog_name and table_obj.schema_name):
        raise SourceConnectionException(
            f"Could not resolve a catalog (got: {table_obj.catalog_name}) and schema "
            f"(got: {table_obj.schema_name}) from the previous steps. Validate that the configured "
            "catalog and schema exist and that the user has `USE CATALOG` and `USE SCHEMA` privileges on them."
        )
    return table_obj.catalog_name, table_obj.schema_name


def get_catalogs(connection: WorkspaceClient, table_obj: DatabricksTable, catalog_name: Optional[str] = None) -> None:  # noqa: UP045
    """
    Resolve the catalog used by the remaining test connection steps. If a catalog is
    configured on the connection, validate access to that exact catalog.
    """
    if catalog_name:
        table_obj.catalog_name = connection.catalogs.get(catalog_name).name
    else:
        for catalog in connection.catalogs.list():
            if catalog.name != INTERNAL_CATALOG:
                table_obj.catalog_name = catalog.name
                break


def get_schemas(connection: WorkspaceClient, table_obj: DatabricksTable, schema_name: Optional[str] = None) -> None:  # noqa: UP045
    """
    Resolve the schema used by the remaining test connection steps. If a databaseSchema is
    configured on the connection, validate access to that exact schema.
    """
    if not table_obj.catalog_name:
        raise SourceConnectionException(
            "Could not resolve a catalog from the previous steps. Validate that the user "
            "has `USE CATALOG` privilege on at least one catalog."
        )
    if schema_name:
        table_obj.schema_name = connection.schemas.get(f"{table_obj.catalog_name}.{schema_name}").name
    else:
        for schema in connection.schemas.list(catalog_name=table_obj.catalog_name):
            if schema.name:
                table_obj.schema_name = schema.name
                break


def get_tables(connection: WorkspaceClient, table_obj: DatabricksTable) -> None:
    """
    Validate that tables can be listed from the resolved catalog and schema.
    """
    catalog_name, schema_name = _require_resolved_catalog_and_schema(table_obj)
    for table in connection.tables.list(catalog_name=catalog_name, schema_name=schema_name, max_results=1):
        table_obj.name = table.name
        break


def get_views(connection: WorkspaceClient, table_obj: DatabricksTable) -> None:
    """
    Validate that views can be listed from the resolved catalog and schema.

    Scan at most VIEW_LISTING_SCAN_LIMIT objects: the goal is to confirm the listing
    call works and exposes view types, not to enumerate every object. A schema with no
    views would otherwise force a full paginated scan that could trip the overall
    test-connection timeout on large schemas.
    """
    catalog_name, schema_name = _require_resolved_catalog_and_schema(table_obj)
    listed_tables = connection.tables.list(
        catalog_name=catalog_name,
        schema_name=schema_name,
        max_results=VIEW_LISTING_SCAN_LIMIT,
        omit_columns=True,
        omit_properties=True,
    )
    for scanned, table in enumerate(listed_tables, start=1):
        if table.table_type in VIEW_TABLE_TYPES or scanned >= VIEW_LISTING_SCAN_LIMIT:
            break


def read_tag_tables(engine: Engine, table_obj: DatabricksTable) -> None:
    """
    Validate that the information_schema tag tables are readable for the resolved
    catalog and schema.
    """
    with engine.connect() as connection:
        connection.execute(
            text(UNITY_CATALOG_GET_CATALOGS_TAGS.format(database=table_obj.catalog_name).replace(";", " limit 1;"))
        )
        connection.execute(
            text(UNITY_CATALOG_GET_ALL_SCHEMA_TAGS.format(database=table_obj.catalog_name).replace(";", " limit 1;"))
        )
        connection.execute(
            text(
                UNITY_CATALOG_GET_ALL_TABLE_TAGS.format(
                    database=table_obj.catalog_name, schema=table_obj.schema_name
                ).replace(";", " limit 1;")
            )
        )
        connection.execute(
            text(
                UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS.format(
                    database=table_obj.catalog_name, schema=table_obj.schema_name
                ).replace(";", " limit 1;")
            )
        )


def read_lineage_tables(engine: Engine) -> None:
    """
    Validate that the system.access lineage tables are readable.
    """
    with engine.connect() as conn:
        conn.execute(text(UNITY_CATALOG_TEST_TABLE_LINEAGE)).fetchone()
        conn.execute(text(UNITY_CATALOG_TEST_COLUMN_LINEAGE)).fetchone()


def get_connection_url(connection: UnityCatalogConnectionConfig) -> str:
    url = f"{connection.scheme.value}://{normalize_host_port(connection.hostPort)}"
    if connection.catalog:
        url = f"{url}?catalog={quote_plus(connection.catalog)}"
    return url


def get_connection(connection: UnityCatalogConnectionConfig) -> WorkspaceClient:
    """
    Create connection
    """
    client_params = {}
    if isinstance(connection.authType, PersonalAccessToken):
        client_params["token"] = connection.authType.token.get_secret_value()
    elif isinstance(connection.authType, DatabricksOauth):
        client_params["client_id"] = connection.authType.clientId
        client_params["client_secret"] = connection.authType.clientSecret.get_secret_value()
    elif isinstance(connection.authType, AzureAdSetup):
        client_params["azure_client_id"] = connection.authType.azureClientId
        client_params["azure_client_secret"] = connection.authType.azureClientSecret.get_secret_value()
        client_params["azure_tenant_id"] = connection.authType.azureTenantId

    return WorkspaceClient(host=normalize_host_port(connection.hostPort), **client_params)


def get_sqlalchemy_connection(connection: UnityCatalogConnectionConfig) -> Engine:
    """
    Create sqlalchemy connection
    """

    if not connection.connectionArguments:
        connection.connectionArguments = init_empty_connection_arguments()

    if connection.httpPath:
        connection.connectionArguments.root["http_path"] = connection.httpPath

    auth_args = get_auth_config(connection)

    original_connection_arguments = connection.connectionArguments
    connection.connectionArguments = deepcopy(original_connection_arguments)
    connection.connectionArguments.root.update(auth_args)

    engine = create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )
    connection.connectionArguments = original_connection_arguments
    return engine


class UnityCatalogChecks:
    """Test-connection checks for Unity Catalog.

    Catalog, schema and table steps borrow the workspace client; lineage and tag
    steps borrow the SQL-warehouse Engine. Each is built on first read, in a check.
    """

    errors = UNITY_CATALOG_ERRORS

    def __init__(
        self,
        workspace: Borrowed[WorkspaceClient],
        sql: Borrowed[Engine],
        service_connection: UnityCatalogConnectionConfig,
    ) -> None:
        self._workspace = workspace
        self._sql = sql
        self.service_connection = service_connection
        self.table_obj = DatabricksTable()

    def _probe_target(self) -> tuple[str, int]:
        # Same normalization the client uses, so the probe targets the host it connects to.
        host_port = normalize_host_port(self.service_connection.hostPort)
        host, _, port = host_port.rpartition(":")
        if host and port.isdigit():
            return host, int(port)
        return host_port, DEFAULT_UNITY_CATALOG_PORT

    @staticmethod
    def _probe(operation: Callable[[], None], command: str, summarize: Callable[[], str]) -> Evidence:
        """Run a listing helper, reporting the command it attempted; on failure
        re-raise as ``CheckError`` so the failed step still carries that command."""
        try:
            operation()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(summary=summarize(), command=command)

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        host, port = self._probe_target()
        try:
            tcp_probe(host, port)
        except NetworkUnreachableError as error:
            raise CheckError(error, Evidence(command=f"TCP connect {host}:{port}")) from error
        return self._probe(self._list_first_catalog, "catalogs.list()", lambda: "connection established")

    def _list_first_catalog(self) -> None:
        """Prove the workspace answers an authenticated call, without paging every catalog."""
        next(iter(self._workspace.client.catalogs.list()), None)

    @check(DatabaseStep.GetDatabases)
    def check_databases(self) -> Evidence:
        configured = self.service_connection.catalog
        return self._probe(
            lambda: get_catalogs(self._workspace.client, self.table_obj, configured),
            f"catalogs.get({configured!r})" if configured else "catalogs.list()",
            lambda: f"catalog '{self.table_obj.catalog_name}' resolved",
        )

    @check(DatabaseStep.GetSchemas)
    def check_schemas(self) -> Evidence:
        configured = self.service_connection.databaseSchema
        return self._probe(
            lambda: get_schemas(self._workspace.client, self.table_obj, configured),
            f"schemas.get({configured!r})" if configured else "schemas.list()",
            lambda: f"schema '{self.table_obj.schema_name}' resolved",
        )

    @check(DatabaseStep.GetTables)
    def check_tables(self) -> Evidence:
        return self._probe(
            lambda: get_tables(self._workspace.client, self.table_obj),
            "tables.list()",
            lambda: f"tables enumerated in '{self.table_obj.catalog_name}.{self.table_obj.schema_name}'",
        )

    @check(DatabaseStep.GetViews)
    def check_views(self) -> Evidence:
        return self._probe(
            lambda: get_views(self._workspace.client, self.table_obj),
            "tables.list(omit_columns=True)",
            lambda: f"views enumerated in '{self.table_obj.catalog_name}.{self.table_obj.schema_name}'",
        )

    @check(DatabaseStep.GetQueries)
    def check_queries(self) -> Evidence:
        return self._probe(
            lambda: read_lineage_tables(self._sql.client),
            "SELECT COUNT(*) FROM system.access.table_lineage; SELECT COUNT(*) FROM system.access.column_lineage",
            lambda: "lineage tables accessible",
        )

    @check(DatabaseStep.GetTags)
    def check_tags(self) -> Evidence:
        return self._probe(
            lambda: read_tag_tables(self._sql.client, self.table_obj),
            "SELECT * FROM information_schema.{catalog_tags,schema_tags,table_tags,column_tags} LIMIT 1",
            lambda: "tag tables accessible",
        )


class UnityCatalogSqlConnection(BaseConnection[UnityCatalogConnectionConfig, Engine]):
    """Owns the SQL-warehouse Engine: a separate lifetime from the workspace client,
    reached only by the lineage and tag steps and never built without an httpPath."""

    def _get_client(self) -> Engine:
        engine = get_sqlalchemy_connection(self.service_connection)
        self._on_close(engine.dispose)
        return engine


class UnityCatalogConnection(BaseConnection[UnityCatalogConnectionConfig, WorkspaceClient]):
    def __init__(self, service_connection: UnityCatalogConnectionConfig) -> None:
        super().__init__(service_connection)
        # Honor the user-facing connectionTimeout as the per-step budget; a cold
        # serverless warehouse can exceed the framework default.
        self.step_timeout_seconds = service_connection.connectionTimeout or STEP_TIMEOUT_SECONDS
        # A sub-owner, not a client: constructing it opens nothing.
        self.sql = UnityCatalogSqlConnection(service_connection)

    def _get_client(self) -> WorkspaceClient:
        return get_connection(self.service_connection)

    def close(self) -> None:
        # Not _on_close: that registry is reset by close(), so a sub-owner
        # registered once would not be released on a later reuse cycle.
        self.sql.close()
        super().close()

    def checks(self) -> ChecksProvider:
        return UnityCatalogChecks(
            workspace=self.borrow(),
            sql=self.sql.borrow(),
            service_connection=self.service_connection,
        )
