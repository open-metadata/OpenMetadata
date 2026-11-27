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
"""
Unit tests for the ``REST`` client's auth-token expiry normalization.

``REST._request`` converts the ``expiry`` returned by an auth callback into an
epoch via ``expiry.timestamp()``. ``.timestamp()`` on a *naive* datetime uses
the host's *local* timezone, not UTC. google-auth's ``credentials.expiry``
is a naive UTC datetime by construction (``google.auth._helpers.utcnow``
strips ``tzinfo`` for backward compatibility), so on a host west of UTC the
client used to compute ``expires_in`` several hours too far in the future
and then sent a stale Bearer token after the real expiry. These tests assert
that naive UTC expiries are now interpreted as UTC.

The timezone-dependent cases force the process timezone to a non-UTC zone
(``America/New_York``) via ``time.tzset`` so the naive/aware distinction is
observable on any POSIX host. Without that, on a UTC CI host the buggy
arithmetic is numerically identical to the fixed one and the regression
would be invisible.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import requests

from metadata.ingestion.ometa.client import REST, ClientConfig


def _ok_response() -> requests.Response:
    resp = requests.Response()
    resp.status_code = 200
    resp._content = b"{}"
    resp.headers["Content-Type"] = "application/json"
    resp.url = "https://example.com/v1/test"
    return resp


def _rest_with_auth_callback(auth_token, access_token=None, expires_in=None) -> REST:
    """A ``REST`` client whose next request answers a 200, wired so the first
    ``_request`` call triggers the auth refresh block (``access_token`` is
    falsy) and feeds the supplied ``auth_token`` callback.

    The session is mocked; no network call is made.
    """
    config = ClientConfig(
        base_url="https://example.com",
        retry=0,
        auth_token=auth_token,
        access_token=access_token,
        expires_in=expires_in,
    )
    client = REST(config)
    session = MagicMock()
    session.request.return_value = _ok_response()
    client._session = session
    return client


class TestRestExpiryNormalization:
    """The REST client must treat naive UTC datetimes returned by auth
    callbacks (e.g. google-auth's ``credentials.expiry``) as UTC, and leave
    aware datetimes alone."""

    def test_naive_utc_expiry_matches_aware_utc_expiry_on_non_utc_host(self, local_tz):
        """A naive UTC expiry must produce the same ``expires_in`` as the
        equivalent aware UTC expiry — the round-trip the bug breaks.

        Forcing the host TZ to ``America/New_York`` makes the naive-vs-aware
        skew observable on any POSIX CI runner, including UTC ones where the
        buggy and fixed arithmetic happen to be numerically equal."""
        naive_utc = datetime(2030, 6, 15, 9, 30)
        aware_utc = naive_utc.replace(tzinfo=timezone.utc)

        naive_cb = lambda: ("tok", naive_utc)  # noqa: E731
        aware_cb = lambda: ("tok", aware_utc)  # noqa: E731

        local_tz("America/New_York")
        naive_client = _rest_with_auth_callback(auth_token=naive_cb, access_token=None, expires_in=None)
        naive_client.get("/test")

        aware_client = _rest_with_auth_callback(auth_token=aware_cb, access_token=None, expires_in=None)
        aware_client.get("/test")

        # Pre-fix, on a New_York host naive drifted +5h from aware. The fix
        # collapses that gap: naive == aware == the canonical UTC epoch - 120.
        assert naive_client.config.expires_in == aware_client.config.expires_in
        assert naive_client.config.expires_in == aware_utc.timestamp() - 120

    def test_aware_non_utc_expiry_is_unchanged(self, local_tz):
        """An aware datetime in a non-UTC zone is still converted via its own
        ``.timestamp()`` — the fix only assumes naive datetimes are UTC, it
        does not reinterpret an already-aware datetime."""
        from zoneinfo import ZoneInfo

        aware_ny = datetime(2030, 1, 1, 10, 0, tzinfo=ZoneInfo("America/New_York"))  # 10:00 EST = 15:00 UTC
        expected = aware_ny.timestamp() - 120  # equals 15:00 UTC epoch - 120
        cb = lambda: ("tok", aware_ny)  # noqa: E731

        client = _rest_with_auth_callback(auth_token=cb, access_token=None, expires_in=None)
        # Drive under a *different* host TZ to prove the tzinfo-aware value is
        # taken literally, not reinterpreted as host-local.
        local_tz("Asia/Kolkata")
        client.get("/test")

        assert client.config.expires_in == expected
        assert client.config.expires_in == datetime(2030, 1, 1, 15, 0, tzinfo=timezone.utc).timestamp() - 120
