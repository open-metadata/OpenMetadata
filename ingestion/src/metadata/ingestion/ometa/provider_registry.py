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
# Complains about same imports
# pylint: disable=duplicate-code
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.auth0SSOClientConfig import (
    Auth0SSOClientConfig,
)
from metadata.generated.schema.security.client.azureSSOClientConfig import (
    AzureSSOClientConfig,
)
from metadata.generated.schema.security.client.customOidcSSOClientConfig import (
    CustomOIDCSSOClientConfig,
)
from metadata.generated.schema.security.client.googleSSOClientConfig import (
    GoogleSSOClientConfig,
)
from metadata.generated.schema.security.client.oktaSSOClientConfig import (
    OktaSSOClientConfig,
)
from metadata.ingestion.ometa.auth_provider import (
    Auth0AuthenticationProvider,
    AuthenticationProvider,
    AzureAuthenticationProvider,
    CustomOIDCAuthenticationProvider,
    GoogleAuthenticationProvider,
    NoOpAuthenticationProvider,
    OktaAuthenticationProvider,
    OpenMetadataAuthenticationProvider,
    OpenMetadataJWTClientConfig,
)
from metadata.utils.dispatch import enum_register


class InvalidAuthProviderException(Exception):
    """
    Raised when we cannot find a valid auth provider
    in the registry
    """


auth_provider_registry = enum_register()


@auth_provider_registry.add(AuthProvider.no_auth.value)
def no_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return NoOpAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.google.value)
def google_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return GoogleAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.okta.value)
def okta_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return OktaAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.auth0.value)
def auth0_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return Auth0AuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.azure.value)
def azure_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return AzureAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.custom_oidc.value)
def custom_oidc_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return CustomOIDCAuthenticationProvider.create(config)


@auth_provider_registry.add(AuthProvider.openmetadata.value)
def om_auth_init(config: OpenMetadataConnection) -> AuthenticationProvider:
    return OpenMetadataAuthenticationProvider.create(config)


PROVIDER_CLASS_MAP = {
    AuthProvider.no_auth.value: None,
    AuthProvider.google.value: GoogleSSOClientConfig,
    AuthProvider.azure.value: AzureSSOClientConfig,
    AuthProvider.okta.value: OktaSSOClientConfig,
    AuthProvider.auth0.value: Auth0SSOClientConfig,
    AuthProvider.custom_oidc.value: CustomOIDCSSOClientConfig,
    AuthProvider.openmetadata.value: OpenMetadataJWTClientConfig,
}
