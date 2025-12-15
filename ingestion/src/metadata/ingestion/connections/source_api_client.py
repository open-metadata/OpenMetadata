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
REST client wrapper for source API calls with metrics tracking.

This module provides a TrackedREST class that wraps the base REST client
and automatically records metrics for API calls to source systems
(e.g., Tableau, Metabase, PowerBI, etc.).

Usage:
    from metadata.ingestion.connections.source_api_client import TrackedREST

    # Use TrackedREST instead of REST for source API clients
    client = TrackedREST(client_config)
    response = client.get("/dashboards")  # Automatically tracked
"""
from time import perf_counter
from typing import Optional

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.operation_metrics import OperationMetricsState


class TrackedREST(REST):
    """
    REST client that tracks API calls under 'source_api_calls' category.

    Use this class for source API clients (Tableau, Metabase, PowerBI, etc.)
    to automatically collect metrics on API call duration and frequency.

    Metrics are recorded asynchronously to minimize latency impact.
    """

    def __init__(self, config: ClientConfig, source_name: Optional[str] = None):
        """
        Initialize TrackedREST client.

        Args:
            config: REST client configuration
            source_name: Optional name to identify the source system in metrics.
                        If not provided, extracts from base_url.
        """
        super().__init__(config)
        self._source_name = source_name or self._extract_source_name(config.base_url)
        self._metrics = OperationMetricsState()

    @staticmethod
    def _extract_source_name(base_url: str) -> str:
        """Extract a short source name from the base URL."""
        try:
            # Remove protocol and extract domain
            url = base_url.replace("https://", "").replace("http://", "")
            # Get first part of domain
            domain = url.split("/")[0].split(":")[0]
            # Remove common suffixes for cleaner names
            for suffix in [".com", ".io", ".net", ".org", ".cloud"]:
                domain = domain.replace(suffix, "")
            return domain.split(".")[-1]  # Get the main domain name
        except Exception:
            return "unknown"

    def _extract_api_path(self, path: str) -> str:
        """
        Extract a meaningful API path for metrics.

        Replaces IDs and UUIDs with placeholders for better aggregation.
        Example: /dashboard/123-abc -> /dashboard/{id}
        """
        import re

        parts = path.split("?")[0].split("/")
        cleaned_parts = []
        for part in parts:
            if not part:
                continue
            # Replace UUIDs and numeric IDs with {id}
            if re.match(
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                part,
                re.IGNORECASE,
            ):
                cleaned_parts.append("{id}")
            elif re.match(r"^\d+$", part):
                cleaned_parts.append("{id}")
            elif re.match(r"^[a-f0-9]{24}$", part, re.IGNORECASE):
                # MongoDB-style ObjectIds
                cleaned_parts.append("{id}")
            else:
                cleaned_parts.append(part)
        return "/" + "/".join(cleaned_parts) if cleaned_parts else "/"

    def _record_api_call(self, method: str, path: str, duration_ms: float) -> None:
        """Record an API call metric."""
        api_path = self._extract_api_path(path)
        operation = f"{method}:{api_path}"
        self._metrics.record_operation(
            category="source_api_calls",
            operation=operation,
            duration_ms=duration_ms,
            entity_type=self._source_name,
        )

    def get(self, path, data=None):
        """GET method with tracking."""
        start = perf_counter()
        try:
            return super().get(path, data)
        finally:
            duration_ms = (perf_counter() - start) * 1000
            self._record_api_call("GET", path, duration_ms)

    def post(self, path, data=None, json=None):
        """POST method with tracking."""
        start = perf_counter()
        try:
            return super().post(path, data, json)
        finally:
            duration_ms = (perf_counter() - start) * 1000
            self._record_api_call("POST", path, duration_ms)

    def put(self, path, data=None, json=None, headers=None):
        """PUT method with tracking."""
        start = perf_counter()
        try:
            return super().put(path, data, json, headers)
        finally:
            duration_ms = (perf_counter() - start) * 1000
            self._record_api_call("PUT", path, duration_ms)

    def patch(self, path, data=None):
        """PATCH method with tracking."""
        start = perf_counter()
        try:
            return super().patch(path, data)
        finally:
            duration_ms = (perf_counter() - start) * 1000
            self._record_api_call("PATCH", path, duration_ms)

    def delete(self, path, data=None):
        """DELETE method with tracking."""
        start = perf_counter()
        try:
            return super().delete(path, data)
        finally:
            duration_ms = (perf_counter() - start) * 1000
            self._record_api_call("DELETE", path, duration_ms)
