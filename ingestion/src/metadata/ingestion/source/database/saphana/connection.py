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

from abc import ABC, abstractmethod
from collections.abc import Callable
from functools import partial
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaHDBConnection import (
    SapHanaHDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaSQLConnection import (
    SapHanaSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection as SapHanaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaScheme,
    SapHanaType,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import ClientStrategy
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class SapHanaStrategy(ClientStrategy[SapHanaConnectionConfig, Engine], ABC):
    """Builds the SAP HANA engine for one connection mode."""

    @property
    def _scheme(self) -> str:
        scheme = self._connection.scheme
        return scheme.value if scheme else SapHanaScheme.hana.value

    @abstractmethod
    def get_url(self) -> str:
        """Return the SQLAlchemy URL for this connection mode."""

    def build(self) -> Engine:
        return create_generic_db_connection(
            connection=self._connection,
            get_connection_url_fn=lambda _connection: self.get_url(),
            get_connection_args_fn=get_connection_args_common,
        )


class SapHanaSQLStrategy(SapHanaStrategy):
    """Direct host/port connection with username and password."""

    def __init__(self, connection: SapHanaConnectionConfig, sql: SapHanaSQLConnection) -> None:
        super().__init__(connection)
        self._sql = sql

    def get_url(self) -> str:
        url = (
            f"{self._scheme}://"
            f"{quote_plus(self._sql.username)}:"
            f"{quote_plus(self._sql.password.get_secret_value())}@"
            f"{self._sql.hostPort}"
        )
        if self._sql.database:
            url += f"/{self._sql.database}"
        options = get_connection_options_dict(self._connection)
        if options:
            if not self._sql.database:
                url += "/"
            params = "&".join(f"{key}={quote_plus(value)}" for (key, value) in options.items() if value)
            url = f"{url}?{params}"
        return url


class SapHanaHDBStrategy(SapHanaStrategy):
    """Connection through a stored secure user store (HDB) key."""

    def __init__(self, connection: SapHanaConnectionConfig, hdb: SapHanaHDBConnection) -> None:
        super().__init__(connection)
        self._hdb = hdb

    def get_url(self) -> str:
        return f"{self._scheme}://userkey={self._hdb.userKey}"


class SapHanaConnection(BaseConnection[SapHanaConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        match self.service_connection.connection:
            case SapHanaSQLConnection() as sql:
                strategy: SapHanaStrategy = SapHanaSQLStrategy(self.service_connection, sql)
            case SapHanaHDBConnection() as hdb:
                strategy = SapHanaHDBStrategy(self.service_connection, hdb)
        return strategy.build()

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        service_type = self.service_connection.type
        return test_connection_steps(
            metadata=metadata,
            test_fn=self._build_test_functions(),
            service_type=service_type.value if service_type else SapHanaType.SapHana.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )

    def _build_test_functions(self) -> dict[str, Callable]:
        engine = self.client

        def list_from_schema(inspector_fn_str: str) -> None:
            inspector = inspect(engine)
            inspector_fn = getattr(inspector, inspector_fn_str)
            database_schema = getattr(self.service_connection.connection, "databaseSchema", None)
            if database_schema:
                inspector_fn(database_schema)
            else:
                for schema in inspector.get_schema_names() or []:
                    inspector_fn(schema)
                    break

        return {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": partial(list_from_schema, "get_table_names"),
            "GetViews": partial(list_from_schema, "get_view_names"),
        }
