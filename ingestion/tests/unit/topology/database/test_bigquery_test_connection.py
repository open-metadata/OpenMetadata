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
Regression tests for the BigQuery test-connection fix:

- multi-project test connection scopes each probe to its own project
- ``_test_connection`` drives the runner once per project with a valid timeout
  so a service-connection object can never leak into ``timeout_seconds`` again
- the engine built for the test connection is always disposed
"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection as BigQueryConnectionConfig,
)
from metadata.ingestion.source.database.bigquery.connection import BigQueryConnection
from metadata.ingestion.source.database.bigquery.helper import (
    clone_connection_for_project,
)
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource

_CONNECTION_MODULE = "metadata.ingestion.source.database.bigquery.connection"
_METADATA_MODULE = "metadata.ingestion.source.database.bigquery.metadata"
_BASE_CONNECTION_MODULE = "metadata.ingestion.connections.connection"

_GCP_CONFIG = {
    "type": "service_account",
    "projectId": "placeholder",
    "privateKeyId": "key-id",
    "privateKey": "private-key",
    "clientEmail": "user@example.com",
    "clientId": "1234",
    "authUri": "https://accounts.google.com/o/oauth2/auth",
    "tokenUri": "https://oauth2.googleapis.com/token",
    "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
    "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
}


def _bq_config(project_id) -> BigQueryConnectionConfig:
    return BigQueryConnectionConfig.model_validate(
        {"type": "BigQuery", "credentials": {"gcpConfig": {**_GCP_CONFIG, "projectId": project_id}}}
    )


def test_clone_connection_scopes_to_single_project():
    connection = _bq_config(["proj-a", "proj-b"])

    cloned = clone_connection_for_project("proj-a", connection)

    assert cloned.credentials.gcpConfig.projectId.root == "proj-a"
    # the original multi-project connection must stay untouched (deepcopy isolation)
    assert connection.credentials.gcpConfig.projectId.root == ["proj-a", "proj-b"]


@patch(f"{_BASE_CONNECTION_MODULE}.TestConnectionRunner")
@patch(f"{_CONNECTION_MODULE}.create_generic_db_connection")
@patch(f"{_CONNECTION_MODULE}.set_google_credentials")
def test_test_connection_probes_each_project_with_a_valid_timeout(mock_creds, mock_create, mock_runner):
    mock_create.return_value = MagicMock()
    source = object.__new__(BigquerySource)
    source.metadata = MagicMock()
    source.service_connection = _bq_config(["proj-a", "proj-b"])
    source.project_ids = ["proj-a", "proj-b"]
    source.temp_credentials_file_path = []

    # real clone_connection_for_project + get_test_connection_fn path; only the
    # external boundaries (engine factory, credentials, runner) are stubbed
    BigquerySource._test_connection(source)

    assert mock_runner.call_count == 2
    for call in mock_runner.call_args_list:
        service_type, timeout_seconds = call.args[1], call.args[2]
        assert service_type == "BigQuery"
        # the regression guard: the original bug passed the service connection
        # positionally into timeout_seconds, which then reached signal.alarm().
        # A valid timeout reaching the runner proves the signature is right.
        assert isinstance(timeout_seconds, int)


@patch(f"{_CONNECTION_MODULE}.create_generic_db_connection")
@patch(f"{_CONNECTION_MODULE}.set_google_credentials")
def test_close_disposes_engine(mock_creds, mock_create):
    engine = MagicMock()
    mock_create.return_value = engine

    connection = BigQueryConnection(_bq_config("proj-a"))
    _ = connection.client
    connection.close()

    mock_create.assert_called_once()
    # both halves of the fix: _get_client registers engine.dispose AND
    # close() unwinds it, so the engine built for a test connection is always released.
    engine.dispose.assert_called_once()
