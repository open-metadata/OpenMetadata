#  Copyright 2022 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Test suite for the action module implementation
"""

from pytest import mark, raises
from unittest import mock

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider
)
from metadata.generated.schema.security.client import (
    auth0SSOClientConfig,
    azureSSOClientConfig,
    customOidcSSOClientConfig,
    googleSSOClientConfig,
    oktaSSOClientConfig,
)
from ingestion.src.metadata.great_expectations.action import (
    OpenMetadataValidationAction
)


@mark.parametrize(
    "input_auth_provider,expected_auth_provider",
    [
        ("no_auth", AuthProvider.no_auth),
        ("google", AuthProvider.google),
        ("azure", AuthProvider.azure),
        ("auth0", AuthProvider.auth0),
        ("okta", AuthProvider.okta),
        ("custom_oidc", AuthProvider.custom_oidc),
    ]
)
@mock.patch.object(OpenMetadataValidationAction, "_get_security_config")
def test_auth_provider(mocked_obj, input_auth_provider, expected_auth_provider):
    """Test given an auth provider str the correct AuthProvider object is created"""
    with mock.patch("great_expectations.DataContext") as mocked_data_context:
        ometa_validation = OpenMetadataValidationAction(
            mocked_data_context,
            "http://localhost:8585/api",
            auth_provider=input_auth_provider
        )

        assert isinstance(ometa_validation.auth_provider, AuthProvider)
        assert ometa_validation.auth_provider == expected_auth_provider


def test_auth_provider_raises():
    with raises(ValueError):
        with mock.patch("great_expectations.DataContext") as mocked_data_context:
            ometa_validation = OpenMetadataValidationAction(
                mocked_data_context,
                "http://localhost:8585/api",
                auth_provider="fake_provider"
            )

@mark.parametrize(
    "params_input,expected_type",
    [
        ({"auth_provider":"google","secret_key":"abcde12345","google_audience":"audience"}, googleSSOClientConfig.GoogleSSOClientConfig),
        ({"auth_provider":"azure","secret_key":"abcde12345","azure_authority":"auth","client_id":"1234","azure_scopes":["scope"]}, azureSSOClientConfig.AzureSSOClientConfig),
        ({"auth_provider":"okta","secret_key":"abcde12345","client_id":"1234","okta_email":"test@test.com","okta_org_url":"http://myurl","okta_scopes":["scope"]}, oktaSSOClientConfig.OktaSSOClientConfig),
        ({"auth_provider":"auth0","secret_key":"abcde12345","client_id":"1234","auth0_domain":"http://myurl"}, auth0SSOClientConfig.Auth0SSOClientConfig),
        ({"auth_provider":"custom_oidc","secret_key":"abcde12345","client_id":"1234","custom_oid_token_endpoint":"mytoken"}, customOidcSSOClientConfig.CustomOIDCSSOClientConfig),
    ]
)
def test_get_security_config(params_input,expected_type):
    """Test security configs are correctly instantiate given params"""
    with mock.patch("great_expectations.DataContext") as mocked_data_context:
        ometa_validation = OpenMetadataValidationAction(
            mocked_data_context,
            "http://localhost:8585/api",
            **params_input,
        )

        security_config = ometa_validation._get_security_config()

        assert isinstance(security_config, expected_type)


def test_get_ometa_connection():
    """Test run function"""
    with mock.patch("great_expectations.DataContext") as mocked_data_context:
        ometa_validation = OpenMetadataValidationAction(
            mocked_data_context,
            "http://localhost:8585/api",
        )

        print(ometa_validation._get_ometa_connection())
