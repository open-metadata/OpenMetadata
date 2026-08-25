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

from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient

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
