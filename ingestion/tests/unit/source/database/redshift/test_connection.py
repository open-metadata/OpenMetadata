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
"""Unit tests for the Redshift BaseConnection wiring.

The IAM/basic URL building and credential fetching are covered in
tests/unit/topology/database/test_redshift_connection.py.
"""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection as RedshiftConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.redshift.connection import RedshiftConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.redshift.connection"


def _config() -> RedshiftConnectionConfig:
    return RedshiftConnectionConfig(
        hostPort="my-cluster.abc123.us-east-1.redshift.amazonaws.com:5439",
        username="admin",
        authType=BasicAuth(password="secret"),
        database="mydb",
    )


def test_redshift_connection_is_base_connection():
    assert issubclass(RedshiftConnection, BaseConnection)


def test_get_client_uses_the_redshift_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = RedshiftConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_redshift_connection_url"
