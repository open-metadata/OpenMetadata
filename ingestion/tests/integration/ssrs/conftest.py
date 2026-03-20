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
Ssrs integration test fixtures
"""
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

MOCK_REPORTS = [
    {
        "Id": f"report-{i}",
        "Name": f"Report {i}",
        "Description": f"Description for report {i}",
        "Path": f"/TestFolder/Report {i}",
        "Type": "Report",
        "Hidden": False,
        "HasDataSources": True,
    }
    for i in range(1, 4)
] + [
    {
        "Id": "report-hidden",
        "Name": "Hidden Report",
        "Description": "Should not appear",
        "Path": "/TestFolder/Hidden Report",
        "Type": "Report",
        "Hidden": True,
        "HasDataSources": False,
    }
]

MOCK_FOLDERS = [
    {"Id": "folder-1", "Name": "TestFolder", "Path": "/TestFolder"},
]


class SsrsMockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/reports/api/v2.0/Folders":
            self._respond({"value": MOCK_FOLDERS})
        elif path == "/reports/api/v2.0/Reports":
            top = int(params.get("$top", [str(len(MOCK_REPORTS))])[0])
            skip = int(params.get("$skip", ["0"])[0])
            page = MOCK_REPORTS[skip : skip + top]
            self._respond({"value": page})
        else:
            self.send_error(404)

    def _respond(self, data: dict):
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


@pytest.fixture(scope="module")
def ssrs_mock_server():
    server = HTTPServer(("127.0.0.1", 0), SsrsMockHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}/reports"
    server.shutdown()


@pytest.fixture(scope="module")
def ssrs_service(ssrs_mock_server):
    yield ssrs_mock_server
