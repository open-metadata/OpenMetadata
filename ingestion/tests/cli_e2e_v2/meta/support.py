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
"""Offline subprocess bootstrap and executable probes for framework meta-tests."""

import os
from pathlib import Path

NETWORK_GUARD = """
import socket

def reject_network(*args, **kwargs):
    raise AssertionError("Offline framework probe attempted network access")

socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
for name in ("getaddrinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr", "getnameinfo"):
    setattr(socket, name, reject_network)
"""

WORKFLOW_PROBE = (
    NETWORK_GUARD
    + """
import json
import sqlite3
import sys
from pathlib import Path
import yaml

config = yaml.safe_load(Path(sys.argv[sys.argv.index("-c") + 1]).read_text())
counter = Path(config["counter"])
counter.write_text(str(int(counter.read_text()) + 1 if counter.exists() else 1))
if config.get("mode") == "sqlite":
    with sqlite3.connect(config["source"]) as source:
        names = source.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall()
    with sqlite3.connect(config["persisted"]) as persisted:
        persisted.execute("CREATE TABLE IF NOT EXISTS observed (name TEXT)")
        persisted.execute("DELETE FROM observed")
        persisted.executemany("INSERT INTO observed VALUES (?)", names)
elif config.get("mode") == "dashboard":
    from metadata.generated.schema.entity.data.dashboard import Dashboard
    dashboard = Dashboard.model_validate({
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "my_dashboard",
        "project": config["project"],
        "service": {"id": "00000000-0000-0000-0000-000000000002", "type": "dashboardService"},
    })
    Path(config["persisted"]).write_text(dashboard.model_dump_json())
status = {
    "pipeline_type": "metadata", "success": config.get("success", True),
    "steps": [{"name": "Probe", "records": 1, "updated_records": 0,
               "warnings": 0, "errors": config.get("errors", 0), "filtered": 0, "failures": None}],
}
Path(sys.argv[sys.argv.index("--status-file") + 1]).write_text(json.dumps(status))
sys.exit(config.get("exit", 0))
"""
)

CHILD_CONFTEST = """
import sys
from pathlib import Path
from types import SimpleNamespace
import pytest
from ingestion.tests.cli_e2e_v2.runtime import expect

@pytest.fixture(autouse=True)
def polling_clock(monkeypatch):
    elapsed = 0.0
    def advance(seconds):
        nonlocal elapsed
        elapsed += seconds
    monkeypatch.setattr(expect, "time", SimpleNamespace(monotonic=lambda: elapsed, sleep=advance))

@pytest.fixture
def cli(cli):
    cli.command = (sys.executable, str(Path(__file__).parent / "probe.py"))
    return cli
"""

CLI_PROBE = (
    NETWORK_GUARD
    + """
import json
import sys
from pathlib import Path
import yaml

config_path = Path(sys.argv[sys.argv.index("-c") + 1])
status_path = Path(sys.argv[sys.argv.index("--status-file") + 1])
config = yaml.safe_load(config_path.read_text())
probe = config.get("probe", {})
assert sys.argv[1] == probe.get("subcommand", "ingest")
print(probe.get("stdout", "source output"), flush=True)
print(probe.get("stderr", "source error"), file=sys.stderr, flush=True)
if probe.get("block"):
    import threading
    threading.Event().wait()
if probe.get("descendant"):
    import subprocess
    import signal
    child = subprocess.Popen([sys.executable, "-c", "import os, sys; from pathlib import Path; Path(sys.argv[1]).write_text(str(os.getpid())); sys.stdin.read(); Path(sys.argv[2]).touch()", str(config_path.parent / "descendant.pid"), probe["descendant"]], stdin=subprocess.PIPE)
    signal.pause()
if not probe.get("missing"):
    status = {
        "pipeline_type": "example",
        "ingestion_pipeline_fqn": None,
        "success": probe.get("success", True),
        "steps": [{
            "name": probe.get("step_name", "Example"), "records": 2, "updated_records": 1, "warnings": 0,
            "errors": probe.get("errors", 0), "filtered": 0,
            "failures": probe.get("failures"), "progress": None,
            "operationMetrics": None, "sourceTimeMs": None, "sinkTimeMs": None,
        }],
    }
    status_path.write_text(probe.get("raw_status", json.dumps(status)))
sys.exit(probe.get("exit", 0))
"""
)


def configure_child(pytester, monkeypatch, *, conftest="", probe=None, ini=""):
    """Configure an isolated pytest subprocess with the E2E plugin and no network."""
    root = Path(__file__).resolve().parents[4]
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join((str(pytester.path), str(root), str(root / "ingestion/src"))))
    pytester.makeini("[pytest]\naddopts = -p ingestion.tests.cli_e2e_v2.conftest\n" + ini)
    pytester.makepyfile(sitecustomize=NETWORK_GUARD)
    if probe is not None:
        pytester.makepyfile(probe=probe)
    if conftest:
        pytester.makeconftest(conftest)
