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
"""Unit tests for the REST check helpers."""

import pytest
import requests

from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.rest import (
    DEFAULT_LIST_CAP,
    call_endpoint,
    fetch_list,
    verify_access,
)
from metadata.core.connections.test_connection.records import Diagnosis


def _raise(error: Exception):
    def call():
        raise error

    return call


def test_verify_access_reports_the_command_it_ran():
    evidence = verify_access(lambda: None, command="POST /login")
    assert evidence.summary == "authenticated"
    assert evidence.command == "POST /login"


def test_verify_access_carries_the_command_on_failure():
    cause = requests.HTTPError("401")
    with pytest.raises(CheckError) as failure:
        verify_access(_raise(cause), command="POST /login")
    assert failure.value.cause is cause
    assert failure.value.evidence.command == "POST /login"


def test_call_endpoint_hands_the_result_back():
    assert call_endpoint(lambda: {"version": "4.0"}, command="GET /version") == {"version": "4.0"}


def test_call_endpoint_carries_the_command_on_failure():
    with pytest.raises(CheckError) as failure:
        call_endpoint(_raise(ValueError("boom")), command="GET /version")
    assert failure.value.evidence.command == "GET /version"


def test_fetch_list_counts_what_the_endpoint_returned():
    evidence = fetch_list(lambda: [1, 2, 3], noun="dashboard", command="GET /dashboards")
    assert evidence.summary == "3 dashboards enumerated"
    assert evidence.command == "GET /dashboards"


def test_fetch_list_reports_a_floor_at_the_cap():
    evidence = fetch_list(lambda: list(range(500)), noun="dashboard", command="GET /dashboards")
    assert evidence.summary == f"{DEFAULT_LIST_CAP}+ dashboards enumerated"


def test_fetch_list_passes_without_a_caveat_when_none_is_offered():
    evidence = fetch_list(list, noun="job", command="GET /jobs")
    assert evidence.summary == "0 jobs enumerated"
    assert evidence.caveat is None


def test_fetch_list_raises_the_caveat_only_when_empty():
    caveat = Diagnosis(title="No jobs visible")
    assert fetch_list(list, noun="job", command="GET /jobs", empty_caveat=caveat).caveat is caveat
    assert fetch_list(lambda: [1], noun="job", command="GET /jobs", empty_caveat=caveat).caveat is None


def test_fetch_list_treats_a_none_result_as_empty():
    evidence = fetch_list(lambda: None, noun="job", command="GET /jobs")
    assert evidence.summary == "0 jobs enumerated"


def test_fetch_list_carries_the_command_on_failure():
    with pytest.raises(CheckError) as failure:
        fetch_list(_raise(requests.ConnectionError("down")), noun="job", command="GET /jobs")
    assert failure.value.evidence.command == "GET /jobs"
