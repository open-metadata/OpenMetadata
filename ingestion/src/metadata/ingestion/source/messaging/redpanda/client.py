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
Redpanda Admin API client for data transforms
"""

import traceback

import requests
from pydantic import BaseModel
from requests.exceptions import RequestException

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_TIMEOUT = 30


class RedpandaTransform(BaseModel):
    name: str
    input_topic: str
    output_topics: list[str]
    status: str | None = None
    environment: dict | None = None


class RedpandaAdminClient:
    """HTTP client for Redpanda Admin API (port 9644).

    The admin API is accessed over HTTP(S) via ``requests.Session``. For HTTPS
    endpoints with a custom CA or mutual TLS, pass ``verify`` (CA bundle path
    or ``False`` to disable verification) and ``client_cert``
    (``(cert_path, key_path)`` tuple).
    """

    def __init__(
        self,
        admin_api_url: str,
        verify: str | bool = True,
        client_cert: tuple[str, str] | None = None,
    ):
        self.base_url = admin_api_url.rstrip("/")
        self.session = requests.Session()
        self.session.verify = verify
        if client_cert:
            self.session.cert = client_cert

    def close(self) -> None:
        """Close the underlying HTTP session and release pooled connections."""
        self.session.close()

    def list_transforms(self) -> list[RedpandaTransform]:
        """
        Fetch all data transforms from Redpanda Admin API.
        Endpoint: GET /v1/transform
        """
        transforms: list[RedpandaTransform] = []
        try:
            response = self.session.get(
                f"{self.base_url}/v1/transform",
                timeout=API_TIMEOUT,
            )
            response.raise_for_status()
            transforms.extend(
                RedpandaTransform(
                    name=item.get("name", ""),
                    input_topic=item.get("input_topic", ""),
                    output_topics=item.get("output_topics", []),
                    status=str(item.get("status")) if item.get("status") else None,
                    environment=item.get("environment"),
                )
                for item in response.json()
            )
        except RequestException as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch Redpanda transforms: {exc}")
        return transforms

    def check_connectivity(self) -> None:
        """Verify the Admin API is reachable."""
        response = self.session.get(
            f"{self.base_url}/v1/status/ready",
            timeout=API_TIMEOUT,
        )
        response.raise_for_status()
