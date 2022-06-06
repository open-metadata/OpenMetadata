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
Interface definition for an Auth provider
"""
import http.client
import json
import os.path
import sys
import traceback
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Tuple

import requests
from dateutil.relativedelta import relativedelta

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
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
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.utils import ometa_logger

# Only load security providers on call
# pylint: disable=import-outside-toplevel

logger = ometa_logger()

ACCESS_TOKEN = "access_token"
EXPIRY = "expires_in"


class AuthenticationException(Exception):
    """
    Error trying to get the token from the provider
    """


@dataclass(init=False)  # type: ignore[misc]
class AuthenticationProvider(metaclass=ABCMeta):
    """
    Interface definition for an Authentication provider
    """

    @classmethod
    @abstractmethod
    def create(cls, config: ConfigModel) -> "AuthenticationProvider":
        """
        Create authentication

        Arguments:
            config (ConfigModel): configuration
        Returns:
            AuthenticationProvider
        """

    @abstractmethod
    def auth_token(self) -> str:
        """
        Authentication token

        Returns:
            str
        """

    @abstractmethod
    def get_access_token(self):
        """
        Authentication token

        Returns:
            str
        """


class NoOpAuthenticationProvider(AuthenticationProvider):
    """
    Extends AuthenticationProvider class

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self):
        pass

    def get_access_token(self):
        return "no_token", None


class GoogleAuthenticationProvider(AuthenticationProvider):
    """
    Google authentication implementation

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: GoogleSSOClientConfig = self.config.securityConfig

        self.generated_auth_token = None
        self.expiry = None

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self) -> None:
        import google.auth
        import google.auth.transport.requests
        from google.oauth2 import service_account

        credentials = service_account.IDTokenCredentials.from_service_account_file(
            self.security_config.secretKey,
            target_audience=self.security_config.audience,
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        self.generated_auth_token = credentials.token
        self.expiry = credentials.expiry

    def get_access_token(self):
        self.auth_token()
        return self.generated_auth_token, self.expiry


class OktaAuthenticationProvider(AuthenticationProvider):
    """
    Prepare the Json Web Token for Okta auth
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: OktaSSOClientConfig = self.config.securityConfig

        self.generated_auth_token = None
        self.expiry = None

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    async def auth_token(  # pylint: disable=invalid-overridden-method, too-many-locals
        self,
    ) -> None:
        import time
        import uuid
        from urllib.parse import quote, urlencode

        from okta.cache.okta_cache import OktaCache
        from okta.jwt import JWT, jwt
        from okta.request_executor import RequestExecutor

        try:
            _, my_jwk = JWT.get_PEM_JWK(self.security_config.privateKey)
            issued_time = int(time.time())
            expiry_time = issued_time + JWT.ONE_HOUR
            generated_jwt_id = str(uuid.uuid4())
            claims = {
                "sub": self.security_config.clientId,
                "iat": issued_time,
                "exp": expiry_time,
                "iss": self.security_config.clientId,
                "aud": self.security_config.orgURL,
                "jti": generated_jwt_id,
            }
            jwt_token = jwt.encode(claims, my_jwk.to_dict(), JWT.HASH_ALGORITHM)
            config = {
                "client": {
                    "orgUrl": self.security_config.orgURL,
                    "authorizationMode": "BEARER",
                    "rateLimit": {},
                    "privateKey": self.security_config.privateKey,
                    "clientId": self.security_config.clientId,
                    "token": jwt_token,
                    "scopes": self.security_config.scopes,
                }
            }
            request_exec = RequestExecutor(
                config=config, cache=OktaCache(ttl=expiry_time, tti=issued_time)
            )
            parameters = {
                "grant_type": "client_credentials",
                "scope": " ".join(config["client"]["scopes"]),
                "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": jwt_token,
            }
            encoded_parameters = urlencode(parameters, quote_via=quote)
            url = f"{self.security_config.orgURL}?" + encoded_parameters
            token_request_object = await request_exec.create_request(
                "POST",
                url,
                None,
                {
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                oauth=True,
            )
            _, _, res_json, err = await request_exec.fire_request(
                token_request_object[0]
            )
            if err:
                raise APIError(f"{err}")
            response_dict = json.loads(res_json)

            token = response_dict.get(ACCESS_TOKEN)
            if not token:
                raise AuthenticationException(
                    f"Error getting access token: {response_dict}"
                )

            self.generated_auth_token = token
            self.expiry = response_dict.get(EXPIRY)

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)
            sys.exit()

    def get_access_token(self):
        import asyncio

        asyncio.run(self.auth_token())
        return self.generated_auth_token, self.expiry


