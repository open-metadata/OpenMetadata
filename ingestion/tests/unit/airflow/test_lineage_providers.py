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
Mock providers and check custom load
"""
from unittest import TestCase

from airflow.configuration import AirflowConfigParser

from airflow_provider_openmetadata.lineage.config.loader import (
    AirflowLineageConfig,
    parse_airflow_config,
)
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
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)

AIRFLOW_SERVICE_NAME = "test-service"


class TestAirflowAuthProviders(TestCase):
    """
    Make sure we are properly loading all required classes
    """

    def test_google_sso(self):
        sso_config = """
        [lineage]
        backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
        airflow_service_name = local_airflow
        openmetadata_api_endpoint = http://localhost:8585/api
        
        auth_provider_type = google
        secret_key = path/to/key
        """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.google.value,
                    securityConfig=GoogleSSOClientConfig(secretKey="path/to/key"),
                ),
            ),
        )

    def test_okta_sso(self):
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api
    
            auth_provider_type = okta
            client_id = client_id
            org_url = org_url
            private_key = private_key
            email = email
            scopes = ["scope1", "scope2"]
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.okta.value,
                    securityConfig=OktaSSOClientConfig(
                        clientId="client_id",
                        orgURL="org_url",
                        privateKey="private_key",
                        email="email",
                        scopes=["scope1", "scope2"],
                    ),
                ),
            ),
        )

        # Validate default scopes
        sso_config = """
                [lineage]
                backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
                airflow_service_name = local_airflow
                openmetadata_api_endpoint = http://localhost:8585/api

                auth_provider_type = okta
                client_id = client_id
                org_url = org_url
                private_key = private_key
                email = email
                """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.okta.value,
                    securityConfig=OktaSSOClientConfig(
                        clientId="client_id",
                        orgURL="org_url",
                        privateKey="private_key",
                        email="email",
                        scopes=[],
                    ),
                ),
            ),
        )

    def test_auth0_sso(self):
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api
    
            auth_provider_type = auth0
            client_id = client_id
            secret_key = secret_key
            domain = domain
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.auth0.value,
                    securityConfig=Auth0SSOClientConfig(
                        clientId="client_id",
                        secretKey="secret_key",
                        domain="domain",
                    ),
                ),
            ),
        )

    def test_azure_sso(self):
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api
    
            auth_provider_type = azure
            client_id = client_id
            client_secret = client_secret
            authority = authority
            scopes = ["scope1", "scope2"]
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.azure.value,
                    securityConfig=AzureSSOClientConfig(
                        clientId="client_id",
                        clientSecret="client_secret",
                        authority="authority",
                        scopes=["scope1", "scope2"],
                    ),
                ),
            ),
        )

        # Validate default scopes
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api
    
            auth_provider_type = azure
            client_id = client_id
            client_secret = client_secret
            authority = authority
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.azure.value,
                    securityConfig=AzureSSOClientConfig(
                        clientId="client_id",
                        clientSecret="client_secret",
                        authority="authority",
                        scopes=[],
                    ),
                ),
            ),
        )

    def test_om_sso(self):
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api

            auth_provider_type = openmetadata
            jwt_token = jwt_token
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.openmetadata.value,
                    securityConfig=OpenMetadataJWTClientConfig(
                        jwtToken="jwt_token",
                    ),
                ),
            ),
        )

    def test_custom_oidc_sso(self):
        sso_config = """
            [lineage]
            backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
            airflow_service_name = local_airflow
            openmetadata_api_endpoint = http://localhost:8585/api

            auth_provider_type = custom-oidc
            client_id = client_id
            secret_key = secret_key
            token_endpoint = token_endpoint
            """

        # mock the conf object
        conf = AirflowConfigParser(default_config=sso_config)

        lineage_config = parse_airflow_config(AIRFLOW_SERVICE_NAME, conf)

        self.assertEqual(
            lineage_config,
            AirflowLineageConfig(
                airflow_service_name=AIRFLOW_SERVICE_NAME,
                metadata_config=OpenMetadataConnection(
                    hostPort="http://localhost:8585/api",
                    authProvider=AuthProvider.custom_oidc.value,
                    securityConfig=CustomOIDCSSOClientConfig(
                        clientId="client_id",
                        secretKey="secret_key",
                        tokenEndpoint="token_endpoint",
                    ),
                ),
            ),
        )
