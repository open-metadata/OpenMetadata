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
"""Unit tests for Athena connection handling."""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection as AthenaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaScheme,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.athena.connection import AthenaConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.athena.connection"


def _config(**kwargs) -> AthenaConnectionConfig:
    base = {
        "awsConfig": AWSCredentials(awsAccessKeyId="key", awsRegion="us-east-2", awsSecretAccessKey="secret_key"),
        "s3StagingDir": "s3://postgres/input/",
        "workgroup": "primary",
        "scheme": AthenaScheme.awsathena_rest,
    }
    base.update(kwargs)
    return AthenaConnectionConfig(**base)


def test_athena_connection_is_base_connection():
    assert issubclass(AthenaConnection, BaseConnection)


def test_get_client_uses_the_class_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = AthenaConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_test_connection_disposes_the_engine():
    conn = AthenaConnection(_config())
    conn._client = MagicMock()
    with (
        patch(f"{CONNECTION_MODULE}.test_connection_steps"),
        patch(f"{CONNECTION_MODULE}.kill_active_connections") as mock_kill,
    ):
        conn.test_connection(metadata=MagicMock())
    mock_kill.assert_called_once_with(conn._client)


def test_athena_url():
    expected = (
        "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443"
        "?s3_staging_dir=s3%3A%2F%2Fpostgres%2Finput%2F&work_group=primary"
    )
    assert AthenaConnection.get_connection_url(_config()) == expected


def test_athena_url_other_staging_dir():
    expected = (
        "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443"
        "?s3_staging_dir=s3%3A%2F%2Fpostgres%2Fintput%2F&work_group=primary"
    )
    assert AthenaConnection.get_connection_url(_config(s3StagingDir="s3://postgres/intput/")) == expected
