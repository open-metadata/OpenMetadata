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
    run_sql,
)
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.core.connections.test_connection.network import (
    NETWORK_ERRORS,
    probe_or_fail,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection as DatabricksConnectionConfig,
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
    catalog_url,
    get_auth_config,
    probe_target,
)
from metadata.ingestion.source.database.databricks.client import DatabricksClient
from metadata.ingestion.source.database.databricks.log_filters import (
    suppress_user_agent_entry_deprecation_log,
)
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_CATALOGS,
    DATABRICKS_SQL_STATEMENT_TEST,
    TEST_CATALOG_TAGS,
    TEST_COLUMN_LINEAGE,
    TEST_COLUMN_TAGS,
    TEST_SCHEMA_TAGS,
    TEST_TABLE_LINEAGE,
    TEST_TABLE_TAGS,
    TEST_VIEW_DEFINITIONS,
)
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

logger = ingestion_logger()

suppress_user_agent_entry_deprecation_log()

DEFAULT_CATALOG = "main"

SYSTEM_SCHEMAS = frozenset({"information_schema", "performance_schema", "sys"})


# The listing checks raise a message carrying this token when no catalog/schema was
# resolved; the pack matches on it. Shared so producer and matcher cannot drift.
UNRESOLVED_TARGET_TOKEN = "Could not resolve a catalog and schema"


# databricks-sql/thrift reports failures as message tokens, not numeric codes, so
# rules key on tokens; specific ones precede broad ones (first match wins).
DATABRICKS_ERRORS = ErrorPack(
    when(Matchers.contains(UNRESOLVED_TARGET_TOKEN)).diagnose(
        "Could not resolve a catalog and schema to probe",
        fix="The earlier steps found no catalog/schema this user can use. Verify the configured "
        "catalog and schema exist and that the user has USE CATALOG and USE SCHEMA on them.",
    ),
    when(Matchers.contains("invalid access token")).diagnose(
        "Authentication failed",
        fix="Check the access token - the workspace rejected it. Verify the token is valid, "
        "not expired, and belongs to a user with access to this workspace.",
    ),
    when(Matchers.contains("token is expired")).diagnose(
        "Access token expired",
        fix="The access token has expired. Generate a new token and update the connection.",
    ),
    # No 403 rule: databricks-sql keeps the status in error.context["http-code"] and
    # Error.__str__ returns only self.message (databricks/sql/exc.py), so no status
    # reaches the text; "Forbidden" appears nowhere in the driver (4.2.6).
    when(Matchers.contains("malformed_request")).diagnose(
        "Invalid HTTP path",
        fix="The HTTP Path is malformed. Copy it from the SQL warehouse (or cluster) Connection "
        "Details in Databricks - it must look like /sql/1.0/warehouses/<warehouseId> or "
        "/sql/1.0/endpoints/<endpointId>.",
    ),
    when(Matchers.contains("no_such_catalog")).diagnose(
        "Catalog not found",
        fix="The configured catalog does not exist or is not visible to the token's user. Verify "
        "the catalog name and that the user has USE CATALOG on it.",
    ),
    when(Matchers.contains("no_such_schema")).diagnose(
        "Schema not found",
        fix="The configured schema does not exist or is not visible. Verify the schema name and "
        "that the user has USE SCHEMA on it.",
    ),
    when(Matchers.contains("table_or_view_not_found")).diagnose(
        "Table or view not found",
        fix="The referenced table or view does not exist or is not visible to the token's user. "
        "Verify the object exists and the user has SELECT on it.",
    ),
    when(Matchers.contains("schema_not_found")).diagnose(
        "Schema not found",
        fix="The referenced schema does not exist or is not visible. Verify the schema name and "
        "that the user has USAGE on it.",
    ),
    when(
        Matchers.any_of(
            Matchers.contains("permission_denied"),
            Matchers.contains("insufficient_permissions"),
        )
    ).diagnose(
        "Insufficient privileges",
        fix="Grant the token's user the privileges the failing step needs (USAGE on the catalog / "
        "schema and SELECT on the system or information_schema tables it reads).",
    ),
    when(Matchers.contains("does not exist")).diagnose(
        "Object not found",
        fix="Verify the configured catalog, schema, and HTTP path exist and the token's user is "
        "authorized to use them.",
    ),
).including(NETWORK_ERRORS)


