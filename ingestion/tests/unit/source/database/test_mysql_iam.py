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
Tests for MySQL RDS IAM authentication (finding B1 fix).

RDS IAM tokens expire after ~15 minutes. The MySQL connector must inject a fresh
token on every new connection (via a SQLAlchemy ``do_connect`` listener) instead
of baking a single token into the connection URL, so that connections opened
later in a long ingestion still authenticate successfully.
"""

import datetime
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

import pytest

import metadata.ingestion.source.database.mysql.connection as connection_module
from metadata.clients.aws_client import RdsIamAuthTokenManager
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import (
    AWSCredentials,
)
from metadata.ingestion.source.database.mysql.connection import MySQLConnection

HOST = "myrds.abc.us-east-2.rds.amazonaws.com"
PORT = "3306"
USERNAME = "iam_user"
REGION = "us-east-2"


def _iam_connection() -> MysqlConnection:
    return MysqlConnection(
        username=USERNAME,
        hostPort=f"{HOST}:{PORT}",
        authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion=REGION)),
    )


def _make_mysql_connection(connection: MysqlConnection) -> MySQLConnection:
    mysql_conn = MySQLConnection.__new__(MySQLConnection)
    mysql_conn.service_connection = connection
    return mysql_conn


def _presigned_token(issued_at: datetime.datetime, expires_seconds: int = 900) -> str:
    amz_date = issued_at.strftime("%Y%m%dT%H%M%SZ")
    return f"{HOST}:{PORT}/?Action=connect&DBUser={USERNAME}&X-Amz-Date={amz_date}&X-Amz-Expires={expires_seconds}"


class TestMySQLIamEngine:
    """The connector wires a per-connection token-refresh listener for IAM auth."""

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_iam_token_is_not_baked_into_url(self, mock_create, mock_listen, mock_token_manager):
        mock_token_manager.return_value.get_token.return_value = "FRESH_TOKEN"
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)

        url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
        url = url_fn(mysql_conn.service_connection)
        assert "FRESH_TOKEN" not in url
        assert url == f"mysql+pymysql://{USERNAME}@{HOST}:{PORT}"

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_username_is_url_encoded(self, mock_create, mock_listen, mock_token_manager):
        connection = MysqlConnection(
            username="iam@user/db",
            hostPort=f"{HOST}:{PORT}",
            authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion=REGION)),
        )
        mysql_conn = _make_mysql_connection(connection)

        mysql_conn._get_iam_engine(connection)

        url_fn = mock_create.call_args.kwargs["get_connection_url_fn"]
        url = url_fn(connection)
        assert "iam%40user%2Fdb" in url
        assert "iam@user/db@" not in url

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_do_connect_listener_is_registered(self, mock_create, mock_listen, mock_token_manager):
        mock_token_manager.return_value.get_token.return_value = "FRESH_TOKEN"
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)

        event_name = mock_listen.call_args.args[1]
        assert event_name == "do_connect"

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_listener_injects_fresh_token_per_connection(self, mock_create, mock_listen, mock_token_manager):
        mock_token_manager.return_value.get_token.return_value = "FRESH_TOKEN"
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)
        listener = mock_listen.call_args.args[2]

        first_cparams = {}
        listener(None, None, None, first_cparams)
        second_cparams = {}
        listener(None, None, None, second_cparams)

        assert first_cparams["password"] == "FRESH_TOKEN"
        assert second_cparams["password"] == "FRESH_TOKEN"
        assert mock_token_manager.return_value.get_token.call_count == 2

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_listener_enables_ssl_required_by_pymysql_for_iam(self, mock_create, mock_listen, mock_token_manager):
        mock_token_manager.return_value.get_token.return_value = "FRESH_TOKEN"
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)
        listener = mock_listen.call_args.args[2]

        cparams = {}
        listener(None, None, None, cparams)
        assert cparams["ssl"]

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_listener_preserves_existing_ssl_config(self, mock_create, mock_listen, mock_token_manager):
        mock_token_manager.return_value.get_token.return_value = "FRESH_TOKEN"
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)
        listener = mock_listen.call_args.args[2]

        existing_ssl = {"ca": "/path/to/ca.pem"}
        cparams = {"ssl": existing_ssl}
        listener(None, None, None, cparams)
        assert cparams["ssl"] == existing_ssl

    @patch.object(connection_module, "RdsIamAuthTokenManager")
    @patch.object(connection_module, "listen")
    @patch.object(connection_module, "create_generic_db_connection")
    def test_token_manager_built_with_split_host_and_port(self, mock_create, mock_listen, mock_token_manager):
        mysql_conn = _make_mysql_connection(_iam_connection())

        mysql_conn._get_iam_engine(mysql_conn.service_connection)

        assert mock_token_manager.call_args.kwargs["host"] == HOST
        assert mock_token_manager.call_args.kwargs["port"] == PORT
        assert mock_token_manager.call_args.kwargs["username"] == USERNAME


class TestRdsIamAuthTokenManager:
    """The token manager caches a token and refreshes it before expiry."""

    @pytest.fixture
    def mock_rds(self):
        with patch("metadata.clients.aws_client.AWSClient") as mock_aws_client:
            rds_client = MagicMock()
            mock_aws_client.return_value.get_rds_client.return_value = rds_client
            yield rds_client

    def _manager(self) -> RdsIamAuthTokenManager:
        return RdsIamAuthTokenManager(
            host=HOST,
            port=PORT,
            username=USERNAME,
            aws_config=AWSCredentials(awsRegion=REGION),
        )

    def test_first_call_generates_token(self, mock_rds):
        now = datetime.datetime.now(datetime.timezone.utc)
        mock_rds.generate_db_auth_token.return_value = _presigned_token(now)

        token = self._manager().get_token()

        assert token == _presigned_token(now)
        assert mock_rds.generate_db_auth_token.call_count == 1

    def test_token_cached_within_ttl(self, mock_rds):
        now = datetime.datetime.now(datetime.timezone.utc)
        mock_rds.generate_db_auth_token.return_value = _presigned_token(now)

        manager = self._manager()
        manager.get_token()
        manager.get_token()

        assert mock_rds.generate_db_auth_token.call_count == 1

    def test_token_refreshed_after_expiry(self, mock_rds):
        now = datetime.datetime.now(datetime.timezone.utc)
        mock_rds.generate_db_auth_token.return_value = _presigned_token(now)

        manager = self._manager()
        manager.get_token()
        manager._expires_at = now - datetime.timedelta(seconds=1)
        manager.get_token()

        assert mock_rds.generate_db_auth_token.call_count == 2

    def test_expiry_parsed_from_presigned_url(self, mock_rds):
        now = datetime.datetime.now(datetime.timezone.utc)
        mock_rds.generate_db_auth_token.return_value = _presigned_token(now, expires_seconds=900)

        manager = self._manager()
        manager.get_token()

        seconds_until_expiry = (manager._expires_at - now).total_seconds()
        assert 890 <= seconds_until_expiry <= 910

    def test_malformed_token_falls_back_to_default_ttl(self, mock_rds):
        mock_rds.generate_db_auth_token.return_value = "not-a-presigned-url"

        manager = self._manager()
        manager.get_token()

        assert manager._expires_at is not None

    def test_concurrent_get_token_refreshes_only_once(self, mock_rds):
        """Many threads hitting a cold manager must trigger a single refresh.

        Each worker thread calls engine.connect() -> the shared do_connect listener
        -> the shared manager's get_token(). Without locking, threads racing on a
        cold/expired token each call generate_db_auth_token. A slow token generator
        widens the race window so the assertion is meaningful.
        """
        now = datetime.datetime.now(datetime.timezone.utc)

        def slow_generate(**_kwargs):
            time.sleep(0.05)
            return _presigned_token(now)

        mock_rds.generate_db_auth_token.side_effect = slow_generate
        manager = self._manager()

        barrier = threading.Barrier(10)

        def call():
            barrier.wait()
            return manager.get_token()

        with ThreadPoolExecutor(max_workers=10) as executor:
            tokens = [future.result() for future in [executor.submit(call) for _ in range(10)]]

        assert mock_rds.generate_db_auth_token.call_count == 1
        assert all(token == _presigned_token(now) for token in tokens)
