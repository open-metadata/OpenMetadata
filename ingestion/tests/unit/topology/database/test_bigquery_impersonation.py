from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.ingestion.source.database.bigquery.connection import (
    get_connection_args,
    get_connection_url,
)
from metadata.ingestion.source.database.bigquery.helper import get_inspector_details


def _build_adc_connection() -> BigQueryConnection:
    return BigQueryConnection.model_validate(
        {
            "type": "BigQuery",
            "billingProjectId": "billing-project",
            "usageLocation": "eu",
            "credentials": {
                "gcpConfig": {
                    "type": "gcp_adc",
                    "projectId": "source-project",
                },
                "gcpImpersonateServiceAccount": {
                    "impersonateServiceAccount": "target@project.iam.gserviceaccount.com",
                    "lifetime": 1800,
                },
            },
        }
    )


def _build_credentials_path_connection() -> BigQueryConnection:
    return BigQueryConnection.model_validate(
        {
            "type": "BigQuery",
            "billingProjectId": "billing-project",
            "usageLocation": "us",
            "credentials": {
                "gcpConfig": {
                    "type": "gcp_credential_path",
                    "path": "/tmp/fake-service-account.json",
                    "projectId": "source-project",
                },
                "gcpImpersonateServiceAccount": {
                    "impersonateServiceAccount": "target@project.iam.gserviceaccount.com",
                    "lifetime": 900,
                },
            },
        }
    )


@patch("metadata.ingestion.source.database.bigquery.helper.inspect")
@patch("metadata.ingestion.source.database.bigquery.helper.get_connection")
@patch("metadata.ingestion.source.database.bigquery.helper.get_bigquery_client")
def test_get_inspector_details_uses_impersonation_for_adc(
    mock_get_bigquery_client,
    mock_get_connection,
    mock_inspect,
):
    mock_client = MagicMock()
    mock_engine = MagicMock()
    mock_inspector = MagicMock()

    mock_get_bigquery_client.return_value = mock_client
    mock_get_connection.return_value = mock_engine
    mock_inspect.return_value = mock_inspector

    connection = _build_adc_connection()

    result = get_inspector_details(database_name="source-project", service_connection=connection)

    mock_get_bigquery_client.assert_called_once_with(
        project_id="billing-project",
        location="eu",
        impersonate_service_account="target@project.iam.gserviceaccount.com",
        lifetime=1800,
    )
    assert result.client is mock_client
    assert result.engine is mock_engine
    assert result.inspector is mock_inspector


@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
def test_get_connection_args_uses_user_supplied_client_for_impersonation(mock_get_bigquery_client):
    mock_client = MagicMock()
    mock_get_bigquery_client.return_value = mock_client

    connection = _build_credentials_path_connection()

    connection_args = get_connection_args(connection)
    connection_url = get_connection_url(connection)

    mock_get_bigquery_client.assert_called_once_with(
        project_id="billing-project",
        location="us",
        impersonate_service_account="target@project.iam.gserviceaccount.com",
        lifetime=900,
    )
    assert connection_args["client"] is mock_client
    assert "user_supplied_client=true" in connection_url
