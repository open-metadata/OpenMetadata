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
Helper classes to model OpenMetadata Entities,
server configuration and auth.
"""
import http.client
import json
import logging
import sys
import traceback
from typing import List

from pydantic import BaseModel

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table, TableProfile
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import APIError

logger = logging.getLogger(__name__)

DatabaseServiceEntities = List[DatabaseService]
DatabaseEntities = List[Database]
Tags = List[Tag]
TableProfiles = List[TableProfile]


class TableEntities(BaseModel):
    """
    Table entity pydantic model
    """

    tables: List[Table]
    total: int
    after: str = None


class TopicEntities(BaseModel):
    """
    Topic entity pydantic model
    """

    topics: List[Topic]
    total: int
    after: str = None


class DashboardEntities(BaseModel):
    """
    Dashboard entity pydantic model
    """

    dashboards: List[Dashboard]
    total: int
    after: str = None


class PipelineEntities(BaseModel):
    """
    Pipeline entity pydantic model
    """

    pipelines: List[Pipeline]
    total: int
    after: str = None


class MetadataServerConfig(ConfigModel):
    """
    Metadata Server pydantic config model
    """

    api_endpoint: str
    api_version: str = "v1"
    retry: int = 3
    retry_wait: int = 3
    auth_provider_type: str = None
    secret_key: str = None
    org_url: str = None
    client_id: str = None
    private_key: str = None
    domain: str = None
    email: str = None
    audience: str = "https://www.googleapis.com/oauth2/v4/token"
    auth_header: str = "Authorization"
    scopes: List = []


class NoOpAuthenticationProvider(AuthenticationProvider):
    """
    Extends AuthenticationProvider class

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self):
        pass

    def get_access_token(self):
        return ("no_token", None)


class GoogleAuthenticationProvider(AuthenticationProvider):
    """
    Google authentication implementation

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        import google.auth
        import google.auth.transport.requests
        from google.oauth2 import service_account

        credentials = service_account.IDTokenCredentials.from_service_account_file(
            self.config.secret_key, target_audience=self.config.audience
        )
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        self.generated_auth_token = credentials.token
        self.expiry = credentials.expiry

    def get_access_token(self):
        self.auth_token()
        return (self.generated_auth_token, self.expiry)


class OktaAuthenticationProvider(AuthenticationProvider):
    """
    Prepare the Json Web Token for Okta auth
    """

    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    async def auth_token(self) -> str:
        import time
        import uuid
        from urllib.parse import quote, urlencode

        from okta.cache.okta_cache import OktaCache
        from okta.jwt import JWT, jwt
        from okta.request_executor import RequestExecutor

        try:
            my_pem, my_jwk = JWT.get_PEM_JWK(self.config.private_key)
            issued_time = int(time.time())
            expiry_time = issued_time + JWT.ONE_HOUR
            generated_jwt_id = str(uuid.uuid4())
            claims = {
                "sub": self.config.client_id,
                "iat": issued_time,
                "exp": expiry_time,
                "iss": self.config.client_id,
                "aud": self.config.org_url,
                "jti": generated_jwt_id,
            }
            token = jwt.encode(claims, my_jwk.to_dict(), JWT.HASH_ALGORITHM)
            config = {
                "client": {
                    "orgUrl": self.config.org_url,
                    "authorizationMode": "BEARER",
                    "rateLimit": {},
                    "privateKey": self.config.private_key,
                    "clientId": self.config.client_id,
                    "token": token,
                    "scopes": self.config.scopes,
                }
            }
            request_exec = RequestExecutor(
                config=config, cache=OktaCache(ttl=expiry_time, tti=issued_time)
            )
            parameters = {
                "grant_type": "client_credentials",
                "scope": " ".join(config["client"]["scopes"]),
                "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": token,
            }
            encoded_parameters = urlencode(parameters, quote_via=quote)
            url = f"{self.config.org_url}?" + encoded_parameters
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
            _, res_details, res_json, err = await request_exec.fire_request(
                token_request_object[0]
            )
            if err:
                raise APIError(f"{err}")
            response_dict = json.loads(res_json)
            self.generated_auth_token = response_dict.get("access_token")
            self.expiry = response_dict.get("expires_in")
        except Exception as err:
            logger.debug(traceback.print_exc())
            logger.error(err)
            sys.exit()

    def get_access_token(self):
        import asyncio

        asyncio.run(self.auth_token())
        return (self.generated_auth_token, self.expiry)


class Auth0AuthenticationProvider(AuthenticationProvider):
    """
    OAuth authentication implementation
    Args:
        config (MetadataServerConfig):
    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        conn = http.client.HTTPSConnection(self.config.domain)
        payload = (
            f"grant_type=client_credentials&client_id={self.config.client_id}"
            f"&client_secret={self.config.secret_key}&audience=https://{self.config.domain}/api/v2/"
        )
        headers = {"content-type": "application/x-www-form-urlencoded"}
        conn.request("POST", f"/{self.config.domain}/oauth/token", payload, headers)
        res = conn.getresponse()
        data = res.read()
        token = json.loads(data.decode("utf-8"))
        self.generated_auth_token = token["access_token"]
        self.expiry = token["expires_in"]

    def get_access_token(self):
        self.auth_token()
        return (self.generated_auth_token, self.expiry)
