#  Copyright 2021 Collate
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
Register auth provider init functions here
"""
from metadata.generated.schema.metadataIngestion.workflow import (
    AuthProvider,
    OpenMetadataServerConfig,
)
from metadata.ingestion.ometa.auth_provider import (
    Auth0AuthenticationProvider,
    AuthenticationProvider,
    AzureAuthenticationProvider,
    CustomOIDCAuthenticationProvider,
    GoogleAuthenticationProvider,
    NoOpAuthenticationProvider,
    OktaAuthenticationProvider,
)
from metadata.utils.dispatch import enum_register


class InvalidAuthProviderException(Exception):
    """
    Raised when we cannot find a valid auth provider
    in the registry
    """


auth_provider_registry = enum_register()


@auth_provider_registry.add(AuthProvider.no_auth.value)
def no_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return NoOpAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.google.value)
def google_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return GoogleAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.okta.value)
def okta_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return OktaAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.auth0.value)
def auth0_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return Auth0AuthenticationProvider.create(config)


@auth_provider_registry.add("azure")  # TODO: update JSON
def azure_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return AzureAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.custom_oidc.value)
def custom_oidc_auth_init(config: OpenMetadataServerConfig) -> AuthenticationProvider:
    return CustomOIDCAuthenticationProvider.create(config)
