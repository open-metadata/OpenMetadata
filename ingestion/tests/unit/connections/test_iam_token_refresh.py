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
Characterization tests for the SHARED RDS IAM auth path in ``builders.py``.

RDS IAM auth tokens expire after ~15 minutes. ``get_connection_url_common`` mints
the token once and bakes it into the connection URL string, so a single engine
reuses one frozen token for every pooled connection and cannot refresh it.

The MySQL connector now works around this at the connector level (it builds the
engine without a token in the URL and attaches a ``do_connect`` listener that
injects a fresh token per connection) — see
``tests/unit/source/database/test_mysql_iam.py``.

These tests pin the behaviour of the SHARED helper, which is still token-frozen
and is the remaining gap for the other RDS connectors that go through it
(Postgres, Redshift, Greenplum, Timescale). They are expected to FAIL — and
should be flipped to assert refreshed behaviour — once the shared path is fixed
too. ``test_iam_token_is_used_for_authentication`` is the invariant that holds
either way.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import (
    AWSCredentials,
)
from metadata.ingestion.connections import builders

IAM_TOKEN = "iam-token-v1"
HOST = "myrds.abc.us-east-1.rds.amazonaws.com"
PORT = "3306"
USERNAME = "iam_user"
REGION = "us-east-1"


def _iam_connection() -> MysqlConnection:
    return MysqlConnection(
        username=USERNAME,
        hostPort=f"{HOST}:{PORT}",
        authType=IamAuthConfigurationSource(awsConfig=AWSCredentials(awsRegion=REGION)),
    )


@pytest.fixture
def mock_rds_token():
    """Patch AWSClient so generate_db_auth_token returns a fixed token and is counted."""
    with patch.object(builders, "AWSClient") as mock_aws_client:
        rds_client = MagicMock()
        rds_client.generate_db_auth_token.return_value = IAM_TOKEN
        mock_aws_client.return_value.get_rds_client.return_value = rds_client
        yield rds_client


class TestRdsIamTokenRefresh:
    def test_iam_token_is_used_for_authentication(self, mock_rds_token):
        """Invariant: the generated IAM token authenticates the connection.

        Holds before and after the B1 fix.
        """
        url = builders.get_connection_url_common(_iam_connection())

        assert IAM_TOKEN in url
        assert mock_rds_token.generate_db_auth_token.call_args.kwargs == {
            "DBHostname": HOST,
            "Port": PORT,
            "DBUsername": USERNAME,
            "Region": REGION,
        }

    def test_iam_token_is_generated_once_and_frozen_in_url(self, mock_rds_token):
        """Documents the remaining shared-path gap: token baked into the URL string.

        ``get_connection_url_common`` embeds the token in the URL, so every engine
        built from it reuses that single token for its whole lifetime — it is never
        refreshed and goes stale after the ~15 min RDS IAM token TTL. The MySQL
        connector bypasses this path; the connectors that still rely on it do not.

        EXPECTED TO FAIL once the shared path is fixed to mint a token per
        connection rather than embedding it in the URL.
        """
        conn = _iam_connection()

        first_url = builders.get_connection_url_common(conn)
        second_url = builders.get_connection_url_common(conn)

        assert IAM_TOKEN in first_url, "token is embedded directly in the URL (the bug)"
        assert first_url == second_url, "same frozen token is reused, never refreshed"

    def test_no_do_connect_listener_is_registered_for_iam(self, mock_rds_token):
        """Documents the shared-path gap: no per-connection token injection hook.

        The shared ``create_generic_db_connection`` does not attach a ``do_connect``
        listener for IAM, so an engine built purely through it cannot refresh the
        baked-in token once it expires. (The MySQL connector adds this listener
        itself; see test_mysql_iam.py.)

        EXPECTED TO FAIL once the shared path grows its own IAM listener.
        """
        with patch.object(builders, "listen") as mock_listen:
            builders.create_generic_db_connection(
                connection=_iam_connection(),
                get_connection_url_fn=builders.get_connection_url_common,
                get_connection_args_fn=builders.get_connection_args_common,
            )

        do_connect_registrations = [call for call in mock_listen.call_args_list if "do_connect" in call.args]
        assert not do_connect_registrations, (
            "no do_connect listener is wired for IAM today — this is the gap B1 "
            "describes; once fixed, invert this assertion"
        )
