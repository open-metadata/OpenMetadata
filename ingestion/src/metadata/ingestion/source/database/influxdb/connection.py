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
InfluxDB 3 connection handler.

InfluxDB 3 uses the HTTP API (SQL via /api/v3/query_sql) rather than
a SQLAlchemy dialect. This module provides a thin HTTP client wrapper
and a BaseConnection subclass for the OpenMetadata ingestion framework.
"""

from typing import Any, List, Optional, Tuple

from requests import Session

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.influxdbConnection import (
    InfluxdbConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class InfluxDBClient:
    """
    Thin wrapper around the InfluxDB 3 HTTP API for metadata introspection.

    Uses the /api/v3/query_sql endpoint to run SQL queries against
    InfluxDB 3 databases, system tables, and information_schema.
    """

    def __init__(self, url: str, token: str):
        self._url = url.rstrip("/")
        self._session = Session()
        self._session.headers["Authorization"] = f"Bearer {token}"

    def _query(self, database: str, sql: str) -> List[dict]:
        params = {"db": database, "q": sql, "format": "json"}
        resp = self._session.get(
            f"{self._url}/api/v3/query_sql",
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def list_databases(self) -> List[str]:
        rows = self._query(
            "_internal",
            "SELECT database_name FROM system.databases WHERE deleted=false",
        )
        return [
            row["database_name"]
            for row in rows
            if row["database_name"] != "_internal"
        ]

    def list_tables(self, database: str) -> List[str]:
        rows = self._query(
            database,
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'iox'",
        )
        return [row["table_name"] for row in rows]

    def get_columns(self, database: str, table: str) -> List[dict]:
        safe_table = table.replace("'", "''")
        sql = (
            "SELECT column_name, data_type, is_nullable "
            "FROM information_schema.columns "
            f"WHERE table_schema = 'iox' AND table_name = '{safe_table}'"
        )
        return self._query(database, sql)

    def fetch_sample_rows(
        self, database: str, table: str, limit: int = 50
    ) -> Tuple[List[str], List[List[Any]]]:
        safe_table = table.replace('"', '""')
        sql = (
            f'SELECT * FROM "{safe_table}" '
            f"WHERE time >= now() - INTERVAL '24 hours' "
            f"LIMIT {limit}"
        )
        data = self._query(database, sql)
        if not data:
            return [], []
        columns = list(data[0].keys())
        rows = [[row.get(col) for col in columns] for row in data]
        return columns, rows

    def test_connection(self) -> bool:
        resp = self._session.get(f"{self._url}/health", timeout=10)
        return resp.status_code == 200

    def close(self) -> None:
        self._session.close()


class InfluxDBConnection(BaseConnection[InfluxdbConnection, InfluxDBClient]):
    """
    Connection class that builds an InfluxDB 3 HTTP client.

    Since InfluxDB 3 has no SQLAlchemy dialect, the client returned by
    ``_get_client`` is the raw ``InfluxDBClient`` wrapper, not a DB-API
    engine.
    """

    def _get_client(self) -> InfluxDBClient:
        conn = self.service_connection
        return InfluxDBClient(url=conn.hostPort, token=conn.token.get_secret_value())

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        client = self.client
        service_connection = self.service_connection

        def test_check_health():
            if not client.test_connection():
                raise ConnectionError("InfluxDB 3 health check failed")

        def test_get_databases():
            databases = client.list_databases()
            logger.info("Found %d database(s): %s", len(databases), databases)

        test_fn = {
            "CheckAccess": test_check_health,
            "GetDatabases": test_get_databases,
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=service_connection.type.value,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
