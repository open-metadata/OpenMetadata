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
"""Unit tests for BurstIQClient system-wallet validation used by test connection."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
import requests

client_module = pytest.importorskip("metadata.ingestion.source.database.burstiq.client")

BurstIQClient = client_module.BurstIQClient

WALLET_ID = "72163e0d-c212-4954-afa9-e4699a3d3158"
WALLET_ERROR_BODY = (
    '{"status":400,"error":"BAD_REQUEST","message":"Unable to elevate to system '
    f'wallet : {WALLET_ID}. system wallet {WALLET_ID} does not exist"}}'
)


def _build_client(wallet_id=None) -> "BurstIQClient":
    client = BurstIQClient.__new__(BurstIQClient)
    client.config = SimpleNamespace(biqSystemWalletId=wallet_id)
    client.api_base_url = "https://api.burstiq.com"
    return client


def _http_error(body: str) -> requests.exceptions.HTTPError:
    response = requests.Response()
    response.status_code = 400
    response._content = body.encode()
    return requests.exceptions.HTTPError("400 Client Error", response=response)


def test_validate_system_wallet_invalid_raises_actionable_error():
    client = _build_client(wallet_id=WALLET_ID)

    with (
        patch.object(client, "_make_request", side_effect=_http_error(WALLET_ERROR_BODY)),
        pytest.raises(ConnectionError) as exc_info,
    ):
        client.validate_system_wallet()

    message = str(exc_info.value)
    assert WALLET_ID in message
    assert "biqSystemWalletId" in message
    assert "does not exist" in message


def test_validate_system_wallet_valid_passes():
    client = _build_client(wallet_id=WALLET_ID)

    with patch.object(client, "_make_request", return_value=[]):
        client.validate_system_wallet()


def test_validate_system_wallet_absent_skips_request():
    client = _build_client(wallet_id=None)

    with patch.object(client, "_make_request") as mocked_request:
        client.validate_system_wallet()

    mocked_request.assert_not_called()


def test_validate_system_wallet_defers_non_wallet_error():
    client = _build_client(wallet_id=WALLET_ID)
    privilege_error = _http_error('{"status":400,"message":"user lacks read privileges"}')

    with patch.object(client, "_make_request", side_effect=privilege_error):
        client.validate_system_wallet()


def test_safe_response_body_handles_none():
    assert BurstIQClient._safe_response_body(None) == ""


def test_safe_response_body_truncates_long_body():
    response = requests.Response()
    response._content = ("x" * 1000).encode()
    body = BurstIQClient._safe_response_body(response)

    assert "truncated" in body
