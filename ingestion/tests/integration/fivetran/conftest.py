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
Fivetran integration test fixtures — mock HTTP server
"""
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient

# ---------------------------------------------------------------------------
# Mock data: Scenario 1 — PostgreSQL RDS → Redshift (standard connector)
# ---------------------------------------------------------------------------
POSTGRES_CONNECTOR = {
    "id": "conn_pg_rds",
    "group_id": "group_postgres_rds",
    "service": "postgres_rds",
    "schema": "public",
    "connected_by": "user@example.com",
    "setup_tests": [],
    "config": {
        "host": "my-rds-instance.amazonaws.com",
        "port": 5432,
        "database": "source_db",
    },
    "status": {"setup_state": "connected", "sync_state": "scheduled"},
}

POSTGRES_DESTINATION = {
    "id": "group_postgres_rds",
    "service": "redshift",
    "config": {
        "host": "redshift-cluster.amazonaws.com",
        "port": 5439,
        "database": "dest_db",
    },
}

POSTGRES_SCHEMAS = {
    "schemas": {
        "public": {
            "name_in_destination": "public",
            "enabled": True,
            "tables": {
                "users": {
                    "name_in_destination": "users",
                    "enabled": True,
                    "columns": {},
                },
                "audit_log": {
                    "name_in_destination": "audit_log",
                    "enabled": False,
                    "columns": {},
                },
            },
        },
        "internal": {
            "name_in_destination": "internal",
            "enabled": False,
            "tables": {},
        },
    }
}

POSTGRES_COLUMNS_PUBLIC_USERS = {
    "columns": {
        "id": {
            "name_in_destination": "user_id",
            "enabled": True,
            "type": "INTEGER",
        },
        "email": {
            "name_in_destination": "email_address",
            "enabled": True,
            "type": "VARCHAR",
        },
        "internal_flag": {
            "name_in_destination": "internal_flag",
            "enabled": False,
            "type": "BOOLEAN",
        },
    }
}

# ---------------------------------------------------------------------------
# Mock data: Scenario 2 — SQL Server HVA → Snowflake (HVR/HVA connector)
# ---------------------------------------------------------------------------
HVA_CONNECTOR = {
    "id": "conn_hva_sqlserver",
    "group_id": "group_hva_sqlserver",
    "service": "sql_server_hva",
    "schema": "dbo",
    "connected_by": "admin@example.com",
    "setup_tests": [],
    "config": {
        "host": "sqlserver.example.com",
        "port": 1433,
        "database": "erp_db",
    },
    "status": {"setup_state": "connected", "sync_state": "scheduled"},
}

HVA_DESTINATION = {
    "id": "group_hva_sqlserver",
    "service": "snowflake",
    "config": {
        "host": "account.snowflakecomputing.com",
        "database": "ANALYTICS_DB",
    },
}

HVA_SCHEMAS = {
    "schemas": {
        "dbo": {
            "name_in_destination": "DBO_DEST",
            "enabled": True,
            "tables": {
                "orders": {
                    "name_in_destination": "ORDERS_DEST",
                    "enabled": True,
                    "columns": {},
                },
                "customers": {
                    "name_in_destination": "CUSTOMERS_DEST",
                    "enabled": True,
                    "columns": {},
                },
            },
        }
    }
}

HVA_COLUMNS_DBO_ORDERS = {
    "columns": {
        "order_id": {
            "name_in_destination": "ORDER_ID",
            "enabled": True,
            "type": "INTEGER",
        },
        "customer_id": {
            "name_in_destination": "CUSTOMER_ID",
            "enabled": True,
            "type": "INTEGER",
        },
        "order_date": {
            "name_in_destination": "ORDER_DATE",
            "enabled": True,
            "type": "DATE",
        },
    }
}

HVA_COLUMNS_DBO_CUSTOMERS = {
    "columns": {
        "customer_id": {
            "name_in_destination": "CUSTOMER_ID",
            "enabled": True,
            "type": "INTEGER",
        },
        "name": {
            "name_in_destination": "NAME",
            "enabled": True,
            "type": "VARCHAR",
        },
    }
}

# ---------------------------------------------------------------------------
# Groups & pagination support
# ---------------------------------------------------------------------------
GROUP_PAGE_1 = {
    "id": "group_postgres_rds",
    "name": "Postgres RDS Pipeline",
}

GROUP_HVA = {
    "id": "group_hva_sqlserver",
    "name": "SQL Server HVA Pipeline",
}

GROUP_PAGE_2 = {
    "id": "group_snowflake",
    "name": "Snowflake Analytics",
}

ALL_GROUPS = [GROUP_PAGE_1, GROUP_HVA, GROUP_PAGE_2]

CONNECTORS_BY_GROUP = {
    "group_postgres_rds": [POSTGRES_CONNECTOR],
    "group_hva_sqlserver": [HVA_CONNECTOR],
}

CONNECTOR_DETAILS = {
    "conn_pg_rds": POSTGRES_CONNECTOR,
    "conn_hva_sqlserver": HVA_CONNECTOR,
}

DESTINATION_DETAILS = {
    "group_postgres_rds": POSTGRES_DESTINATION,
    "group_hva_sqlserver": HVA_DESTINATION,
}

SCHEMA_DETAILS = {
    "conn_pg_rds": POSTGRES_SCHEMAS,
    "conn_hva_sqlserver": HVA_SCHEMAS,
}

COLUMN_DETAILS = {
    ("conn_pg_rds", "public", "users"): POSTGRES_COLUMNS_PUBLIC_USERS,
    ("conn_hva_sqlserver", "dbo", "orders"): HVA_COLUMNS_DBO_ORDERS,
    ("conn_hva_sqlserver", "dbo", "customers"): HVA_COLUMNS_DBO_CUSTOMERS,
}

# ---------------------------------------------------------------------------
# Route patterns (compiled once)
# ---------------------------------------------------------------------------
RE_GROUPS = re.compile(r"^/v1/groups$")
RE_GROUP_CONNECTORS = re.compile(r"^/v1/groups/(?P<group_id>[^/]+)/connectors$")
RE_CONNECTOR = re.compile(r"^/v1/connectors/(?P<connector_id>[^/]+)$")
RE_DESTINATION = re.compile(r"^/v1/destinations/(?P<dest_id>[^/]+)$")
RE_CONNECTOR_SCHEMAS = re.compile(r"^/v1/connectors/(?P<connector_id>[^/]+)/schemas$")
RE_COLUMN_LINEAGE = re.compile(
    r"^/v1/connectors/(?P<connector_id>[^/]+)"
    r"/schemas/(?P<schema>[^/]+)"
    r"/tables/(?P<table>[^/]+)/columns$"
)


class FivetranMockHandler(BaseHTTPRequestHandler):
    paginate_groups = False

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if m := RE_GROUPS.match(path):
            self._handle_groups(params)
        elif m := RE_GROUP_CONNECTORS.match(path):
            self._handle_group_connectors(m.group("group_id"), params)
        elif m := RE_CONNECTOR.match(path):
            self._handle_detail(CONNECTOR_DETAILS, m.group("connector_id"))
        elif m := RE_DESTINATION.match(path):
            self._handle_detail(DESTINATION_DETAILS, m.group("dest_id"))
        elif m := RE_CONNECTOR_SCHEMAS.match(path):
            self._handle_schemas(m.group("connector_id"))
        elif m := RE_COLUMN_LINEAGE.match(path):
            self._handle_columns(
                m.group("connector_id"), m.group("schema"), m.group("table")
            )
        else:
            self._respond_json(
                {"code": "NotFound", "message": f"Unknown resource: {path}"},
                status=404,
            )

    # -- paginated endpoints ------------------------------------------------

    def _handle_groups(self, params):
        cursor = params.get("cursor", [None])[0]
        if self.__class__.paginate_groups:
            if cursor is None:
                self._respond_paginated([GROUP_PAGE_1, GROUP_HVA], next_cursor="page2")
            else:
                self._respond_paginated([GROUP_PAGE_2], next_cursor=None)
        else:
            self._respond_paginated(ALL_GROUPS, next_cursor=None)

    def _handle_group_connectors(self, group_id, params):
        connectors = CONNECTORS_BY_GROUP.get(group_id, [])
        self._respond_paginated(connectors, next_cursor=None)

    # -- detail endpoints ---------------------------------------------------

    def _handle_detail(self, registry, key):
        data = registry.get(key)
        if data is None:
            self._respond_json(
                {"code": "NotFound", "message": f"Not found: {key}"}, status=404
            )
            return
        self._respond_json({"data": data})

    def _handle_schemas(self, connector_id):
        data = SCHEMA_DETAILS.get(connector_id)
        if data is None:
            self._respond_json(
                {"code": "NotFound", "message": f"No schemas for {connector_id}"},
                status=404,
            )
            return
        self._respond_json({"data": data})

    def _handle_columns(self, connector_id, schema, table):
        key = (connector_id, schema, table)
        data = COLUMN_DETAILS.get(key)
        if data is None:
            self._respond_json(
                {"code": "NotFound", "message": f"No columns for {key}"}, status=404
            )
            return
        self._respond_json({"data": data})

    # -- response helpers ---------------------------------------------------

    def _respond_paginated(self, items, next_cursor=None):
        payload = {"data": {"items": items, "next_cursor": next_cursor or ""}}
        self._respond_json(payload)

    def _respond_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        pass


@pytest.fixture(scope="module")
def fivetran_mock_server():
    server = HTTPServer(("127.0.0.1", 0), FivetranMockHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


@pytest.fixture(scope="module")
def fivetran_client(fivetran_mock_server):
    connection = FivetranConnection(
        apiKey="test_key",
        apiSecret="test_secret",
        hostPort=fivetran_mock_server,
        limit=100,
    )
    yield FivetranClient(connection)
