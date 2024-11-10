#  Copyright 2024 Collate
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
Client to interact with Alation apis
"""
import json
import traceback
from typing import Any, Dict, List, Optional

from metadata.generated.schema.entity.services.connections.metadata.alationSinkConnection import (
    AlationSinkConnection,
)
from metadata.generated.schema.security.credentials.apiAccessTokenAuth import (
    ApiAccessTokenAuth,
)
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.metadata.alationsink.constants import (
    ROUTES,
    TOTAL_RECORDS,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = utils_logger()


class AlationSinkAuthenticationProvider(AuthenticationProvider):
    """
    Module to Handle Alation Auth
    """

    def __init__(self, config: AlationSinkConnection):
        self.config = config
        self.service_connection = self.config
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="integration/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
            verify=get_verify_ssl(config.sslConfig),
        )
        self.client = REST(client_config)
        self.generated_auth_token = None
        self.expiry = None
        super().__init__()

    @classmethod
    def create(cls, config: AlationSinkConnection):
        return cls(config)

    def auth_token(self) -> None:
        """
        Generate the auth token
        """
        if isinstance(self.config.authType, ApiAccessTokenAuth):
            self.generated_auth_token = (
                self.config.authType.accessToken.get_secret_value()
            )
            self.expiry = 0
        else:
            self._get_access_token_from_basic_auth()

    def get_access_token(self):
        """
        Return the generated access token
        """
        self.auth_token()
        return self.generated_auth_token, self.expiry

    def _get_access_token_from_basic_auth(self):
        """
        Get the access token for basic auth type
        """
        # Get the refresh token
        refresh_token_data = {
            "username": self.config.authType.username,
            "password": self.config.authType.password.get_secret_value(),
            "name": self.config.projectName,
        }
        refresh_token_response = self.client.post(
            "/createRefreshToken/", json.dumps(refresh_token_data)
        )

        # Get the access token
        access_token_data = {
            "refresh_token": refresh_token_response["refresh_token"],
            "user_id": refresh_token_response["user_id"],
        }
        access_token_response = self.client.post(
            "/createAPIAccessToken/", json.dumps(access_token_data)
        )

        self.generated_auth_token = access_token_response["api_access_token"]
        self.expiry = 0


class AlationSinkClient:
    """
    Client to interact with Alation apis
    """

    def __init__(self, config: AlationSinkConnection):
        self.config = config
        self._auth_provider = AlationSinkAuthenticationProvider.create(config)
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(config.hostPort),
            auth_header="TOKEN",
            api_version="integration",
            auth_token=self._auth_provider.get_access_token,
            auth_token_mode="",
            verify=get_verify_ssl(config.sslConfig),
        )
        self.client = REST(client_config)
        self.pagination_limit = self.config.paginationLimit

    def paginate_entity(
        self, api_url: str, data: Optional[Dict] = None, is_key_offset: bool = False
    ) -> Optional[List[Any]]:
        """
        Method to paginate the entities
        """
        skip_key_name = "skip"
        if is_key_offset:
            skip_key_name = "offset"
        entities = []
        if not data:
            data = {}
        # get entities in batches using the offset and skip settings
        for offset in range(0, TOTAL_RECORDS, self.pagination_limit):
            data["limit"] = str(self.pagination_limit)
            data[skip_key_name] = str(offset)
            response_entities = self.client.get(api_url, data=data)

            # when there are no more entities all have been processed so break out of the loop
            if len(response_entities) == 0:
                break

            entities.extend(response_entities)

        return entities

    def list_native_datasources(self):
        """
        Method to list the native alation datasources
        """
        return self.paginate_entity(api_url="/v1/datasource/")

    def list_connectors(self):
        """
        Method to list all the connectors used by OCF data sources
        """
        response = self.client.get("/v2/connectors/")
        return {
            response_data["name"]: response_data["id"] for response_data in response
        }

    def write_entity(self, create_request: Any) -> Optional[Any]:
        """
        Method to write the entity to Alation
        """
        try:
            url = f"/v2{ROUTES.get(type(create_request))}/"
            req = self.client.post(
                url,
                json=create_request.model_dump(exclude_none=True),
            )
            if req:
                logger.info(
                    f"Successfully wrote entity for [{ROUTES.get(type(create_request))}]: {create_request.title}"
                )
                return req
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to write entity: {exc}")
        return None

    def write_entities(self, ds_id: int, create_requests: Any) -> Optional[Any]:
        """
        Method to write the entities to Alation
        """
        try:
            entity_names = [
                create_request.key for create_request in create_requests.root or []
            ]
            url = f"/v2{ROUTES.get(type(create_requests))}/"
            if ds_id:
                url = f"{url}?ds_id={str(ds_id)}"
            req = self.client.post(
                url,
                json=create_requests.model_dump(exclude_none=True)["root"],
            )
            if req:
                logger.info(
                    f"Successfully wrote entities for [{ROUTES.get(type(create_requests))}]: {str(entity_names)}"
                )
            return req
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to write entities: {exc}")
        return None
