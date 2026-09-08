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
"""Unit tests for Domo Dashboard connection handling."""

from unittest.mock import MagicMock

import pytest

from metadata.clients.domo_client import DomoClient
from metadata.generated.schema.entity.services.connections.dashboard.domoDashboardConnection import (
    DomoDashboardConnection as DomoDashboardConnectionConfig,
)

DEVELOPER_TOKEN = "domo-developer-token"


def test_domo_client_sends_unwrapped_developer_token():
    config = DomoDashboardConnectionConfig(
        clientId="client-id",
        secretToken="client-secret",
        accessToken=DEVELOPER_TOKEN,
        instanceDomain="https://example.domo.com",
    )
    client = DomoClient(config)
    client.client = MagicMock()

    client.test_list_cards()

    headers = client.client.get.call_args.kwargs["headers"]
    assert headers["X-DOMO-Developer-Token"] == DEVELOPER_TOKEN


@pytest.mark.parametrize("second_token", ["other-developer-token", None])
def test_domo_clients_keep_developer_tokens_isolated(second_token):
    first_client = DomoClient(
        DomoDashboardConnectionConfig(
            clientId="first-client-id",
            secretToken="first-client-secret",
            accessToken=DEVELOPER_TOKEN,
            instanceDomain="https://first.example.domo.com",
        )
    )
    first_client.client = MagicMock()

    DomoClient(
        DomoDashboardConnectionConfig(
            clientId="second-client-id",
            secretToken="second-client-secret",
            accessToken=second_token,
            instanceDomain="https://second.example.domo.com",
        )
    )

    first_client.test_list_cards()

    headers = first_client.client.get.call_args.kwargs["headers"]
    assert headers["X-DOMO-Developer-Token"] == DEVELOPER_TOKEN
