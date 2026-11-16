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
"""Offline guards and deterministic polling for framework tests."""

import socket
from types import SimpleNamespace

import pytest

from ..runtime import expect


def pytest_configure(config):
    config.pluginmanager.import_plugin("pytester")


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def reject_connection(*args, **kwargs):
        raise AssertionError("Framework meta-tests must not access the network")

    monkeypatch.setattr(socket.socket, "connect", reject_connection)
    monkeypatch.setattr(socket.socket, "connect_ex", reject_connection)
    for name in ("getaddrinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr", "getnameinfo"):
        monkeypatch.setattr(socket, name, reject_connection)


@pytest.fixture
def polling_clock(monkeypatch):
    elapsed = 0.0

    def advance(seconds):
        nonlocal elapsed
        elapsed += seconds

    clock = SimpleNamespace(monotonic=lambda: elapsed, sleep=advance)
    monkeypatch.setattr(expect, "time", clock)
    return clock
