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
"""Unit tests for the Mode API client."""

from unittest.mock import MagicMock, call

import pytest

from metadata.ingestion.source.dashboard.mode.client import ModeApiClient


def _reports(prefix: str, count: int) -> list[dict]:
    return [{"token": f"{prefix}-{index}"} for index in range(count)]


def _embedded(name: str, values: list[dict]) -> dict:
    return {"_embedded": {name: values}}


@pytest.fixture
def mode_client() -> ModeApiClient:
    api_client = ModeApiClient.__new__(ModeApiClient)
    api_client.client = MagicMock()
    return api_client


def test_fetch_all_reports_paginates_every_space(mode_client):
    first_space_page = _reports("finance", 30)
    second_space_page = _reports("finance-extra", 2)
    operations_page = _reports("operations", 1)
    mode_client.client.get.side_effect = [
        _embedded("spaces", [{"token": "finance"}, {"token": "operations"}]),
        _embedded("reports", first_space_page),
        _embedded("reports", second_space_page),
        _embedded("reports", operations_page),
    ]

    reports = mode_client.fetch_all_reports("acme", "custom")

    assert reports == first_space_page + second_space_page + operations_page
    assert mode_client.client.get.call_args_list == [
        call("/acme/spaces?filter=custom"),
        call("/acme/spaces/finance/reports?page=1"),
        call("/acme/spaces/finance/reports?page=2"),
        call("/acme/spaces/operations/reports?page=1"),
    ]


def test_fetch_all_reports_requests_page_after_exactly_thirty_results(mode_client):
    first_page = _reports("report", 30)
    mode_client.client.get.side_effect = [
        _embedded("spaces", [{"token": "space-token"}]),
        _embedded("reports", first_page),
        _embedded("reports", []),
    ]

    reports = mode_client.fetch_all_reports("acme")

    assert reports == first_page
    assert mode_client.client.get.call_args_list[-1] == call("/acme/spaces/space-token/reports?page=2")


def test_fetch_all_reports_propagates_later_page_failure(mode_client):
    mode_client.client.get.side_effect = [
        _embedded("spaces", [{"token": "space-token"}]),
        _embedded("reports", _reports("report", 30)),
        RuntimeError("Mode page request failed"),
    ]

    with pytest.raises(RuntimeError, match="Mode page request failed"):
        mode_client.fetch_all_reports("acme")