class DatabricksEngineWrapper:
    """Wraps the borrowed engine, caching the resolved catalog and schema. Lookups
    are lazy, so constructing it touches no network and stays behind the gate."""

    def __init__(self, db: Borrowed[Engine]):
        self._db = db
        self._inspector = None
        self.schemas = None
        self.first_schema = None
        self.first_catalog = None

    @property
    def engine(self) -> Engine:
        return self._db.client

    @property
    def inspector(self):
        # Lazy, never at construction: inspect(engine) connects eagerly (the
        # dialect's _init_engine runs engine.connect().close()), which would
        # bypass the CheckAccess gate.
        if self._inspector is None:
            self._inspector = inspect(self.engine)
        return self._inspector

    def get_schemas(self, schema_name: Optional[str] = None):  # noqa: UP045
        """Get schemas and cache them"""
        if schema_name is not None:
            if self.first_catalog:
                with self.engine.connect() as connection:
                    connection.execute(text(f"USE CATALOG `{self.first_catalog}`"))
            self.first_schema = schema_name
            return [schema_name]
        if self.schemas is None:
            # Bound the reflected list (no driver-side cap) to the sample size.
            self.schemas = self.inspector.get_schema_names(database=self.first_catalog)[:DEFAULT_SAMPLE_ROWS]
            if self.schemas:
                for schema in self.schemas:
                    if schema.lower() not in SYSTEM_SCHEMAS:
                        self.first_schema = schema
                        break
                if self.first_schema is None and self.schemas:
                    self.first_schema = self.schemas[0]
        return self.schemas

    def _require_resolved_catalog_and_schema(self) -> tuple[str, str]:
        """Fail loudly when the earlier steps resolved no catalog or schema.

        Returning an empty list would be indistinguishable from "the schema is
        genuinely empty", so a mandatory step would pass having proved nothing.
        """
        if not (self.first_catalog and self.first_schema):
            raise SourceConnectionException(
                f"{UNRESOLVED_TARGET_TOKEN}: catalog={self.first_catalog}, schema={self.first_schema}"
            )
        return self.first_catalog, self.first_schema

    def get_tables(self):
        """Get tables using the cached first schema"""
        if self.first_schema is None:
            self.get_schemas()
        catalog, schema = self._require_resolved_catalog_and_schema()
        with self.engine.connect() as connection:
            tables = connection.execute(text(f"SHOW TABLES IN `{catalog}`.`{schema}`"))
            return tables.fetchmany(DEFAULT_SAMPLE_ROWS)

    def get_views(self):
        """Get views using the cached first schema"""
        if self.first_schema is None:
            self.get_schemas()
        catalog, schema = self._require_resolved_catalog_and_schema()
        with self.engine.connect() as connection:
            views = connection.execute(text(f"SHOW VIEWS IN `{catalog}`.`{schema}`"))
            return views.fetchmany(DEFAULT_SAMPLE_ROWS)

    def get_catalogs(self, catalog_name: Optional[str] = None):  # noqa: UP045
        """Get catalogs"""
        if catalog_name is not None:
            self.first_catalog = catalog_name
            return [catalog_name]
        with self.engine.connect() as connection:
            catalogs = connection.execute(text(DATABRICKS_GET_CATALOGS)).fetchmany(DEFAULT_SAMPLE_ROWS)
        for catalog in catalogs:
            if catalog[0] != "__databricks_internal":
                self.first_catalog = catalog[0]
                break
        return catalogs


def get_connection_url(connection: DatabricksConnectionConfig) -> str:
    return catalog_url(connection.scheme, connection.hostPort, connection.catalog)


