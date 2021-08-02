#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from google.oauth2 import service_account

from metadata.config.common import ConfigModel
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field

import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account
import time
import uuid

from jose import jwt
from okta.client import Client as OktaClient
import asyncio
from okta.jwt import JWT


class MetadataServerConfig(ConfigModel):
    api_endpoint: str
    api_version: str = 'v1'
    retry: int = 3
    retry_wait: int = 3
    auth_provider_type: str = None
    secret_key: str = None
    org_url: str = None
    client_id: str = None
    private_key: str = None
    email: str = None
    audience: str = 'https://www.googleapis.com/oauth2/v4/token'
    auth_header: str = 'X-Catalog-Source'


@dataclass  # type: ignore[misc]
class AuthenticationProvider(metaclass=ABCMeta):

    @classmethod
    @abstractmethod
    def create(cls, config: MetadataServerConfig) -> "AuthenticationProvider":
        pass

    @abstractmethod
    def auth_token(self) -> str:
        pass


class NoOpAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        return "no_token"


class GoogleAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        credentials = service_account.IDTokenCredentials.from_service_account_file(
            self.config.secret_key,
            target_audience=self.config.audience)
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        return credentials.token


class OktaAuthenticationProvider(AuthenticationProvider):
    def __init__(self, config: MetadataServerConfig):
        self.config = config

    @classmethod
    def create(cls, config: MetadataServerConfig):
        return cls(config)

    def auth_token(self) -> str:
        my_pem, my_jwk = JWT.get_PEM_JWK(self.config.private_key)
        claims = {
            'sub': self.config.client_id,
            'iat': time.time(),
            'exp': time.time() + JWT.ONE_HOUR,
            'iss': self.config.client_id,
            'aud': self.config.org_url + JWT.OAUTH_ENDPOINT,
            'jti': uuid.uuid4(),
            'email': self.config.email
        }
        token = jwt.encode(claims, my_jwk.to_dict(), JWT.HASH_ALGORITHM)
        return token
