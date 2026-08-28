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
"""Progress payloads must cross the HTTP boundary as JSON objects."""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import ClassVar

import pytest

from metadata.generated.schema.entity.services.ingestionPipelines.operationMetrics import (
    OperationMetricsBatch,
)
from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdate,
    ProgressUpdateType,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.ometa.mixins.progress_mixin import OMetaProgressMixin

RUN_ID = "00000000-0000-0000-0000-000000000000"


class _CaptureHandler(BaseHTTPRequestHandler):
    requests: ClassVar[list[dict]] = []

    def _capture(self) -> None:
        length = int(self.headers["Content-Length"])
        self.requests.append(
            {
                "method": self.command,
                "path": self.path,
                "content_type": self.headers["Content-Type"],
                "body": self.rfile.read(length),
            }
        )
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        self._capture()

    def do_PUT(self) -> None:
        self._capture()

    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture
def capture_server():
    _CaptureHandler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _CaptureHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()
    thread.join()


class _ProgressClient(OMetaProgressMixin):
    def __init__(self, client: REST) -> None:
        self.client = client


def progress_client(server: ThreadingHTTPServer) -> _ProgressClient:
    rest = REST(
        ClientConfig(
            base_url=f"http://127.0.0.1:{server.server_port}",
            retry=0,
        )
    )
    return _ProgressClient(rest)


def test_progress_update_is_sent_as_json(capture_server: ThreadingHTTPServer):
    update = ProgressUpdate(
        runId=RUN_ID,
        timestamp=Timestamp(root=1),
        updateType=ProgressUpdateType.DISCOVERY,
    )

    progress_client(capture_server).send_progress_update("my_pipeline", RUN_ID, update)

    request = _CaptureHandler.requests[0]
    assert request["method"] == "PUT"
    assert request["content_type"] == "application/json"
    assert json.loads(request["body"]) == update.model_dump(mode="json", exclude_none=True)


def test_operation_metrics_are_sent_as_json(capture_server: ThreadingHTTPServer):
    batch = OperationMetricsBatch(
        runId=RUN_ID,
        stepName="Profiler",
        metrics=[],
    )

    progress_client(capture_server).send_operation_metrics_batch("my_pipeline", RUN_ID, batch)

    request = _CaptureHandler.requests[0]
    assert request["method"] == "POST"
    assert request["content_type"] == "application/json"
    assert json.loads(request["body"]) == batch.model_dump(mode="json", exclude_none=True)
