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

"""
Test PowerBI API Client
"""

import logging
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient
from metadata.utils.logger import utils_logger

CONNECTION_CONFIG = {
    "clientId": "client_id",
    "clientSecret": "client_secret",
    "tenantId": "tenant_id",
}


@pytest.mark.parametrize(
    "configured, expected",
    [(None, 100), (1, 1), (100, 100), (5000, 5000), (100_000, 5000)],
    ids=["null", "one", "old-ceiling", "at-ceiling", "above-ceiling"],
)
@patch("metadata.ingestion.source.dashboard.powerbi.client.msal")
def test_page_size_is_clamped_to_the_groups_ceiling(_msal, configured, expected):
    """GetGroupsAsAdmin documents a $top ceiling of 5000, and the field is nullable."""
    connection = PowerBIConnection(**CONNECTION_CONFIG, pagination_entity_per_page=configured)

    assert PowerBiApiClient(connection).pagination_entity_per_page == expected


@pytest.mark.parametrize(
    "response, expected",
    [
        (
            {"@odata.context": "ctx", "value": [{"name": "ReportSection", "displayName": "Overview", "order": 0}]},
            [("ReportSection", "Overview")],
        ),
        ({"@odata.context": "ctx", "value": None}, []),
        ({"@odata.context": "ctx", "value": []}, []),
        (None, None),
        (ConnectionError("connection reset"), None),
    ],
    ids=["pages", "null-value", "no-pages", "error-status", "network-error"],
)
@patch("metadata.ingestion.source.dashboard.powerbi.client.msal")
def test_fetch_report_pages_tells_no_pages_from_a_failed_read(_msal, response, expected):
    """A report with no pages loses its page charts; one whose pages cannot be read keeps them."""
    api_client = PowerBiApiClient(PowerBIConnection(**CONNECTION_CONFIG))
    api_client.client = MagicMock()
    api_client.client.get.side_effect = [response]

    pages = api_client.fetch_report_pages("ws-1", "report-1")

    assert (None if pages is None else [(page.name, page.displayName) for page in pages]) == expected
    api_client.client.get.assert_called_once_with("/myorg/groups/ws-1/reports/report-1/pages")


@pytest.mark.parametrize(
    "response, logged",
    [
        ({"@odata.context": "ctx", "value": [{"name": "ReportSection", "displayName": "Overview"}]}, False),
        ({"@odata.context": "ctx", "value": None}, True),
        ({"@odata.context": "ctx", "value": []}, True),
        (None, True),
    ],
    ids=["pages", "null-value", "no-pages", "empty-response"],
)
@patch("metadata.ingestion.source.dashboard.powerbi.client.msal")
def test_fetch_report_pages_logs_an_empty_response(_msal, response, logged, caplog):
    api_client = PowerBiApiClient(PowerBIConnection(**CONNECTION_CONFIG))
    api_client.client = MagicMock()
    api_client.client.get.return_value = response

    with caplog.at_level(logging.DEBUG, logger=utils_logger().name):
        api_client.fetch_report_pages("ws-1", "report-1")

    empty_logs = [
        record
        for record in caplog.records
        if record.levelno == logging.DEBUG and "for report [report-1] in workspace [ws-1]" in record.getMessage()
    ]
    assert bool(empty_logs) is logged
