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
Unit tests for the Salesforce Data 360 BaseConnection owners
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.data360Connection import (
    Data360Connection as Data360ConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.pipeline.data360PipelineConnection import (
    Data360PipelineConnection as Data360PipelineConnectionConfig,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.connections import create_connection
from metadata.ingestion.source.database.data360.connection import Data360Connection
from metadata.ingestion.source.pipeline.data360pipeline.connection import (
    Data360PipelineConnection,
)
from metadata.utils.service_spec.service_spec import BaseSpec, import_connection_class

DB_CONFIG = Data360ConnectionConfig(
    consumerKey="consumer_key",
    consumerSecret="consumer_secret",
    salesforceDomain="login",
    salesforceApiVersion="63.0",
)

PIPELINE_CONFIG = Data360PipelineConnectionConfig(
    consumerKey="consumer_key",
    consumerSecret="consumer_secret",
    salesforceDomain="login",
    salesforceApiVersion="63.0",
)


@pytest.mark.parametrize(
    "service_type,source_type,expected",
    [
        (ServiceType.Database, "data360", Data360Connection),
        (ServiceType.Pipeline, "data360pipeline", Data360PipelineConnection),
    ],
)
def test_the_service_spec_owns_the_connection_class(service_type, source_type, expected):
    # Without `connection_class` on the spec the sources fall back to the legacy
    # module-level `get_connection`, which `get_test_connection_fn` documents as
    # temporary. Pin the wiring so a revert to it is a test failure.
    spec = BaseSpec.get_for_source(service_type, source_type)
    assert spec.connection_class is not None
    assert import_connection_class(service_type, source_type) is expected


@pytest.mark.parametrize(
    "owner_class,config,module",
    [
        (Data360Connection, DB_CONFIG, "metadata.ingestion.source.database.data360.connection"),
        (
            Data360PipelineConnection,
            PIPELINE_CONFIG,
            "metadata.ingestion.source.pipeline.data360pipeline.connection",
        ),
    ],
)
class TestConnectionOwner:
    def test_the_client_is_built_from_the_connection_credentials(self, owner_class, config, module):
        with patch(f"{module}.Salesforce") as mock_salesforce:
            owner = owner_class(config)
            client = owner.client
        assert client is mock_salesforce.return_value
        kwargs = mock_salesforce.call_args.kwargs
        assert kwargs["consumer_key"] == "consumer_key"
        assert kwargs["consumer_secret"] == "consumer_secret"
        assert kwargs["domain"] == "login"
        assert kwargs["version"] == "63.0"

    def test_the_client_is_built_once_and_cached(self, owner_class, config, module):
        with patch(f"{module}.Salesforce") as mock_salesforce:
            owner = owner_class(config)
            assert owner.client is owner.client
        assert mock_salesforce.call_count == 1

    def test_close_releases_the_requests_session_we_opened(self, owner_class, config, module):
        session = MagicMock()
        with patch(f"{module}.Salesforce") as mock_salesforce:
            mock_salesforce.return_value.session = session
            owner = owner_class(config)
            _ = owner.client
            session.close.assert_not_called()
            owner.close()
        session.close.assert_called_once()

    def test_the_client_is_rebuilt_after_close(self, owner_class, config, module):
        with patch(f"{module}.Salesforce") as mock_salesforce:
            owner = owner_class(config)
            _ = owner.client
            owner.close()
            _ = owner.client
        assert mock_salesforce.call_count == 2

    def test_create_connection_hands_back_the_owner(self, owner_class, config, module):
        with patch(f"{module}.Salesforce"):
            owner = create_connection(config)
        assert isinstance(owner, owner_class)
        assert isinstance(owner, BaseConnection)
