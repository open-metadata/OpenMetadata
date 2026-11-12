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
Unit tests for the Salesforce Data 360 pipeline Test Connection steps
"""

from unittest.mock import MagicMock, patch

import pytest
from simple_salesforce.exceptions import SalesforceAuthenticationFailed

from metadata.generated.schema.entity.services.connections.pipeline.data360PipelineConnection import (
    Data360PipelineConnection as Data360PipelineConnectionConfig,
)
from metadata.ingestion.source.pipeline.data360pipeline.connection import (
    Data360PipelineConnection,
)
from metadata.ingestion.source.pipeline.data360pipeline.exceptions import (
    InvalidDomainException,
)

MODULE = "metadata.ingestion.source.pipeline.data360pipeline.connection"


def _config(domain: str = "mycompany.my") -> Data360PipelineConnectionConfig:
    return Data360PipelineConnectionConfig(
        consumerKey="consumer_key",
        consumerSecret="consumer_secret",
        salesforceDomain=domain,
    )


def _steps(owner: Data360PipelineConnection) -> dict:
    with patch(f"{MODULE}.test_connection_steps") as steps:
        owner.test_connection(metadata=MagicMock())
    return steps.call_args.kwargs["test_fn"]


def test_a_rejected_login_fails_check_access_instead_of_escaping():
    # The login used to run before the steps, so it raised out of `test_connection`
    # and the UI never received a result.
    error = SalesforceAuthenticationFailed("invalid_client", "invalid client credentials")
    with patch(f"{MODULE}.Salesforce", side_effect=error):
        test_fn = _steps(Data360PipelineConnection(_config()))
        with pytest.raises(SalesforceAuthenticationFailed, match="invalid client credentials"):
            test_fn["CheckAccess"]()


@pytest.mark.parametrize("domain", ["login", "test"])
def test_a_generic_login_domain_is_refused_before_any_call(domain):
    # simple_salesforce does not try client credentials on these and falls back to a
    # password login, whose error never mentions the domain.
    with patch(f"{MODULE}.Salesforce") as salesforce:
        owner = Data360PipelineConnection(_config(domain=domain))
        with pytest.raises(InvalidDomainException, match=rf"My Domain .*not `{domain}`"):
            _ = owner.client
    salesforce.assert_not_called()


def test_a_host_salesforce_rejects_as_not_my_domain_gets_a_hint():
    error = SalesforceAuthenticationFailed("invalid_grant", "request not supported on this domain")
    with patch(f"{MODULE}.Salesforce", side_effect=error):
        owner = Data360PipelineConnection(_config(domain="mycompany"))
        with pytest.raises(InvalidDomainException, match=r"not supported on this domain\. .*not `mycompany`"):
            _ = owner.client


def test_other_login_errors_are_left_as_they_are():
    error = SalesforceAuthenticationFailed("invalid_client", "invalid client credentials")
    with patch(f"{MODULE}.Salesforce", side_effect=error):
        owner = Data360PipelineConnection(_config())
        with pytest.raises(SalesforceAuthenticationFailed) as raised:
            _ = owner.client
    assert raised.value is error


@pytest.mark.parametrize(
    "step,items_field",
    [
        ("GetPipelines", "dataStreams"),
        ("GetDataTransforms", "dataTransforms"),
    ],
)
def test_listing_steps_read_a_single_page(step, items_field):
    with patch(f"{MODULE}.Salesforce") as salesforce:
        salesforce.return_value.restful.return_value = {"totalSize": 250, items_field: [{"name": "a"}]}
        test_fn = _steps(Data360PipelineConnection(_config()))
        test_fn[step]()
    assert salesforce.return_value.restful.call_count == 1
