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

from metadata.generated.schema.metadataIngestion.dbtconfig.dbtCloudConfig import (
    DbtCloudConfig,
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

        assert "12345" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_transport_error_reports_connectivity(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = RestTransportError("GET", "/runs", Exception("refused"))

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "cloud.getdbt.com" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_none_response_is_not_reported_as_no_runs_found(self, tracked_rest):
        """A swallowed 401 returns None from the client. That is a credential
        problem, not an empty account, and must not be mislabelled."""
        tracked_rest.return_value.get.return_value = None

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        message = str(exc_info.value).lower()
        assert "no completed dbt runs" not in message
        assert "credential" in message or "token" in message

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_empty_data_still_reports_no_runs_found(self, tracked_rest):
        tracked_rest.return_value.get.return_value = {"data": []}

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "no completed dbt runs" in str(exc_info.value).lower()
