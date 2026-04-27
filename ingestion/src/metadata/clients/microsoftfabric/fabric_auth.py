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
Microsoft Fabric Authentication Module

Provides unified authentication for all Fabric services:
- Fabric Warehouse/Lakehouse (Database)
- Fabric Data Factory (Pipeline)
- Fabric Power BI (Dashboard)

Supports:
- Service Principal (ClientSecretCredential)
- Managed Identity (DefaultAzureCredential)
"""

import traceback
from time import sleep
from typing import Callable, Optional, Tuple

import msal

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

AUTH_TOKEN_MAX_RETRIES = 5
AUTH_TOKEN_RETRY_WAIT = 120

# OAuth2 scopes for different Fabric services
FABRIC_API_SCOPE = ["https://api.fabric.microsoft.com/.default"]
POWER_BI_SCOPE = ["https://analysis.windows.net/powerbi/api/.default"]
DATABASE_SCOPE = ["https://database.windows.net/.default"]


class FabricAuthenticator:
    """
    Unified authenticator for Microsoft Fabric services.

    Provides token acquisition for REST APIs using MSAL.
    """

    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        authority_uri: str = "https://login.microsoftonline.com/",
    ):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.authority_uri = authority_uri
        self._msal_client: Optional[msal.ConfidentialClientApplication] = None

    @property
    def msal_client(self) -> msal.ConfidentialClientApplication:
        """Lazy-initialize MSAL client for OAuth token acquisition"""
        if self._msal_client is None:
            self._msal_client = msal.ConfidentialClientApplication(
                client_id=self.client_id,
                client_credential=self.client_secret,
                authority=f"{self.authority_uri}{self.tenant_id}",
            )
        return self._msal_client

    def get_token(self, scopes: list) -> Tuple[str, int]:
        """
        Acquire OAuth2 access token for the given scopes.

        Returns:
            Tuple of (access_token, expires_in_seconds)
        """
        # Try cache first
        response_data = self._get_token_from_cache(scopes)
        if not response_data:
            logger.info("Token does not exist in the cache. Getting a new token.")
            response_data = self._generate_new_token(scopes)

        response_data = response_data or {}
        access_token = response_data.get("access_token")
        expires_in = response_data.get("expires_in", 3600)

        if not access_token:
            raise ValueError(f"Failed to acquire token: {response_data.get('error_description', 'Unknown error')}")

        logger.info("Fabric access token generated successfully")
        return access_token, expires_in

    def _generate_new_token(self, scopes: list) -> Optional[dict]:
        """Generate new auth token with retry logic"""
        retry = AUTH_TOKEN_MAX_RETRIES
        while retry:
            try:
                response_data = self.msal_client.acquire_token_for_client(scopes=scopes)
                return response_data
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error generating new auth token: {exc}")
                retry -= 1
                if retry:
                    logger.warning(
                        f"Error generating new token: {exc}, "
                        f"sleep {AUTH_TOKEN_RETRY_WAIT} seconds retrying {retry} more times.."
                    )
                    sleep(AUTH_TOKEN_RETRY_WAIT)
                else:
                    logger.warning("Could not generate new token after maximum retries, Please check provided configs")
        return None

    def _get_token_from_cache(self, scopes: list) -> Optional[dict]:
        """Fetch auth token from cache with retry logic"""
        retry = AUTH_TOKEN_MAX_RETRIES
        while retry:
            try:
                response_data = self.msal_client.acquire_token_silent(scopes=scopes, account=None)
                return response_data
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error getting token from cache: {exc}")
                retry -= 1
                if retry:
                    logger.warning(
                        f"Error getting token from cache: {exc}, "
                        f"sleep {AUTH_TOKEN_RETRY_WAIT} seconds retrying {retry} more times.."
                    )
                    sleep(AUTH_TOKEN_RETRY_WAIT)
                else:
                    logger.warning(
                        "Could not get token from cache after maximum retries, Please check provided configs"
                    )
        return None

    def get_fabric_api_token(self) -> Tuple[str, int]:
        """Get token for Fabric REST API"""
        return self.get_token(FABRIC_API_SCOPE)

    def get_power_bi_token(self) -> Tuple[str, int]:
        """Get token for Power BI API"""
        return self.get_token(POWER_BI_SCOPE)

    def get_token_callback(self, scopes: list) -> Callable[[], Tuple[str, int]]:
        """
        Returns a callable for lazy token acquisition.
        Useful for REST clients that need refreshable tokens.
        """
        return lambda: self.get_token(scopes)