def get_connection(connection: DatabricksConnectionConfig) -> Engine:
    """
    Create connection
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


class DatabricksChecks:
    """Test-connection checks for Databricks. Catalog/schema listing goes through
    ``DatabricksEngineWrapper``; every statement is built inside its ``@check`` so
    nothing connects before the gate."""

    errors = DATABRICKS_ERRORS

    def __init__(self, db: Borrowed[Engine], service_connection: DatabricksConnectionConfig) -> None:
        self._db = db
        self.service_connection = service_connection
        self._engine_wrapper = DatabricksEngineWrapper(db)

    def _first_catalog(self) -> str:
        """Resolve and cache the catalog to scope tag probes to."""
        if self._engine_wrapper.first_catalog is None:
            self._engine_wrapper.get_catalogs(catalog_name=self.service_connection.catalog)
        return self._engine_wrapper.first_catalog or self.service_connection.catalog or DEFAULT_CATALOG

    def _probe_target(self) -> tuple[str, int]:
        return probe_target(self.service_connection.hostPort)

    def _list(self, operation: Callable[[], Sequence[object] | None], command: str | None, noun: str) -> Evidence:
        """Run a wrapper listing op, reporting the command and a row-count summary;
        on failure re-raise as ``CheckError`` carrying the attempted command."""
        try:
            rows = operation()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        rows = list(rows) if rows is not None else []
        return Evidence(summary=enumerated(len(rows), noun, DEFAULT_SAMPLE_ROWS), command=command)

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        probe_or_fail(*self._probe_target())
        return run_sql(self._db.client, "SELECT 1", lambda _: "connection established")

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        # A configured catalog is trusted without querying, so no SHOW CATALOGS runs.
        configured = self.service_connection.catalog
        command = None if configured else DATABRICKS_GET_CATALOGS
        return self._list(
            lambda: self._engine_wrapper.get_catalogs(catalog_name=configured),
            command,
            "catalog",
        )

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return self._list(
            lambda: self._engine_wrapper.get_schemas(schema_name=self.service_connection.databaseSchema),
            "SHOW SCHEMAS",
            "schema",
        )

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return self._list(self._engine_wrapper.get_tables, "SHOW TABLES", "table")

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return self._list(self._engine_wrapper.get_views, "SHOW VIEWS", "view")

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        statement = DATABRICKS_SQL_STATEMENT_TEST.format(query_history=self.service_connection.queryHistoryTable)
        return run_sql(self._db.client, statement, lambda _: "query history accessible")

    @check(DatabaseStep.GetViewDefinitions)
    def get_view_definitions(self) -> Evidence:
        return run_sql(self._db.client, TEST_VIEW_DEFINITIONS, lambda _: "view definitions accessible")

    @check(DatabaseStep.GetCatalogTags)
    def get_catalog_tags(self) -> Evidence:
        statement = TEST_CATALOG_TAGS.format(database_name=self._first_catalog())
        return run_sql(self._db.client, statement, lambda _: "catalog tags accessible")

    @check(DatabaseStep.GetSchemaTags)
    def get_schema_tags(self) -> Evidence:
        statement = TEST_SCHEMA_TAGS.format(database_name=self._first_catalog())
        return run_sql(self._db.client, statement, lambda _: "schema tags accessible")

    @check(DatabaseStep.GetTableTags)
    def get_table_tags(self) -> Evidence:
        statement = TEST_TABLE_TAGS.format(database_name=self._first_catalog())
        return run_sql(self._db.client, statement, lambda _: "table tags accessible")

    @check(DatabaseStep.GetColumnTags)
    def get_column_tags(self) -> Evidence:
        statement = TEST_COLUMN_TAGS.format(database_name=self._first_catalog())
        return run_sql(self._db.client, statement, lambda _: "column tags accessible")

    @check(DatabaseStep.GetTableLineage)
    def get_table_lineage(self) -> Evidence:
        return run_sql(self._db.client, TEST_TABLE_LINEAGE, lambda _: "table lineage accessible")

    @check(DatabaseStep.GetColumnLineage)
    def get_column_lineage(self) -> Evidence:
        return run_sql(self._db.client, TEST_COLUMN_LINEAGE, lambda _: "column lineage accessible")


class DatabricksApiConnection(
    BaseConnection[DatabricksConnectionConfig | UnityCatalogConnectionConfig, DatabricksClient]
):
    """Owns the Databricks REST client (Jobs, query-history, and lineage APIs):
    a separate lifetime from the SQL engine, shared by the databricks and Unity
    Catalog sources."""

    def _get_client(self) -> DatabricksClient:
        # No pooled resource to close: uses the ``requests`` module, not a Session.
        return DatabricksClient(self.service_connection)


class DatabricksConnection(BaseConnection[DatabricksConnectionConfig, Engine]):
    def __init__(self, service_connection: DatabricksConnectionConfig) -> None:
        super().__init__(service_connection)
        # Honor the user-facing connectionTimeout (default 120s) as the per-step
        # budget; a cold serverless warehouse can exceed the 60s framework default.
        self.step_timeout_seconds = service_connection.connectionTimeout or STEP_TIMEOUT_SECONDS
        # A sub-owner, not a client: constructing it opens nothing.
        self.api = DatabricksApiConnection(service_connection)

    def _get_client(self) -> Engine:
        engine = get_connection(self.service_connection)
        self._on_close(engine.dispose)
        return engine

    def close(self) -> None:
        # Not _on_close: that registry is reset by close(), so a sub-owner
        # registered once would not be released on a later reuse cycle.
        self.api.close()
        super().close()

    def checks(self) -> ChecksProvider:
        return DatabricksChecks(
            db=self.borrow(),
            service_connection=self.service_connection,
        )
