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
"""HTTP introspection tracker behavior."""

from contextlib import suppress

from metadata.ingestion.diagnostics.http_introspect import HttpTracker, get_global_tracker


def test_request_appears_in_snapshot_while_in_flight():
    tracker = HttpTracker()
    assert tracker.active_count() == 0
    with tracker.request("GET", "/api/v1/tables"):
        assert tracker.active_count() == 1
        active = tracker.snapshot()
        assert len(active) == 1
        _tid, method, url, age = active[0]
        assert method == "GET"
        assert url == "/api/v1/tables"
        assert age >= 0
    assert tracker.active_count() == 0


def test_request_cleared_on_exception():
    tracker = HttpTracker()

    def _fail() -> None:
        with tracker.request("POST", "/fail"):
            raise RuntimeError("boom")

    with suppress(RuntimeError):
        _fail()
    assert tracker.active_count() == 0


def test_get_global_tracker_returns_none_when_not_installed():
    from metadata.ingestion import diagnostics

    diagnostics.shutdown()
    assert get_global_tracker() is None
