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
Ssrs connection integration tests
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient
from metadata.ingestion.source.dashboard.ssrs.connection import get_connection


class _MockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"value": []}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="module")
def ssrs_mock_url():
    server = HTTPServer(("127.0.0.1", 0), _MockHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}/reports"
    server.shutdown()


@pytest.mark.integration
class TestSsrsConnection:
    def test_get_connection(self, ssrs_mock_url):
        connection = SsrsConnection(
            hostPort=ssrs_mock_url, username="test_user", password="test_pass"
        )
        client = get_connection(connection)
        assert isinstance(client, SsrsClient)

    def test_get_connection_test_access(self, ssrs_mock_url):
        connection = SsrsConnection(
            hostPort=ssrs_mock_url, username="test_user", password="test_pass"
        )
        client = get_connection(connection)
        client.test_access()

    def test_connection_bad_host(self):
        connection = SsrsConnection(
            hostPort="http://localhost:1", username="test_user", password="test_pass"
        )
        client = get_connection(connection)
        with pytest.raises(SourceConnectionException):
            client.test_access()
