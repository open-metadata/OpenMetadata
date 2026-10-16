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
"""Monitor — interval scheduling, lifecycle, and the never-crash guard."""

import logging
import time

from metadata.ingestion.diagnostics.monitors.monitor import Monitor


def test_monitor_runs_check_until_stopped():
    calls = []
    monitor = Monitor("diag-test", 0.02, lambda: calls.append(1))
    monitor.start()
    time.sleep(0.1)
    monitor.stop()
    monitor.join(timeout=1.0)
    assert not monitor.is_alive()
    assert len(calls) >= 2


def test_monitor_logs_and_continues_when_check_raises(caplog):
    state = {"n": 0}

    def boom():
        state["n"] += 1
        raise ValueError("kaboom")

    monitor = Monitor("diag-test", 0.02, boom)
    with caplog.at_level(logging.ERROR, logger="metadata.Diagnostics"):
        monitor.start()
        time.sleep(0.1)
        monitor.stop()
        monitor.join(timeout=1.0)

    # The guard caught each raise and the loop kept going (multiple calls)...
    assert state["n"] >= 2
    # ...logging the error under the name-derived label.
    messages = "\n".join(r.getMessage() for r in caplog.records)
    assert "diag.test.error" in messages
    assert "kaboom" in messages
