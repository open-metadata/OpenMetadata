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
REST client wrapper over Kestra's open-source API.

Supports both pre-tenant Kestra (`/api/v1/...`, < 0.18) and tenant-scoped
Kestra (`/api/v1/{tenantId}/...`, 0.18+). When `tenantId` is empty or None
the client uses the non-tenant path, matching older deployments.
"""

from collections.abc import Iterator
from urllib.parse import quote

import requests

from metadata.generated.schema.entity.services.connections.pipeline.kestraConnection import (
    KestraConnection,
)
from metadata.ingestion.source.pipeline.kestra.models import (
    KestraExecution,
    KestraFlow,
    KestraGraph,
    KestraSearchResult,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

DEFAULT_PAGE_SIZE = 200
DEFAULT_TIMEOUT = 30


class KestraClient:
    """
    Wrapper to Kestra REST API.

    Auth precedence: token > basic > no-auth. Token wins if both are set.
    """

    def __init__(self, config: KestraConnection):
        self.base = clean_uri(str(config.hostPort))
        tenant = (config.tenantId or "").strip()
        self.tenant_id = tenant if tenant else None
        self.timeout = DEFAULT_TIMEOUT
        self._session = requests.Session()
        self._session.verify = bool(config.verifySSL) if config.verifySSL is not None else True
        token_val = self._secret(config.token)
        password_val = self._secret(config.password)
        if token_val:
            self._session.headers["Authorization"] = f"Bearer {token_val}"
        elif config.username and password_val:
            self._session.auth = (config.username, password_val)

    @staticmethod
    def _secret(field):
        if field is None:
            return None
        if hasattr(field, "get_secret_value"):
            return field.get_secret_value()
        return str(field)

    def _url(self, path: str) -> str:
        if self.tenant_id:
            return f"{self.base}/api/v1/{self.tenant_id}{path}"
        return f"{self.base}/api/v1{path}"

    def _get_json(self, path: str, **params) -> dict:
        resp = self._session.get(self._url(path), params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    # --- flows ---

    def search_flows(
        self,
        namespace: str | None = None,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> Iterator[KestraFlow]:
        page = 1
        while True:
            params = {"page": page, "size": page_size, "sort": "id:asc"}
            if namespace:
                params["namespace"] = namespace
            data = self._get_json("/flows/search", **params)
            parsed = KestraSearchResult.model_validate(data)
            if not parsed.results:
                break
            for item in parsed.results:
                yield KestraFlow.model_validate(item)
            if len(parsed.results) < page_size:
                break
            page += 1

    def get_flow(self, namespace: str, flow_id: str) -> KestraFlow:
        data = self._get_json(f"/flows/{quote(namespace, safe='')}/{quote(flow_id, safe='')}")
        return KestraFlow.model_validate(data)

    def get_flow_graph(self, namespace: str, flow_id: str) -> KestraGraph:
        data = self._get_json(f"/flows/{quote(namespace, safe='')}/{quote(flow_id, safe='')}/graph")
        return KestraGraph.model_validate(data)

    # --- executions ---

    def search_executions(
        self,
        namespace: str | None = None,
        flow_id: str | None = None,
        page_size: int = 50,
        max_pages: int = 5,
    ) -> Iterator[KestraExecution]:
        page = 1
        while page <= max_pages:
            params = {"page": page, "size": page_size, "sort": "state.startDate:desc"}
            if namespace:
                params["namespace"] = namespace
            if flow_id:
                params["flowId"] = flow_id
            data = self._get_json("/executions/search", **params)
            parsed = KestraSearchResult.model_validate(data)
            if not parsed.results:
                break
            for item in parsed.results:
                yield KestraExecution.model_validate(item)
            if len(parsed.results) < page_size:
                break
            page += 1

    def get_execution(self, execution_id: str) -> KestraExecution:
        data = self._get_json(f"/executions/{quote(execution_id, safe='')}")
        return KestraExecution.model_validate(data)

    def ping(self) -> bool:
        """Cheap liveness probe used by test_connection."""
        resp = self._session.get(
            self._url("/flows/search"),
            params={"size": 1},
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return True

    def close(self) -> None:
        """Release the underlying HTTP session."""
        self._session.close()

    def __enter__(self) -> "KestraClient":
        return self

    def __exit__(self, *_args) -> None:
        self.close()
