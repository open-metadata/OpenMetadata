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

"""Verify OpenLineage unit tests collect and execute without external clients."""

import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

INGESTION_ROOT = Path(__file__).resolve().parents[5]
TARGET = "tests/unit/topology/pipeline/test_openlineage.py"
NETWORK_GUARD = """
import sys
from unittest.mock import patch

import pytest

attempts = []

def forbidden(*args, **kwargs):
    attempts.append("external client or network access")
    raise AssertionError("OpenLineage unit tests attempted external access")

class ForbiddenKafkaConsumer:
    def __init__(self, *args, **kwargs):
        forbidden()

with (
    patch("confluent_kafka.Consumer", ForbiddenKafkaConsumer),
    patch("botocore.session.Session.create_client", side_effect=forbidden),
    patch("requests.sessions.Session.send", side_effect=forbidden),
    patch("botocore.httpsession.URLLib3Session.send", side_effect=forbidden),
    patch("socket.socket.connect", side_effect=forbidden),
    patch("socket.socket.connect_ex", side_effect=forbidden),
    patch("socket.getaddrinfo", side_effect=forbidden),
):
    result = pytest.main(sys.argv[1:])
assert not attempts, f"Unexpected external access attempts: {len(attempts)}"
raise SystemExit(result)
"""


@pytest.mark.parametrize("collect_only", [True, False], ids=["collection", "execution"])
def test_openlineage_unit_tests_do_not_access_external_services(tmp_path: Path, collect_only: bool):
    environment = os.environ.copy()
    for name in ("PYTEST_ADDOPTS", "PYTEST_PLUGINS", "PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT"):
        environment.pop(name, None)
    environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    report = tmp_path / "openlineage.xml"
    args = ["--collect-only"] if collect_only else [f"--junitxml={report}"]
    result = subprocess.run(
        [sys.executable, "-c", NETWORK_GUARD, TARGET, "-q", *args],
        cwd=INGESTION_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    if not collect_only:
        cases = ET.parse(report).findall(".//testcase")
        names = {case.get("name") for case in cases}
        assert "test_get_pipelines_list_filters_complete_events" in names
        assert "test_poll_kinesis_reads_events_from_every_shard" in names
        assert not any(case.find(tag) is not None for case in cases for tag in ("failure", "error", "skipped"))
