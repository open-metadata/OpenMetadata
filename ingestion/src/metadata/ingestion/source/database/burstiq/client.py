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
from typing import Any, Dict, List, Optional  # noqa: UP035

import requests

from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.ingestion.source.database.burstiq.models import (
    BurstIQDictionary,
    BurstIQEdge,
    SdzMetricsResponse,
    TokenResponse,
    TQLRecord,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

AUTH_TIMEOUT = (10, 30)
API_TIMEOUT = (10, 120)

AUTH_SERVER_BASE = "https://auth.burstiq.com"
API_BASE_URL = "https://api.burstiq.com"

SYSTEM_WALLET_ERROR_MARKER = "system wallet"


class BurstIQClient:
    """
    BurstIQClient creates a REST API connection to BurstIQ LifeGraph platform.
    Handles OAuth2 authentication and API requests.
    """

    def __init__(self, config: BurstIQConnection):
        self.config = config
        self.api_base_url = getattr(config, "apiUrl", API_BASE_URL).rstrip("/")

        self.access_token: Optional[str] = None  # noqa: UP045
        self.token_expires_at: Optional[datetime] = None  # noqa: UP045
        self._chain_metrics: Optional[Dict[str, int]] = None  # noqa: UP006, UP045

    def test_authenticate(self):
        """
        Explicitly test authentication with BurstIQ.
        This is used during test_connection to validate credentials.

        Raises:
            Exception: If authentication fails
        """
        self._authenticate()

    def _authenticate(self):
        """Authenticate with BurstIQ and store the access token."""
        realm_name = getattr(self.config, "realmName", None)
        username = getattr(self.config, "username", None)
        password = getattr(self.config, "password", None)

        if not realm_name:
            raise ValueError("realmName is required for authentication")
        if not username:
            raise ValueError("username is required for authentication")
        if not password:
            raise ValueError("password is required for authentication")

        auth_server_url = getattr(self.config, "authServerUrl", AUTH_SERVER_BASE)
        client_id = getattr(self.config, "clientId", "burst")
        token_url = f"{auth_server_url}/realms/{realm_name}/protocol/openid-connect/token"

        payload = {
            "client_id": client_id,
            "grant_type": "password",
            "username": username,
            "password": password.get_secret_value(),
        }

        try:
            logger.info(f"Authenticating with BurstIQ at: {token_url}")
            response = requests.post(
                token_url,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=AUTH_TIMEOUT,
            )
            response.raise_for_status()

            token = TokenResponse.model_validate(response.json())
            self.access_token = token.access_token
            self.token_expires_at = datetime.now() + timedelta(seconds=token.expires_in - 60)

            customer_name = getattr(self.config, "biqCustomerName", None)
            sdz_name = getattr(self.config, "biqSdzName", None)

            logger.info(f"Authentication successful. Token expires in {token.expires_in} seconds")
            if customer_name and sdz_name:
                logger.info(f"Customer: {customer_name}, SDZ: {sdz_name}")

        except Exception as exc:
            logger.error(f"Authentication failed: {exc}")
            logger.debug(traceback.format_exc())
            raise Exception("Failed to authenticate with BurstIQ") from exc  # noqa: TRY002

    def _get_auth_header(self) -> Dict[str, str]:  # noqa: UP006
        """
        Get authentication headers, refreshing the token if necessary.

        Returns:
            Dictionary of headers
        """
        if not self.access_token:
            logger.info("No access token found, authenticating...")
            self._authenticate()
        elif self.token_expires_at and datetime.now() >= self.token_expires_at:
            logger.info("Access token expired, re-authenticating...")
            self._authenticate()

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        customer_name = getattr(self.config, "biqCustomerName", None)
        sdz_name = getattr(self.config, "biqSdzName", None)
        system_wallet_id = getattr(self.config, "biqSystemWalletId", None)

        if customer_name:
            headers["biq_customer_name"] = customer_name
        if sdz_name:
            headers["biq_sdz_name"] = sdz_name
        if system_wallet_id:
            headers["biq_system_wallet_id"] = system_wallet_id

        return headers

    def _make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Any]:  # noqa: UP045
        """
        Make HTTP request to BurstIQ API

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional arguments for requests

        Returns:
            JSON response or None
        """
        import time  # noqa: PLC0415

        url = f"{self.api_base_url}/{endpoint.lstrip('/')}"
        headers = self._get_auth_header()

        if "headers" in kwargs:
            headers.update(kwargs.pop("headers"))

        params = kwargs.get("params", {})
        logger.debug(f"Making {method} request to {url} with params: {params}")

        try:
            start_time = time.time()
            response = requests.request(method, url, headers=headers, timeout=API_TIMEOUT, **kwargs)
            elapsed_time = time.time() - start_time

            logger.debug(f"Request completed in {elapsed_time:.2f}s - Status: {response.status_code}")

            response.raise_for_status()

            json_data = response.json()

            if isinstance(json_data, list):
                logger.debug(f"Received {len(json_data)} items in response")
            else:
                logger.debug("Received single item response")

            return json_data  # noqa: TRY300

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
                f"Failed to connect to BurstIQ API at {url}. Please verify the API URL and network connectivity."
            ) from exc
        except Exception as exc:
            logger.error(f"API request failed for {url}: {exc}")
            logger.debug(traceback.format_exc())
            raise

    def validate_system_wallet(self) -> None:
        """
        Validate the configured BurstIQ system wallet.

        BurstIQ attaches the biq_system_wallet_id header to every request and,
        when the wallet is invalid, rejects the call with a 400 whose body reads
        "... system wallet <id> does not exist". Without a dedicated check this
        surfaces as a misleading "failed to fetch dictionaries" error. Exercising
        a lightweight metadata request here lets us raise an actionable message
        that points at the wallet configuration. Non-wallet failures are deferred
        to the GetDictionaries step so they are not mislabelled as a wallet issue.
        """
        wallet_id = getattr(self.config, "biqSystemWalletId", None)
        if wallet_id:
            try:
                self._make_request("GET", "/api/metadata/dictionary", params={"limit": 1})
            except Exception as exc:
                body = self._safe_response_body(getattr(exc, "response", None))
                if SYSTEM_WALLET_ERROR_MARKER in body.lower():
                    raise ConnectionError(
                        f"BurstIQ system wallet '{wallet_id}' is invalid or does not exist. "
                        "Verify the 'BurstIQ System Wallet ID' (biqSystemWalletId) in the connection "
                        f"configuration. BurstIQ response: {body}"
                    ) from exc
                logger.debug(f"System wallet validation deferred to GetDictionaries (non-wallet error): {exc}")

    @staticmethod
    def _safe_response_body(response: Optional[requests.Response], max_length: int = 500) -> str:  # noqa: UP045
        """
        Extract the response body for error diagnostics.

        BurstIQ returns a 400 with an empty reason phrase but an informative
        body explaining why the request was rejected. Capturing it surfaces the
        real cause (e.g. missing header, invalid limit, wallet not found)
        instead of the opaque "400 Client Error:  for url".
        """
        body = ""
        if response is not None:
            text = (response.text or "").strip()
            if text:
                body = text if len(text) <= max_length else f"{text[:max_length]}... (truncated)"
        return body

    def get_dictionaries(self, limit: Optional[int] = None) -> List[BurstIQDictionary]:  # noqa: UP006, UP045
        """
        Fetch all data dictionaries from BurstIQ

        Args:
            limit: Optional limit on number of dictionaries to fetch

        Returns:
            List of BurstIQDictionary model instances
        """
        params = {}
        if limit:
            params["limit"] = limit

        logger.info("Fetching dictionaries from BurstIQ...")
        data = self._make_request("GET", "/api/metadata/dictionary", params=params)

        if data is None:
            return []

        raw_items = data if isinstance(data, list) else [data]
        dictionaries = [BurstIQDictionary.model_validate(item) for item in raw_items]
        logger.info(f"Found {len(dictionaries)} dictionaries")
        return dictionaries

    def get_dictionary_by_name(self, name: str) -> Optional[BurstIQDictionary]:  # noqa: UP045
        """
        Get a specific dictionary by name

        Args:
            name: Dictionary name

        Returns:
            BurstIQDictionary instance or None
        """
        logger.debug(f"Fetching dictionary: {name}")
        data = self._make_request("GET", f"/api/metadata/dictionary/{name}")
        if data is None:
            return None
        return BurstIQDictionary.model_validate(data)

    def get_edges(
        self,
        name: Optional[str] = None,  # noqa: UP045
        from_dictionary: Optional[str] = None,  # noqa: UP045
        to_dictionary: Optional[str] = None,  # noqa: UP045
        limit: Optional[int] = None,  # noqa: UP045
        skip: Optional[int] = None,  # noqa: UP045
    ) -> List[BurstIQEdge]:  # noqa: UP006
        """
        Query edge definitions (lineage relationships) from BurstIQ

        Args:
            name: Optional edge name filter
            from_dictionary: Optional source dictionary filter
            to_dictionary: Optional target dictionary filter
            limit: Optional limit on number of edges to fetch
            skip: Optional number of edges to skip (pagination)

        Returns:
            List of BurstIQEdge model instances
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

        logger.info(f"Fetching edges from BurstIQ (filters: name={name}, from={from_dictionary}, to={to_dictionary})")
        data = self._make_request("GET", "/api/metadata/edge", params=params)

        if data is None:
            return []

        raw_items = data if isinstance(data, list) else [data]
        edges = [BurstIQEdge.model_validate(item) for item in raw_items]
        logger.info(f"Found {len(edges)} edge definitions")
        return edges

    def get_chain_metrics(self) -> Dict[str, int]:  # noqa: UP006
        """
        Fetch asset counts per chain from BurstIQ metrics endpoint.

        Returns:
            Dict mapping chain name to asset (row) count
        """
        if self._chain_metrics is not None:
            return self._chain_metrics
        logger.info("Fetching chain metrics from BurstIQ...")
        data = self._make_request("GET", "/api/metrics/sdz")
        if data is None:
            return {}
        metrics = SdzMetricsResponse.model_validate(data)
        self._chain_metrics = {name: chain.assets for name, chain in metrics.chainMetrics.items()}
        return self._chain_metrics

    def get_records_by_tql(self, chain: str, limit: int, skip: int = 0) -> List[Dict[str, Any]]:  # noqa: UP006
        """
        Fetch data records from a chain using TQL (Temporal Query Language).

        Args:
            chain: Chain (dictionary) name to query
            limit: Maximum number of records to fetch
            skip: Number of records to skip (for pagination)

        Returns:
            List of flat record dicts (data envelope unwrapped)
        """
        tql = f"FROM {chain} SKIP {skip} LIMIT {limit} SELECT data.*"
        logger.info(f"Fetching records for chain '{chain}' via TQL (limit={limit})")
        try:
            raw = self._make_request("POST", "/api/graphchain/query", json={"query": tql})
        except Exception as exc:
            logger.warning(f"TQL query failed for chain '{chain}': {exc}")
            return []

        if not isinstance(raw, list):
            return []

        records = [TQLRecord.model_validate(item).to_record() for item in raw if isinstance(item, dict)]
        logger.info(f"Fetched {len(records)} records for chain '{chain}'")
        return records

    def close(self):
        pass
