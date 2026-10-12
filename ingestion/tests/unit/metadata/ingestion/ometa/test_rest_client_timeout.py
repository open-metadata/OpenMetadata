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
"""Verify the ingestion recipe's OpenMetadata request timeout."""

from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


@patch("metadata.ingestion.ometa.ometa_api.SecretsManagerFactory")
@patch("metadata.ingestion.ometa.ometa_api.OpenMetadataAuthenticationProvider.create")
@patch.object(OpenMetadata, "log_user_name_from_jwt_token")
@patch("metadata.ingestion.ometa.client.requests.Session.request")
def test_recipe_timeout_reaches_http_request(
    mock_request: Mock,
    _mock_log_user: Mock,
    mock_auth_provider: Mock,
    _mock_secrets_manager: Mock,
) -> None:
    """Pass a recipe timeout to the underlying Requests session."""
    connection = OpenMetadataConnection.model_validate(
        {
            "hostPort": "http://localhost:8585/api",
            "timeout": 60,
            "enableVersionValidation": False,
        }
    )
    mock_auth_provider.return_value.get_access_token.return_value = ("token", 3600)
    mock_request.return_value.text = '{"status": "ok"}'
    mock_request.return_value.json.return_value = {"status": "ok"}

    metadata = OpenMetadata(connection)
    metadata.client.get("/test")

    assert mock_request.call_args.kwargs["timeout"] == 60

    overridden = OpenMetadata(
        connection, additional_client_config_arguments={"timeout": 30}
    )
    assert overridden.client.config.timeout == 30
