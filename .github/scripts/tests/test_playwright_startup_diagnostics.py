#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from __future__ import annotations

import errno
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1]


@pytest.fixture
def capture(tmp_path):
    pipe = tmp_path / "server.pipe"
    os.mkfifo(pipe)
    writer = None
    log = tmp_path / "server.log"
    metrics = tmp_path / "metrics.json"
    process = subprocess.Popen(
        [
            sys.executable,
            str(SCRIPTS / "capture_playwright_server_output.py"),
            "--input",
            str(pipe),
            "--log",
            str(log),
            "--metrics",
            str(metrics),
            "--shard-id",
            "startup-test",
            "--tail-lines",
            "3",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    try:
        deadline = time.monotonic() + 5
        while (
            not metrics.exists()
            and process.poll() is None
            and time.monotonic() < deadline
        ):
            time.sleep(0.01)
        assert metrics.exists(), (
            "The capture process did not publish its initial log and metrics"
        )
        while writer is None and process.poll() is None and time.monotonic() < deadline:
            try:
                writer = os.fdopen(
                    os.open(pipe, os.O_WRONLY | os.O_NONBLOCK), "wb", buffering=0
                )
            except OSError as error:
                if error.errno != errno.ENXIO:
                    raise
                time.sleep(0.01)
        assert writer is not None, "The capture process did not open the FIFO"
        yield process, writer, log, metrics
    finally:
        if writer is not None:
            writer.close()
        if process.poll() is None:
            process.terminate()
        process.communicate(timeout=5)


def test_capture_creates_diagnostics_before_server_output(capture):
    process, _, log, metrics = capture
    assert process.poll() is None
    assert log.read_text() == ""
    assert json.loads(metrics.read_text())["totalRequests"] == 0


def test_capture_termination_flushes_while_the_writer_is_still_open(capture):
    process, writer, log, metrics = capture
    process.send_signal(signal.SIGTERM)
    _, error = process.communicate(timeout=5)
    assert process.returncode == 0, error.decode()
    assert not writer.closed
    assert log.exists()
    assert json.loads(metrics.read_text())["shardId"] == "startup-test"


def test_capture_eof_retains_bounded_log_and_complete_metrics(capture):
    process, writer, log, metrics = capture
    lines = [
        "Starting server\n",
        '"GET /api/v1/tables HTTP/1.1" 200 10 "-" "ua" 15\n',
        '"GET /api/v1/search/query HTTP/1.1" 500 0 "-" "ua" 25\n',
        "Fatal startup failure\n",
    ]
    writer.write("".join(lines).encode())
    writer.close()
    _, error = process.communicate(timeout=5)
    assert process.returncode == 0, error.decode()
    assert log.read_text() == "".join(lines[-3:])
    assert json.loads(metrics.read_text())["totalRequests"] == 2


@pytest.mark.parametrize("failed", [True, False])
def test_cleanup_preserves_bounded_startup_logs_only_on_failure(tmp_path, failed):
    runtime = tmp_path / "runtime"
    logs = runtime / "logs"
    logs.mkdir(parents=True)
    application_logs = runtime / "server" / "logs"
    application_logs.mkdir(parents=True)
    lines = [f"startup line {number}\n" for number in range(6000)]
    for name in ("openmetadata-server.log", "openmetadata-gc.log"):
        (logs / name).write_text("".join(lines))
    (application_logs / "openmetadata.log").write_text("".join(lines))
    environment = {
        **os.environ,
        "PW_RUNTIME_ROOT": str(runtime),
        "PW_SERVER_LOG": str(logs / "openmetadata-server.log"),
        "PW_STARTUP_FAILED": "true" if failed else "false",
        "RUNNER_TEMP": str(tmp_path / "runner"),
        "PW_AIRFLOW_CONTAINER": "",
        "PW_AUTOPILOT_MYSQL_CONTAINER": "",
        "PW_SERVER_PID_FILE": "",
        "PW_SERVER_CAPTURE_PID_FILE": "",
        "PW_POSTGRES_DATA_DIR": "",
        "PW_OPENSEARCH_DATA_DIR": "",
    }
    result = subprocess.run(
        ["bash", str(SCRIPTS / "stop_playwright_fast_environment.sh")],
        env=environment,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    destination = tmp_path / "runner" / "playwright-ci-diagnostics"
    if failed:
        for name in (
            "openmetadata-server.log",
            "openmetadata.log",
            "openmetadata-gc.log",
        ):
            assert (destination / name).read_text() == "".join(lines[-5000:])
        assert "startup line 5999" in result.stderr
    else:
        assert not destination.exists()
