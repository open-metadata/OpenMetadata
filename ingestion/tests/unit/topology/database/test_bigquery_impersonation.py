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
Unit tests for BigQuery service account impersonation across both the
SQLAlchemy engine path (Test Connection + information_schema reads) and the
BigQuery Python client path (dataset listing / policy tags).

Regression coverage for
https://github.com/open-metadata/OpenMetadata/issues/28204
"""

from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.ingestion.source.database.bigquery.connection import get_connection_args
from metadata.ingestion.source.database.bigquery.helper import (
    get_impersonate_client_kwargs,
)
from metadata.utils.bigquery_utils import get_bigquery_client

TARGET_SA = "target-reader@my-project.iam.gserviceaccount.com"

VALID_PRIVATE_KEY = (
    "-----BEGIN RSA PRIVATE KEY-----\n"
    "MIIEpQIBAAKCAQEAw3vHG9fDIkcYB0xi2Mv4fS2gUzKR9ZRrcVNeKkqGFTT71AVB\n"
    "OzgIqYVe8b2aWODuNye6sipcrqTqOt05Esj+sxhk5McM9bE2RlxXC5QH/Bp9zxMP\n"
    "/Yksv9Ov7fdDt/loUk7sTXvI+7LDJfmRYU6MtVjyyLs7KpQIB2xBWEToU1xZY+v0\n"
    "dRC1NA+YWc+FjXbAiFAf9d4gXkYO8VmU5meixVh4C8nsjokEXk0T/HEItpZCxadk\n"
    "dZ7LKUE/HDmWCO2oNG6sCf4ET2crjSdYIfXuREopX1aQwnk7KbI4/YIdlRz1I369\n"
    "Az3+Hxlf9lLJVH3+itN4GXrR9yWWKWKDnwDPbQIDAQABAoIBAQC3X5QuTR7SN8iV\n"
    "iBUtc2D84+ECSmza5shG/UJW/6N5n0Mf53ICgBS4GNEwiYCRISa0/ILIgK6CcVb7\n"
    "suvH8F3kWNzEMui4TO0x4YsR5GH9HkioCCS224frxkLBQnL20HIIy9ok8Rpe6Zjg\n"
    "NZUnp4yczPyqSeA9l7FUbTt69uDM2Cx61m8REOpFukpnYLyZGbmNPYmikEO+rq9r\n"
    "wNID5dkSeVuQYo4MQdRavOGFUWvUYXzkEQ0A6vPyraVBfolESX8WaLNVjic7nIa3\n"
    "ujdSNojnJqGJ3gslntcmN1d4JOfydc4bja4/NdNlcOHpWDGLzY1QnaDe0Koxn8sx\n"
    "LT9MVD2NAoGBAPy7r726bKVGWcwqTzUuq1OWh5c9CAc4N2zWBBldSJyUdllUq52L\n"
    "WTyva6GRoRzCcYa/dKLLSM/k4eLf9tpxeIIfTOMsvzGtbAdm257ndMXNvfYpxCfU\n"
    "K/gUFfAUGHZ3MucTHRY6DTkJg763Sf6PubA2fqv3HhVZDK/1HGDtHlTPAoGBAMYC\n"
    "pdV7O7lAyXS/d9X4PQZ4BM+P8MbXEdGBbPPlzJ2YIb53TEmYfSj3z41u9+BNnhGP\n"
    "4uzUyAR/E4sxrA2+Ll1lPSCn+KY14WWiVGfWmC5j1ftdpkbrXstLN8NpNYzrKZwx\n"
    "jdR0ZkwvZ8B5+kJ1hK96giwWS+SJxJR3TohcQ18DAoGAJSfmv2r//BBqtURnHrd8\n"
    "wq43wvlbC8ytAVg5hA0d1r9Q4vM6w8+vz+cuWLOTTyobDKdrG1/tlXrd5r/sh9L0\n"
    "15SIdkGm3kPTxQbPNP5sQYRs8BrV1tEvoao6S3B45DnEBwrdVN42AXOvpcNGoqE4\n"
    "uHpahyeuiY7s+ZV8lZdmxSsCgYEAolr5bpmk1rjwdfGoaKEqKGuwRiBX5DHkQkxE\n"
    "8Zayt2VOBcX7nzyRI05NuEIMrLX3rZ61CktN1aH8fF02He6aRaoE/Qm9L0tujM8V\n"
    "Ni8WiLMDeR/Ifs3u4/HAv1E8v1byv0dCa7klR8J257McJ/ID4X4pzcxaXgE4ViOd\n"
    "GOHNu9ECgYEApq1zkZthEQymTUxs+lSFcubQpaXyf5ZC61cJewpWkqGDtSC+8DxE\n"
    "F/jydybWuoNHXymnvY6QywxuIooivbuib6AlgpEJeybmnWlDOZklFOD0abNZ+aNO\n"
    "dUk7XVGffCakXQ0jp1kmZA4lGsYK1h5dEU5DgXqu4UYJ88Vttax2W+Y=\n"
    "-----END RSA PRIVATE KEY-----\n"
)

ADC_CONFIG = {
    "type": "BigQuery",
    "credentials": {"gcpConfig": {"type": "gcp_adc", "projectId": "proj-adc"}},
}

JSON_KEY_CONFIG = {
    "type": "BigQuery",
    "credentials": {
        "gcpConfig": {
            "type": "service_account",
            "projectId": "proj-key",
            "privateKeyId": "private_key_id",
            "privateKey": VALID_PRIVATE_KEY,
            "clientEmail": "svc@proj-key.iam.gserviceaccount.com",
            "clientId": "1234",
            "authUri": "https://accounts.google.com/o/oauth2/auth",
            "tokenUri": "https://oauth2.googleapis.com/token",
            "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
            "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
        }
    },
}


def _with_impersonation(base_config: dict, lifetime: int = 1800) -> BigQueryConnection:
    config = deepcopy(base_config)
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": TARGET_SA,
        "lifetime": lifetime,
    }
    return BigQueryConnection.model_validate(config)


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
def test_impersonate_kwargs_built_for_all_config_types(base_config):
    """Impersonation kwargs must be produced independently of the gcpConfig type."""
    connection = _with_impersonation(base_config, lifetime=1800)

    kwargs = get_impersonate_client_kwargs(connection)

    assert kwargs == {
        "impersonate_service_account": TARGET_SA,
        "lifetime": 1800,
    }


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
def test_no_impersonation_returns_empty_kwargs(base_config):
    """Without a target service account, no impersonation kwargs are emitted."""
    connection = BigQueryConnection.model_validate(base_config)

    assert get_impersonate_client_kwargs(connection) == {}


def test_empty_target_email_is_ignored():
    """A blank impersonate email must not trigger impersonation."""
    config = deepcopy(ADC_CONFIG)
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": "",
        "lifetime": 3600,
    }
    connection = BigQueryConnection.model_validate(config)

    assert get_impersonate_client_kwargs(connection) == {}


@pytest.mark.parametrize(
    "base_config,expected_project",
    [(ADC_CONFIG, "proj-adc"), (JSON_KEY_CONFIG, "proj-key")],
)
@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_engine_connect_args_inject_impersonated_client(mock_common, mock_get_client, base_config, expected_project):
    """
    Path A: when impersonation is set, the SQLAlchemy connect args must carry a
    pre-built impersonated client scoped to the configured project so that
    queries run under the target identity.
    """
    mock_common.return_value = {}
    sentinel_client = MagicMock(name="impersonated_bq_client")
    mock_get_client.return_value = sentinel_client

    connection = _with_impersonation(base_config, lifetime=1800)
    connect_args = get_connection_args(connection)

    assert connect_args["client"] is sentinel_client
    mock_get_client.assert_called_once_with(
        project_id=expected_project,
        impersonate_service_account=TARGET_SA,
        lifetime=1800,
    )


@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_billing_project_id_scopes_impersonated_client(mock_common, mock_get_client):
    """billingProjectId takes precedence over the credentials project id."""
    mock_common.return_value = {}
    mock_get_client.return_value = MagicMock()

    config = deepcopy(ADC_CONFIG)
    config["billingProjectId"] = "billing-proj"
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": TARGET_SA,
        "lifetime": 3600,
    }
    connection = BigQueryConnection.model_validate(config)

    get_connection_args(connection)

    mock_get_client.assert_called_once_with(
        project_id="billing-proj",
        impersonate_service_account=TARGET_SA,
        lifetime=3600,
    )


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_engine_connect_args_unchanged_without_impersonation(mock_common, mock_get_client, base_config):
    """
    Regression guard: without impersonation the connect args are exactly the
    common args and NO client is injected, so existing behaviour is preserved.
    """
    mock_common.return_value = {"existing": "arg"}

    connection = BigQueryConnection.model_validate(base_config)
    connect_args = get_connection_args(connection)

    assert connect_args == {"existing": "arg"}
    assert "client" not in connect_args
    mock_get_client.assert_not_called()


@patch("metadata.utils.bigquery_utils.get_gcp_impersonate_credentials")
@patch("metadata.utils.bigquery_utils.get_gcp_default_credentials")
def test_get_bigquery_client_uses_impersonated_credentials(mock_default, mock_impersonate):
    """
    The BigQuery client must be built with impersonated credentials targeting
    the configured service account when impersonation is requested.
    """
    impersonated_creds = MagicMock(name="impersonated_creds")
    mock_impersonate.return_value = impersonated_creds

    with patch("google.cloud.bigquery.Client") as mock_bq_client:
        get_bigquery_client(
            project_id="proj-adc",
            impersonate_service_account=TARGET_SA,
            lifetime=1800,
        )

    mock_impersonate.assert_called_once_with(
        impersonate_service_account=TARGET_SA,
        quoted_project_id=None,
        scopes=None,
        lifetime=1800,
    )
    mock_default.assert_not_called()
    _, client_kwargs = mock_bq_client.call_args
    assert client_kwargs["credentials"] is impersonated_creds
    assert client_kwargs["project"] == "proj-adc"


@patch("metadata.utils.bigquery_utils.get_gcp_impersonate_credentials")
@patch("metadata.utils.bigquery_utils.get_gcp_default_credentials")
def test_get_bigquery_client_uses_default_credentials_without_impersonation(mock_default, mock_impersonate):
    """Without a target service account, default credentials are used as before."""
    default_creds = MagicMock(name="default_creds")
    mock_default.return_value = default_creds

    with patch("google.cloud.bigquery.Client") as mock_bq_client:
        get_bigquery_client(project_id="proj-adc")

    mock_default.assert_called_once()
    mock_impersonate.assert_not_called()
    _, client_kwargs = mock_bq_client.call_args
    assert client_kwargs["credentials"] is default_creds
