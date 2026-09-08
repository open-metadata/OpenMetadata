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
Tests for Redshift IAM authentication credential refresh (issue #30541).

Redshift temporary credentials from GetClusterCredentials / GetCredentials expire
after ~15 minutes. The connector must inject a fresh credential on every new
connection (via a SQLAlchemy ``do_connect`` listener) instead of baking a single
credential into the connection URL, so that connections opened later in a long
ingestion still authenticate successfully.
"""

import datetime
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import pytest

import metadata.ingestion.source.database.redshift.connection as connection_module
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import (
    AWSCredentials,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.redshift.connection import (
    RedshiftIamCredentialManager,
    _build_iam_engine,
)
from metadata.ingestion.source.database.redshift.models import RedshiftIamCredential

PROVISIONED_HOST = "my-cluster.abc123.us-east-1.redshift.amazonaws.com"
SERVERLESS_HOST = "my-workgroup.123456789012.us-east-1.redshift-serverless.amazonaws.com"
USERNAME = "admin"
REGION = "us-east-1"


def _iam_connection(host: str = PROVISIONED_HOST, **kwargs) -> RedshiftConnection:
    kwargs.setdefault("username", USERNAME)
    kwargs.setdefault("database", "dev")
    return RedshiftConnection(
        hostPort=f"{host}:5439",
        authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion=REGION)),
        **kwargs,
    )


def _future(minutes: int = 14) -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes)


class TestRedshiftIamEngine:
    """The connector wires a per-connection credential-refresh listener for IAM auth."""

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_credentials_are_not_baked_into_url(self, mock_create, mock_listen, mock_manager):
        connection = _iam_connection(database="mydb")

        _build_iam_engine(connection)

        url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
        url = url_fn(connection)
        assert url == f"redshift+psycopg2://{USERNAME}@{PROVISIONED_HOST}:5439/mydb"

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_url_does_not_call_credentials_api(self, mock_create, mock_listen, mock_manager):
        with patch.object(connection_module, "AWSClient") as mock_aws_client:
            connection = _iam_connection(database="mydb")

            _build_iam_engine(connection)
            url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
            url_fn(connection)

            mock_aws_client.assert_not_called()

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_url_without_database_omits_credentials(self, mock_create, mock_listen, mock_manager):
        connection = _iam_connection(database="")

        _build_iam_engine(connection)

        url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
        url = url_fn(connection)
        assert url == f"redshift+psycopg2://{USERNAME}@{PROVISIONED_HOST}:5439"

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_username_is_url_encoded(self, mock_create, mock_listen, mock_manager):
        connection = _iam_connection(username="iam@user/db", database="mydb")

        _build_iam_engine(connection)

        url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
        url = url_fn(connection)
        assert "iam%40user%2Fdb" in url
        assert "iam@user/db@" not in url

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_do_connect_listener_is_registered(self, mock_create, mock_listen, mock_manager):
        _build_iam_engine(_iam_connection(database="mydb"))

        event_name = mock_listen.call_args.args[1]
        assert event_name == "do_connect"

    @patch.object(connection_module, "RedshiftIamCredentialManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_listener_injects_fresh_credentials_per_connection(self, mock_create, mock_listen, mock_manager):
        mock_manager.return_value.get_credentials.side_effect = [
            RedshiftIamCredential(user="IAM:admin", password="pw-1", expiration=_future()),
            RedshiftIamCredential(user="IAM:admin", password="pw-2", expiration=_future()),
        ]

        _build_iam_engine(_iam_connection(database="mydb"))
        listener = mock_listen.call_args.args[2]

        first_cparams = {}
        listener(None, None, None, first_cparams)
        second_cparams = {}
        listener(None, None, None, second_cparams)

        assert first_cparams["user"] == "IAM:admin"
        assert first_cparams["password"] == "pw-1"
        assert second_cparams["password"] == "pw-2"
        assert mock_manager.return_value.get_credentials.call_count == 2


class TestRedshiftIamCredentialManager:
    """The manager caches a credential and refreshes it before expiry."""

    def test_first_call_fetches_credentials(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.return_value = {
                "DbUser": "IAM:admin",
                "DbPassword": "temp-pw",
                "Expiration": _future(),
            }
            mock_aws.return_value.get_redshift_client.return_value = client

            credential = RedshiftIamCredentialManager(_iam_connection()).get_credentials()

            assert credential.user == "IAM:admin"
            assert credential.password == "temp-pw"
            assert client.get_cluster_credentials.call_count == 1

    def test_credentials_cached_within_ttl(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.return_value = {
                "DbUser": "IAM:admin",
                "DbPassword": "temp-pw",
                "Expiration": _future(),
            }
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            manager.get_credentials()
            manager.get_credentials()

            assert client.get_cluster_credentials.call_count == 1

    def test_credentials_refreshed_after_expiry(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.side_effect = [
                {"DbUser": "IAM:admin", "DbPassword": "pw-1", "Expiration": _future()},
                {"DbUser": "IAM:admin", "DbPassword": "pw-2", "Expiration": _future()},
            ]
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            manager.get_credentials()
            manager._expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1)
            second = manager.get_credentials()

            assert client.get_cluster_credentials.call_count == 2
            assert second.password == "pw-2"

    def test_missing_expiration_falls_back_to_default_ttl(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.return_value = {
                "DbUser": "IAM:admin",
                "DbPassword": "temp-pw",
            }
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            manager.get_credentials()
            manager.get_credentials()

            assert client.get_cluster_credentials.call_count == 1
            assert manager._expires_at is not None

    def test_serverless_expiration_is_honoured(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_credentials.return_value = {
                "dbUser": "IAMR:admin",
                "dbPassword": "serverless-pw",
                "expiration": _future(),
            }
            mock_aws.return_value.get_redshift_serverless_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection(SERVERLESS_HOST))

            credential = manager.get_credentials()
            manager.get_credentials()

            assert credential.user == "IAMR:admin"
            assert client.get_credentials.call_count == 1

    def test_concurrent_get_credentials_refreshes_only_once(self):
        """Many threads hitting a cold manager must trigger a single fetch.

        Each worker thread calls engine.connect() -> the shared do_connect listener
        -> the shared manager's get_credentials(). Without locking, threads racing on
        a cold credential each call the credentials API. A slow fetch widens the race
        window so the assertion is meaningful.
        """

        def slow_fetch(**_kwargs):
            time.sleep(0.05)
            return {"DbUser": "IAM:admin", "DbPassword": "temp-pw", "Expiration": _future()}

        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.side_effect = slow_fetch
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            barrier = threading.Barrier(10)

            def call():
                barrier.wait()
                return manager.get_credentials()

            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(call) for _ in range(10)]
                results = [future.result() for future in futures]

            assert client.get_cluster_credentials.call_count == 1
            assert all(credential.password == "temp-pw" for credential in results)

    def test_refresh_failure_reuses_still_valid_credential(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.side_effect = [
                {"DbUser": "IAM:admin", "DbPassword": "pw-1", "Expiration": _future()},
                Exception("transient AWS error"),
            ]
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            first = manager.get_credentials()
            # Within the refresh window but not yet expired: the proactive refresh fires
            # and fails, and the still-valid cached credential must be reused.
            manager._expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=2)
            second = manager.get_credentials()

            assert client.get_cluster_credentials.call_count == 2
            assert second is first

    def test_refresh_failure_raises_when_credential_expired(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.side_effect = [
                {"DbUser": "IAM:admin", "DbPassword": "pw-1", "Expiration": _future()},
                Exception("transient AWS error"),
            ]
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            manager.get_credentials()
            manager._expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1)
            with pytest.raises(SourceConnectionException):
                manager.get_credentials()

    def test_naive_expiration_is_normalized_to_utc(self):
        with patch.object(connection_module, "AWSClient") as mock_aws:
            client = MagicMock()
            client.get_cluster_credentials.return_value = {
                "DbUser": "IAM:admin",
                "DbPassword": "temp-pw",
                # tz-naive on purpose: the manager must normalize it to UTC
                "Expiration": datetime.datetime.now() + datetime.timedelta(minutes=14),
            }
            mock_aws.return_value.get_redshift_client.return_value = client
            manager = RedshiftIamCredentialManager(_iam_connection())

            manager.get_credentials()

            assert manager._expires_at.tzinfo is not None
            # _needs_refresh subtracts a tz-aware "now"; this must not raise on a naive input.
            assert manager._needs_refresh() is False
