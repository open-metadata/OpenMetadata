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
Client to interact with BurstIQ LifeGraph APIs
"""
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import requests

from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

AUTH_TIMEOUT = (10, 30)  # 10s connect, 30s read for authentication
API_TIMEOUT = (
    10,
    120,
)  # 10s connect, 120s read for API calls (handles 600+ dictionaries)

AUTH_SERVER_BASE = "https://auth.burstiq.com"
API_BASE_URL = "https://api.burstiq.com"


class BurstIQClient:
    """
    BurstIQClient creates a REST API connection to BurstIQ LifeGraph platform.
    Handles OAuth2 authentication and API requests.
    """

    def __init__(self, config: BurstIQConnection):
        """
        Initialize BurstIQ Client

        Args:
            config: BurstIQConnection configuration
        """
        self.config = config
        self.api_base_url = getattr(config, "apiUrl", API_BASE_URL).rstrip("/")

        # Token management
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None

    def test_authenticate(self):
        """
        Explicitly test authentication with BurstIQ.
        This is used during test_connection to validate credentials.

        Raises:
            Exception: If authentication fails
        """
        self._authenticate()

    def _authenticate(self):
        """Authenticate with BurstIQ and get access token"""
        # Get configuration values
        realm_name = getattr(self.config, "realmName", None)
        username = getattr(self.config, "username", None)
        password = getattr(self.config, "password", None)

        # Validate required fields
        if not realm_name:
            raise ValueError("realmName is required for authentication")
        if not username:
            raise ValueError("username is required for authentication")
        if not password:
            raise ValueError("password is required for authentication")

        auth_server_url = getattr(self.config, "authServerUrl", AUTH_SERVER_BASE)
        client_id = getattr(self.config, "clientId", "burst")
        token_url = (
            f"{auth_server_url}/realms/{realm_name}/protocol/openid-connect/token"
        )

        payload = {
            "client_id": client_id,
            "grant_type": "password",
            "username": username,
            "password": password.get_secret_value(),
        }

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        try:
            logger.info(f"Authenticating with BurstIQ at: {token_url}")
            response = requests.post(
                token_url, data=payload, headers=headers, timeout=AUTH_TIMEOUT
            )
            response.raise_for_status()

            token_data = response.json()

            self.access_token = token_data.get("access_token")

            # Calculate token expiration
            expires_in = token_data.get("expires_in", 3600)
            self.token_expires_at = datetime.now() + timedelta(
                seconds=expires_in - 60
            )  # 60s buffer

            customer_name = getattr(self.config, "biqCustomerName", None)
            sdz_name = getattr(self.config, "biqSdzName", None)

            logger.info(
                f"Authentication successful. Token expires in {expires_in} seconds"
            )
            if customer_name and sdz_name:
                logger.info(f"Customer: {customer_name}, SDZ: {sdz_name}")

        except Exception as exc:
            logger.error(f"Authentication failed: {exc}")
            logger.debug(traceback.format_exc())
            raise Exception("Failed to authenticate with BurstIQ") from exc

    def _get_auth_header(self) -> Dict[str, str]:
        """
        Get authentication headers with current access token.
        Authenticates on first call if not already authenticated.

        Returns:
            Dictionary of headers
        """
        # Authenticate if not already done (lazy authentication)
        if not self.access_token:
            logger.info("No access token found, authenticating...")
            self._authenticate()
        # Check if token needs refresh
        elif self.token_expires_at and datetime.now() >= self.token_expires_at:
            logger.info("Access token expired, re-authenticating...")
            self._authenticate()

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        # Add BurstIQ-specific headers from config
        customer_name = getattr(self.config, "biqCustomerName", None)
        sdz_name = getattr(self.config, "biqSdzName", None)

        if customer_name:
            headers["biq_customer_name"] = customer_name
        if sdz_name:
            headers["biq_sdz_name"] = sdz_name

        return headers

    def _make_request(
        self, method: str, endpoint: str, **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Make HTTP request to BurstIQ API

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional arguments for requests

        Returns:
            JSON response or None
        """
        import time

        url = f"{self.api_base_url}/{endpoint.lstrip('/')}"
        headers = self._get_auth_header()

        # Merge with any additional headers provided
        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))

        # Log request params for debugging
        params = kwargs.get("params", {})
        logger.debug(f"Making {method} request to {url} with params: {params}")

        try:
            start_time = time.time()
            response = requests.request(
                method, url, headers=headers, timeout=API_TIMEOUT, **kwargs
            )
            elapsed_time = time.time() - start_time

            logger.debug(
                f"Request completed in {elapsed_time:.2f}s - Status: {response.status_code}"
            )

            response.raise_for_status()

            # Parse JSON response
            json_data = response.json()

            # Log response size
            if isinstance(json_data, list):
                logger.debug(f"Received {len(json_data)} items in response")
            else:
                logger.debug(f"Received single item response")

            return json_data

        except requests.exceptions.Timeout as exc:
            logger.error(f"Request timeout after {API_TIMEOUT}s for {url}: {exc}")
            logger.debug(traceback.format_exc())
            raise ConnectionError(
                f"BurstIQ API request timed out after {API_TIMEOUT}s for {url}. "
                "Please check your network connection and BurstIQ API availability."
            ) from exc
        except requests.exceptions.ConnectionError as exc:
            logger.error(f"Connection error for {url}: {exc}")
            logger.debug(traceback.format_exc())
            raise ConnectionError(
                f"Failed to connect to BurstIQ API at {url}. "
                "Please verify the API URL and network connectivity."
            ) from exc
        except Exception as exc:
            logger.error(f"API request failed for {url}: {exc}")
            logger.debug(traceback.format_exc())
            raise

    def get_dictionaries(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch all data dictionaries from BurstIQ

        Args:
            limit: Optional limit on number of dictionaries to fetch

        Returns:
            List of dictionary objects
        """
        params = {}
        if limit:
            params["limit"] = limit

        logger.info("Fetching dictionaries from BurstIQ...")
        data = self._make_request("GET", "/api/metadata/dictionary", params=params)

        if data is None:
            return []

        dictionaries = data if isinstance(data, list) else [data]
        logger.info(f"Found {len(dictionaries)} dictionaries")
        return dictionaries

    def get_dictionary_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific dictionary by name

        Args:
            name: Dictionary name

        Returns:
            Dictionary object or None
        """
        logger.debug(f"Fetching dictionary: {name}")
        return self._make_request("GET", f"/api/metadata/dictionary/{name}")

    def get_edges(
        self,
        name: Optional[str] = None,
        from_dictionary: Optional[str] = None,
        to_dictionary: Optional[str] = None,
        limit: Optional[int] = None,
        skip: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query edge definitions (lineage relationships) from BurstIQ

        Args:
            name: Optional edge name filter
            from_dictionary: Optional source dictionary filter
            to_dictionary: Optional target dictionary filter
            limit: Optional limit on number of edges to fetch
            skip: Optional number of edges to skip (pagination)

        Returns:
            List of edge definition objects
        """
        params = {}
        if name:
            params["name"] = name
        if from_dictionary:
            params["fromDictionary"] = from_dictionary
        if to_dictionary:
            params["toDictionary"] = to_dictionary
        if limit:
            params["limit"] = limit
        if skip:
            params["skip"] = skip

        logger.info(
            f"Fetching edges from BurstIQ (filters: name={name}, from={from_dictionary}, to={to_dictionary})"
        )
        data = self._make_request("GET", "/api/metadata/edge", params=params)

        if data is None:
            return []

        edges = data if isinstance(data, list) else [data]
        logger.info(f"Found {len(edges)} edge definitions")
        return edges

    def close(self):
        """Cleanup method - no session to close when using plain requests"""
        pass
