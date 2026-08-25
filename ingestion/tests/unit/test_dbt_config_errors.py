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
Error-classification tests for the dbt config sources.

These cover the branches that translate a provider exception into a
DBTConfigException message shown to the user.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests
from botocore.exceptions import ClientError, NoCredentialsError

from metadata.generated.schema.metadataIngestion.dbtconfig.dbtAzureConfig import (
    DbtAzureConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtCloudConfig import (
    DbtCloudConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtS3Config import (
    DbtS3Config,
)
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.source.database.dbt.dbt_config import (
    DBTConfigException,
    get_dbt_details,
)


def _dbt_cloud_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtCloudConfig handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtCloudConfig
    config.dbtCloudAccountId = "12345"
    config.dbtCloudProjectId = None
    config.dbtCloudJobId = None
    config.dbtCloudUrl = "https://cloud.getdbt.com"
    config.dbtCloudAuthToken.get_secret_value.return_value = "tok"
    return config


def _http_error(status_code: int) -> requests.HTTPError:
    """A requests.HTTPError as raise_for_status builds it, which is what reaches the dbt
    Cloud handler when the error body has no top-level "code" key for the REST client to
    turn into an APIError."""
    response = requests.Response()
    response.status_code = status_code
    response.url = "https://cloud.getdbt.com/api/v2/accounts/12345/runs"
    response.reason = "Unauthorized"
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        return exc
    raise AssertionError(f"status {status_code} did not raise")


class TestDbtCloudErrorClassification:
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_401_api_error_reports_invalid_token(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = APIError({"code": 401, "message": "unauthorized"})

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "auth token" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_404_api_error_reports_bad_account_id(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = APIError({"code": 404, "message": "not found"})

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "account ID '12345' not found" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_transport_error_reports_connectivity(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = RestTransportError("GET", "/runs", Exception("refused"))

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "Unable to connect to dbt Cloud" in str(exc_info.value)

    @pytest.mark.parametrize("status_code", [401, 403])
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_reports_invalid_token(self, tracked_rest, status_code):
        """dbt Cloud nests its error code under "status", and an SSO gateway answers with
        HTML, so neither body reaches the APIError branch - a bare HTTPError does."""
        tracked_rest.return_value.get.side_effect = _http_error(status_code)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "auth token" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_404_reports_bad_account_id(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = _http_error(404)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        # The generic fallback also renders the account ID via the request URL, so assert
        # on the wording that only the 404 branch produces.
        assert "account ID '12345' not found" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_other_status_falls_back_to_generic(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = _http_error(500)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "error connecting to dbt cloud" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_none_response_is_not_reported_as_no_runs_found(self, tracked_rest):
        """The client returns None for any error body it cannot classify - a 404 on a
        mistyped account ID lands here just as a 401 does - so the message must name the
        account and enumerate the causes rather than assert the token is bad."""
        tracked_rest.return_value.get.return_value = None

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        message = str(exc_info.value).lower()
        assert "no completed dbt runs" not in message
        assert "12345" in message
        assert "account id is wrong" in message
        assert "token is invalid" in message
        assert "rate-limited" in message

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_empty_data_still_reports_no_runs_found(self, tracked_rest):
        tracked_rest.return_value.get.return_value = {"data": []}

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "no completed dbt runs" in str(exc_info.value).lower()


def _s3_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtS3Config handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtS3Config
    config.dbtPrefixConfig.dbtBucketName = "my-bucket"
    config.dbtPrefixConfig.dbtObjectPrefix = "dbt/"
    return config


def _client_error(code):
    return ClientError({"Error": {"Code": code, "Message": code}}, "ListObjectsV2")


class TestS3ErrorClassification:
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_missing_credentials_reports_auth_failure(self, aws_client):
        aws_client.return_value.get_client.side_effect = NoCredentialsError()

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "authentication failed" in str(exc_info.value).lower()

    @pytest.mark.parametrize(
        ("error_code", "message"),
        [
            (
                "InvalidAccessKeyId",
                "The AWS Access Key Id you provided does not exist in our records.",
            ),
            (
                "SignatureDoesNotMatch",
                "The request signature we calculated does not match the signature you provided. "
                "Check your key and signing method.",
            ),
        ],
    )
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_bad_key_client_error_reports_auth_failure(self, aws_client, error_code, message):
        """These AWS codes render no 'credentials'/'accessdenied' text into str(exc), so the
        substring matcher this replaced misreported them as a generic client-init failure."""
        aws_client.return_value.get_client.side_effect = ClientError(
            {"Error": {"Code": error_code, "Message": message}}, "ListBuckets"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "authentication failed" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_no_such_bucket_reports_bucket_name(self, aws_client):
        """Raised from the boto3 paginator, the way a real bucket typo surfaces.

        metadata.utils.s3_utils.list_s3_objects swallows every exception and only logs, so
        going through it here would prove nothing about this classification."""
        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _client_error(
            "NoSuchBucket"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "my-bucket" in str(exc_info.value)
        assert "not found" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_access_denied_reports_iam_permissions(self, aws_client):
        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _client_error(
            "AccessDenied"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "permission" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_listing_error_raised_mid_pagination_is_still_classified(self, aws_client):
        """The paginator yields lazily, so the error can arrive after the first page has
        already been consumed by the grouping generator."""

        def _pages(**_):
            yield {"Contents": [{"Key": "dbt/manifest.json"}]}
            raise _client_error("AccessDenied")

        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _pages

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "permission" in str(exc_info.value).lower()


def _azure_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtAzureConfig handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtAzureConfig
    config.dbtPrefixConfig.dbtBucketName = "my-container"
    config.dbtPrefixConfig.dbtObjectPrefix = "dbt/"
    return config


class TestAzureErrorClassification:
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_missing_container_reports_container_name(self, azure_client):
        from azure.core.exceptions import ResourceNotFoundError

        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = ResourceNotFoundError(
            "container not found"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "my-container" in str(exc_info.value)
        assert "not found" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_auth_error_reports_permissions(self, azure_client):
        from azure.core.exceptions import ClientAuthenticationError

        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = ClientAuthenticationError(
            "forbidden"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "permission" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_disabled_account_http_error_reports_permissions(self, azure_client):
        """A 403 HttpResponseError whose message never says 'forbidden' or 'authorization' —
        the substring matcher this replaced fell through to the generic 'Failed to access
        Azure container' message for this case instead of the permissions message."""
        from azure.core.exceptions import HttpResponseError

        exc = HttpResponseError("The specified account is disabled.")
        exc.status_code = 403
        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = exc

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "permission" in str(exc_info.value).lower()
