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
"""Databend connection handler."""

from copy import deepcopy
from functools import partial
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.databendConnection import (
    DatabendConnection as DatabendConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
    test_query,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.databend.constants import SYSTEM_DATABASES
from metadata.utils.constants import THREE_MIN
from metadata.utils.filters import filter_by_database, filter_by_schema


def get_connection_url(connection: DatabendConnectionConfig) -> str:
    """Build a Databend URL whose database path excludes the query separator."""
    return get_connection_url_common(connection).replace("/?", "?", 1)


def set_catalog_on_connect(engine: Engine, catalog: str) -> None:
    """Select the configured catalog on every pooled DBAPI connection."""
    quoted_catalog = engine.dialect.identifier_preparer.quote(catalog)

    @event.listens_for(engine, "connect")
    def _set_catalog(dbapi_connection: Any, _connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute(f"USE CATALOG {quoted_catalog}")
        finally:
            cursor.close()


def check_connection_access(engine: Engine) -> None:
    """Validate access and clarify the driver's HTTP/TLS protocol mismatch error."""
    try:
        test_connection_engine_step(engine)
    except Exception as exc:
        error = str(exc).lower()
        if (
            "request_kind=login" in error
            and "error sending request" in error
            and "client error (connect)" in error
            and "invalidcontenttype" in error
        ):
            # databend-driver 0.33.7 obscures an HTTP/TLS mismatch behind this reqwest error.
            # Remove this compatibility hint after the driver reports the protocol mismatch clearly.
            raise RuntimeError(
                "Databend could not establish the login connection because the endpoint's HTTP/TLS mode "
                "does not match the connection settings. For a non-TLS HTTP endpoint, such as the default "
                "self-hosted port 8000, add `sslmode=disable` under Connection Options. For a TLS/HTTPS "
                "endpoint, verify the host and port and use `sslmode=enable`."
            ) from exc
        raise


class DatabendConnection(BaseConnection[DatabendConnectionConfig, Engine]):
    """Create and validate a Databend SQLAlchemy engine."""

    def _get_client(self) -> Engine:
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        if self.service_connection.catalog:
            set_catalog_on_connect(engine, self.service_connection.catalog)
        self._on_close(engine.dispose)
        return engine

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        base_engine = self.client
        catalog_connection = None
        catalog_engine = base_engine

        def get_databases() -> None:
            nonlocal catalog_connection, catalog_engine
            if self.service_connection.catalog:
                test_query(base_engine, "SELECT current_catalog()")
                return

            with base_engine.connect() as connection:
                catalogs = connection.execute(text("SHOW CATALOGS")).fetchall()
            if not catalogs:
                raise RuntimeError("No accessible Databend catalogs found")

            failures = []
            for catalog_row in catalogs:
                if not catalog_row or not catalog_row[0]:
                    continue
                catalog = catalog_row[0]
                if filter_by_database(self.service_connection.databaseFilterPattern, catalog):
                    continue
                connection_config = deepcopy(self.service_connection)
                connection_config.catalog = catalog
                candidate_connection = DatabendConnection(connection_config)
                try:
                    candidate_engine = candidate_connection.client
                    inspect(candidate_engine).get_schema_names()
                except Exception as exc:
                    candidate_connection.close()
                    failures.append(f"{catalog}: {exc}")
                    continue

                catalog_connection = candidate_connection
                catalog_engine = candidate_engine
                return

            details = f": {'; '.join(failures)}" if failures else ""
            raise RuntimeError(f"No accessible Databend catalogs found{details}")

        def get_catalog_engine() -> Engine:
            if not self.service_connection.catalog and catalog_connection is None:
                raise RuntimeError("A Databend catalog has not been selected")
            return catalog_engine

        def inspect_catalog(inspector_method: str) -> None:
            execute_inspector_func(get_catalog_engine(), inspector_method)

        def inspect_catalog_entities(inspector_method: str) -> None:
            inspector = inspect(get_catalog_engine())
            schema_name = self.service_connection.databaseSchema
            if not schema_name:
                schema_name = next(
                    (
                        name
                        for name in inspector.get_schema_names()
                        if name.lower() not in SYSTEM_DATABASES
                        and not filter_by_schema(self.service_connection.schemaFilterPattern, name)
                    ),
                    None,
                )
            if not schema_name:
                raise RuntimeError(
                    "No accessible Databend database is available to validate table metadata "
                    "after applying the Schema Filter Pattern"
                )
            getattr(inspector, inspector_method)(schema_name)

        test_fn = {
            "CheckAccess": partial(check_connection_access, base_engine),
            "GetDatabases": get_databases,
            "GetSchemas": partial(inspect_catalog, "get_schema_names"),
            "GetTables": partial(inspect_catalog_entities, "get_table_names"),
            "GetViews": partial(inspect_catalog_entities, "get_view_names"),
        }

        try:
            return test_connection_steps(
                metadata=metadata,
                test_fn=test_fn,
                service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
                automation_workflow=automation_workflow,
                timeout_seconds=timeout_seconds,
            )
        finally:
            if catalog_connection is not None:
                catalog_connection.close()
