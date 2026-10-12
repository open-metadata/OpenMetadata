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

from functools import partial
from typing import Any

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
from metadata.ingestion.source.database.databend.constants import (
    DEFAULT_DATABASE,
    SYSTEM_DATABASES,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.filters import filter_by_schema


def get_connection_url(connection: DatabendConnectionConfig) -> str:
    """Build a Databend URL that always carries an initial database path.

    databend-sqlalchemy renders a missing path as `/None`, so fall back to the `default` database.
    """
    base, separator, query = get_connection_url_common(connection).partition("?")
    base = base.rstrip("/")
    if not connection.databaseSchema:
        base = f"{base}/{DEFAULT_DATABASE}"
    return f"{base}{separator}{query}"


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
        self._on_close(engine.dispose)
        return engine

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        engine = self.client

        def inspect_entities(inspector_method: str) -> None:
            inspector = inspect(engine)
            getattr(inspector, inspector_method)(self._pick_user_schema(inspector))

        test_fn = {
            "CheckAccess": partial(check_connection_access, engine),
            "GetDatabases": partial(test_query, engine, "SELECT current_catalog()"),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": partial(inspect_entities, "get_table_names"),
            "GetViews": partial(inspect_entities, "get_view_names"),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )

    def _pick_user_schema(self, inspector: Any) -> str:
        """Resolve the schema used to validate table metadata, honouring the filter pattern."""
        schema_name = self.service_connection.databaseSchema or next(
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
        return schema_name