class Auth0AuthenticationProvider(AuthenticationProvider):
    """
    OAuth authentication implementation
    Args:
        config (MetadataServerConfig):
    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: Auth0SSOClientConfig = self.config.securityConfig

        self.generated_auth_token = None
        self.expiry = None

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self) -> None:
        conn = http.client.HTTPSConnection(self.security_config.domain)
        payload = (
            f"grant_type=client_credentials&client_id={self.security_config.clientId}"
            f"&client_secret={self.security_config.secretKey}&audience=https://{self.security_config.domain}/api/v2/"
        )
        headers = {"content-type": "application/x-www-form-urlencoded"}
        conn.request(
            "POST", f"/{self.security_config.domain}/oauth/token", payload, headers
        )
        res = conn.getresponse()
        data = json.loads(res.read().decode("utf-8"))

        token = data.get(ACCESS_TOKEN)
        if not token:
            raise AuthenticationException(f"Error getting access token: {data}")

        self.generated_auth_token = token
        self.expiry = data[EXPIRY]

    def get_access_token(self):
        self.auth_token()
        return self.generated_auth_token, self.expiry


class AzureAuthenticationProvider(AuthenticationProvider):
    """
    Prepare the Json Web Token for Azure auth
    """

    # TODO: Prepare JSON for Azure Auth
    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: AzureSSOClientConfig = self.config.securityConfig
        self.generated_auth_token = None
        self.expiry = None

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self) -> None:
        from msal import (
            ConfidentialClientApplication,  # pylint: disable=import-outside-toplevel
        )

        app = ConfidentialClientApplication(
            client_id=self.security_config.clientId,
            client_credential=self.security_config.clientSecret,
            authority=self.security_config.authority,
        )
        data = app.acquire_token_for_client(scopes=self.security_config.scopes)

        token = data.get(ACCESS_TOKEN)
        if not token:
            raise AuthenticationException(f"Error getting access token: {data}")

        self.generated_auth_token = token
        self.expiry = data.get(EXPIRY)

    def get_access_token(self):
        self.auth_token()
        return self.generated_auth_token, self.expiry


class CustomOIDCAuthenticationProvider(AuthenticationProvider):
    """
    Custom OIDC authentication implementation

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection) -> None:
        self.config = config
        self.security_config: CustomOIDCSSOClientConfig = self.config.securityConfig

        self.generated_auth_token = None
        self.expiry = None

    @classmethod
    def create(
        cls, config: OpenMetadataConnection
    ) -> "CustomOIDCAuthenticationProvider":
        return cls(config)

    def auth_token(self) -> None:
        data = {
            "grant_type": "client_credentials",
            "client_id": self.security_config.clientId,
            "client_secret": self.security_config.secretKey,
        }
        response = requests.post(
            url=self.security_config.tokenEndpoint,
            data=data,
        )
        if response.ok:
            response_json = response.json()

            token = response_json.get(ACCESS_TOKEN)
            if not token:
                raise AuthenticationException(
                    f"Error getting access token: {response_json}"
                )

            self.generated_auth_token = token
            self.expiry = response_json.get(EXPIRY)
        else:
            raise APIError(
                error={"message": response.text}, http_error=response.status_code
            )

    def get_access_token(self) -> Tuple[str, int]:
        self.auth_token()
        return self.generated_auth_token, self.expiry


class OpenMetadataAuthenticationProvider(AuthenticationProvider):
    """
    OpenMetadata authentication implementation

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: OpenMetadataJWTClientConfig = self.config.securityConfig
        self.jwt_token = None
        self.expiry = datetime.now() - relativedelta(years=1)

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self) -> None:
        if not self.jwt_token:
            if os.path.isfile(self.security_config.jwtToken):
                with open(self.security_config.jwtToken, "r", encoding="utf-8") as file:
                    self.jwt_token = file.read().rstrip()
            else:
                self.jwt_token = self.security_config.jwtToken

    def get_access_token(self):
        self.auth_token()
        return self.jwt_token, self.expiry
