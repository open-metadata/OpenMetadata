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

from typing import TYPE_CHECKING, cast

from sqlalchemy.dialects.mysql.base import MySQLIdentifierPreparer
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection as DorisConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import BasicAuthStrategy
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN

if TYPE_CHECKING:
    from sqlalchemy.engine.default import DefaultDialect


class DorisIdentifierPreparer(MySQLIdentifierPreparer):
    """Quote every identifier because Doris reserves more words than MySQL."""

    def _requires_quotes(self, value: str) -> bool:
        return True


class DorisConnection(BaseConnection[DorisConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Doris.
        """
        engine = BasicAuthStrategy(self.service_connection).build()
        self._on_close(engine.dispose)
        dialect = cast("DefaultDialect", engine.dialect)
        engine.dialect.identifier_preparer = DorisIdentifierPreparer(dialect)
        return engine

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
        timeout_seconds: int | None = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
