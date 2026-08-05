#  Copyright 2026 Collate
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
PowerBI integration test fixtures - mock Power BI REST API server

Serves the handful of endpoints the connector calls so tests drive the real
``PowerBiApiClient`` -> ``TrackedREST`` -> ``requests`` stack. Pagination is then
asserted on the query string that actually reached the server rather than on a
stubbed-out transport, which is the only way to catch ``$top`` being dropped or
serialised as a body instead of a query param.

Only msal is faked: it is a third-party auth boundary, and every other layer is real.
"""

import json
import re
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.powerbi import client as powerbi_client_module
from metadata.ingestion.source.dashboard.powerbi.client import (
    PowerBiApiClient,
    PowerBiClient,
)
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource

ODATA_CONTEXT = "https://api.powerbi.com/v1.0/myorg/$metadata"
SCAN_CREATED_AT = "2026-01-01T00:00:00Z"

BASE_CONNECTION_CONFIG = {
    "type": "PowerBI",
    "clientId": "client_id",
    "clientSecret": "client_secret",
    "tenantId": "tenant_id",
    "scope": ["https://analysis.windows.net/powerbi/api/.default"],
}

# The client prefixes every path with the ``v1.0`` api version.
RE_GROUPS = re.compile(r"^/v1\.0/myorg/(?:admin/)?groups$")
RE_SCAN_INFO = re.compile(r"^/v1\.0/myorg/admin/workspaces/getInfo$")
RE_SCAN_STATUS = re.compile(r"^/v1\.0/myorg/admin/workspaces/scanStatus/(?P<scan_id>[^/]+)$")
RE_SCAN_RESULT = re.compile(r"^/v1\.0/myorg/admin/workspaces/scanResult/(?P<scan_id>[^/]+)$")


@dataclass
class RecordedRequest:
    """One request as the server saw it."""

    method: str
    path: str
    query: dict[str, str]
    body: dict | None = None

    @property
    def is_groups(self) -> bool:
        return bool(RE_GROUPS.match(self.path))

    @property
    def top(self) -> int | None:
        return int(self.query["$top"]) if "$top" in self.query else None

    @property
    def skip(self) -> int | None:
        return int(self.query["$skip"]) if "$skip" in self.query else None


@dataclass
class PowerBiMockServer:
    """Per-test view of the mock server: the URL, the knobs, and the request log."""

    url: str
    workspace_total: int = 0
    # Answer the group page at this ``$skip`` with an error body, once, to exercise
    # the client's failed-index retry pass.
    fail_group_page_at_skip: int | None = None
    requests: list[RecordedRequest] = field(default_factory=list)
    scan_batches: dict[str, list[str]] = field(default_factory=dict)
    _failed_skips: set[int] = field(default_factory=set)

    @property
    def group_requests(self) -> list[RecordedRequest]:
        return [request for request in self.requests if request.is_groups]

    @property
    def group_page_requests(self) -> list[RecordedRequest]:
        """Group requests excluding the ``$top=1`` probe that only reads ``@odata.count``."""
        return [request for request in self.group_requests if request.top != 1]

    def workspace_window(self, skip: int, top: int) -> list[dict]:
        return [
            {"id": f"ws-{index}", "name": f"Workspace {index}", "state": "Active"}
            for index in range(skip, min(skip + top, self.workspace_total))
        ]

    def should_fail(self, skip: int) -> bool:
        if self.fail_group_page_at_skip != skip or skip in self._failed_skips:
            return False
        self._failed_skips.add(skip)
        return True


class PowerBiMockHandler(BaseHTTPRequestHandler):
    """Routes the Power BI endpoints the connector calls; records every request."""

    state: PowerBiMockServer | None = None

    def do_GET(self):
        request = self._record("GET")
        if request.is_groups:
            self._handle_groups(request)
        elif match := RE_SCAN_STATUS.match(request.path):
            self._respond_json(self._scan_response(match.group("scan_id")))
        elif match := RE_SCAN_RESULT.match(request.path):
            self._handle_scan_result(match.group("scan_id"))
        else:
            # Every other endpoint the connector reads is an unpaginated OData collection.
            self._respond_json({"@odata.context": ODATA_CONTEXT, "value": []})

    def do_POST(self):
        request = self._record("POST")
        if RE_SCAN_INFO.match(request.path):
            self._handle_scan_info(request)
        else:
            self._respond_json({}, status=404)

    def _handle_groups(self, request: RecordedRequest) -> None:
        state = self.state
        skip, top = request.skip or 0, request.top or 0
        if state.should_fail(skip):
            # Power BI answers a throttled read with 200 + a bare ``message`` body.
            self._respond_json({"message": "Request has been throttled"})
            return
        self._respond_json(
            {
                "@odata.context": ODATA_CONTEXT,
                "@odata.count": state.workspace_total,
                "value": state.workspace_window(skip, top),
            }
        )

    def _handle_scan_info(self, request: RecordedRequest) -> None:
        state = self.state
        scan_id = f"scan-{len(state.scan_batches) + 1}"
        state.scan_batches[scan_id] = (request.body or {}).get("workspaces", [])
        self._respond_json(self._scan_response(scan_id))

    def _handle_scan_result(self, scan_id: str) -> None:
        workspace_ids = self.state.scan_batches.get(scan_id, [])
        self._respond_json({"workspaces": [{"id": ws_id, "name": ws_id, "state": "Active"} for ws_id in workspace_ids]})

    @staticmethod
    def _scan_response(scan_id: str) -> dict:
        return {"id": scan_id, "createdDateTime": SCAN_CREATED_AT, "status": "Succeeded"}

    def _record(self, method: str) -> RecordedRequest:
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length)) if length else None
        request = RecordedRequest(
            method=method,
            path=parsed.path,
            query={key: values[0] for key, values in parse_qs(parsed.query).items()},
            body=body,
        )
        self.state.requests.append(request)
        return request

    def _respond_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *_args):
        pass


@pytest.fixture(scope="module")
def powerbi_http_server():
    server = HTTPServer(("127.0.0.1", 0), PowerBiMockHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture
def powerbi_server(powerbi_http_server):
    """Fresh server state per test - the request log must not leak across tests."""
    state = PowerBiMockServer(url=powerbi_http_server)
    PowerBiMockHandler.state = state
    yield state
    PowerBiMockHandler.state = None


@pytest.fixture
def powerbi_api_client(powerbi_server):
    """Factory for a real ``PowerBiApiClient`` pointed at the mock server.

    The msal patch has to outlive the factory call: the client resolves its token
    lazily, on the first request.
    """
    with patch.object(powerbi_client_module.msal, "ConfidentialClientApplication") as msal_app:
        msal_app.return_value.acquire_token_silent.return_value = {
            "access_token": "test-token",
            "expires_in": 3600,
        }

        def build(page_size: int | None = None, use_admin_apis: bool = False) -> PowerBiApiClient:
            return PowerBiApiClient(PowerBIConnection(**_connection_config(powerbi_server, page_size, use_admin_apis)))

        yield build


@pytest.fixture
def powerbi_source(powerbi_server, powerbi_api_client):
    """Factory for a real ``PowerbiSource`` whose api client talks to the mock server.

    Only connection creation and the connection test are patched, so the source's own
    workspace chunking runs for real - over real HTTP - rather than against a mocked
    api client that could not catch a wrong batch size.
    """

    def build(page_size: int) -> PowerbiSource:
        api_client = powerbi_api_client(page_size=page_size, use_admin_apis=True)
        workflow = {
            "source": {
                "type": "powerbi",
                "serviceName": "mock_powerbi",
                "serviceConnection": {"config": _connection_config(powerbi_server, page_size, use_admin_apis=True)},
                "sourceConfig": {"config": {"type": "DashboardMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "enableVersionValidation": False,
                    "securityConfig": {"jwtToken": "token"},
                }
            },
        }
        with (
            patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection") as create_connection,
            patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"),
        ):
            create_connection.return_value.client = PowerBiClient(api_client=api_client, file_client=None)
            config = OpenMetadataWorkflowConfig.model_validate(workflow)
            return PowerbiSource.create(
                workflow["source"],
                OpenMetadata(config.workflowConfig.openMetadataServerConfig),
            )

    return build


def _connection_config(server: PowerBiMockServer, page_size: int | None, use_admin_apis: bool) -> dict:
    config = dict(BASE_CONNECTION_CONFIG, apiURL=server.url, useAdminApis=use_admin_apis)
    if page_size is not None:
        config["pagination_entity_per_page"] = page_size
    return config
