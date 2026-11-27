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
Solr REST client.

Talks to a Solr instance over its HTTP admin and schema APIs. The same client
works for a standalone Solr and for SolrCloud (point ``base_url`` at any node of
the cluster); collections are discovered through the Collections API with a
fallback to the Cores API for standalone instances.
"""

from typing import Any

import requests

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

COLLECTIONS_LIST = "admin/collections"
CORES_STATUS = "admin/cores"
SYSTEM_INFO = "admin/info/system"


class SolrClient:
    """Thin wrapper over the Solr HTTP API used for metadata extraction."""

    def __init__(
        self,
        base_url: str,
        username: str | None = None,
        password: str | None = None,
        verify_ssl: bool | str | None = True,
        timeout: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        if username:
            self.session.auth = (username, password or "")
        # requests treats ``None`` as "verify with default CAs"; keep that meaning
        # only when the caller did not opt out via verify_ssl=False.
        self.session.verify = True if verify_ssl is None else verify_ssl

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        query = {"wt": "json"}
        if params:
            query.update(params)
        response = self.session.get(
            f"{self.base_url}/{path}",
            params=query,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def get_system_info(self) -> dict[str, Any]:
        """Reach the instance and read its system information (access check)."""
        return self._get(SYSTEM_INFO)

    def list_collections(self) -> list[str]:
        """
        List collection names.

        SolrCloud answers the Collections API; a standalone Solr does not, so we
        fall back to the Cores API and return the core names instead.
        """
        try:
            payload = self._get(COLLECTIONS_LIST, params={"action": "LIST"})
            collections = payload.get("collections")
            if collections:
                return list(collections)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug("Collections API unavailable (%s); falling back to the Cores API", exc)
        cores = self._get(CORES_STATUS, params={"action": "STATUS"})
        return list((cores.get("status") or {}).keys())

    def get_schema(self, collection: str) -> dict[str, Any]:
        """Return the raw Solr schema for a collection/core."""
        payload = self._get(f"{collection}/schema")
        return payload.get("schema") or {}

    def get_sample_documents(self, collection: str, size: int) -> list[dict[str, Any]]:
        """Return up to ``size`` documents from a collection for sample data."""
        payload = self._get(
            f"{collection}/select",
            params={"q": "*:*", "rows": size},
        )
        return (payload.get("response") or {}).get("docs") or []

    def close(self) -> None:
        self.session.close()
