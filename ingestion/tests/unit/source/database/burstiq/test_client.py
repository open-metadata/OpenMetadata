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
    client.access_token = "test-token"
    client.token_expires_at = None
    client._chain_metrics = None
    return client


def _http_error(body: str) -> requests.exceptions.HTTPError:
    response = requests.Response()
    response.status_code = 400
    response._content = body.encode()
    return requests.exceptions.HTTPError("400 Client Error", response=response)


# --- validate_system_wallet ---


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


def test_validate_system_wallet_absent_raises():
    """No wallet configured → raises with 'not configured' message, not silent pass."""
    client = _build_client(wallet_id=None)

    with pytest.raises(ConnectionError) as exc_info:
        client.validate_system_wallet()

    assert "not configured" in str(exc_info.value).lower()


def test_validate_system_wallet_passes_wallet_header_explicitly():
    """validate_system_wallet must pass the wallet header explicitly — not rely on _get_auth_header."""
    client = _build_client(wallet_id=WALLET_ID)

    with patch.object(client, "_make_request", return_value=[]) as mock_req:
        client.validate_system_wallet()

    assert mock_req.call_args.kwargs["headers"]["biq_system_wallet_id"] == WALLET_ID


def test_validate_system_wallet_defers_non_wallet_error():
    """Non-wallet 400 errors must not raise — deferred to GetDictionaries step."""
    client = _build_client(wallet_id=WALLET_ID)
    privilege_error = _http_error('{"status":400,"message":"user lacks read privileges"}')

    with patch.object(client, "_make_request", side_effect=privilege_error):
        client.validate_system_wallet()


# --- Root cause fix: wallet must not be in default auth headers ---


def test_get_auth_header_excludes_wallet():
    """Wallet must NOT appear in default headers — the root cause of the P1 bug."""
    client = _build_client(wallet_id=WALLET_ID)

    headers = client._get_auth_header()

    assert "biq_system_wallet_id" not in headers


# --- get_records_by_tql wallet header behaviour ---


def test_get_records_by_tql_sends_wallet_header_when_configured():
    """TQL queries must include the wallet header when biqSystemWalletId is set."""
    client = _build_client(wallet_id=WALLET_ID)

    with patch.object(client, "_make_request", return_value=[]) as mock_req:
        client.get_records_by_tql("mychain", limit=1)

    assert mock_req.call_args.kwargs["headers"]["biq_system_wallet_id"] == WALLET_ID


def test_get_records_by_tql_no_wallet_no_header():
    """TQL queries must not include wallet header when biqSystemWalletId is absent."""
    client = _build_client(wallet_id=None)

    with patch.object(client, "_make_request", return_value=[]) as mock_req:
        client.get_records_by_tql("mychain", limit=1)

    assert "biq_system_wallet_id" not in mock_req.call_args.kwargs.get("headers", {})
