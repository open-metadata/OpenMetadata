#  Copyright 2025 OpenMetadata
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""REST client for the Rill runtime API."""

import re
from typing import Iterable, List, Optional, Tuple  # noqa: UP035
from urllib.parse import unquote, urlparse

from metadata.generated.schema.entity.services.connections.dashboard.rillConnection import (
    RillConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.dashboard.rill.models import (
    RillGetResourceResponse,
    RillListResourcesResponse,
    RillResource,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri

DEFAULT_INSTANCE_ID = "default"
PAGE_SIZE = 100
EXPLORE_KIND = "rill.runtime.v1.Explore"
CANVAS_KIND = "rill.runtime.v1.Canvas"
COMPONENT_KIND = "rill.runtime.v1.Component"
METRICS_VIEW_KIND = "rill.runtime.v1.MetricsView"
MODEL_KIND = "rill.runtime.v1.Model"
RILL_CLOUD_PROJECT_PATH = re.compile(
    r"^/v1/(?:orgs|organizations)/(?P<org>[^/]+)/projects/(?P<project>[^/]+)"
    r"(?:/branch/(?P<branch>[^/]+))?$"
)


def get_rill_cloud_project(host_port: str) -> Optional[Tuple[str, str]]:  # noqa: UP006, UP045
    """Extract the organization and project from a Rill Cloud API URL."""
    match = RILL_CLOUD_PROJECT_PATH.fullmatch(urlparse(host_port).path.rstrip("/"))
    if not match:
        return None
    return unquote(match.group("org")), unquote(match.group("project"))


class RillApiClient:
    """Client for resources exposed by a Rill runtime instance."""

    client: TrackedREST

    def __init__(self, config: RillConnection) -> None:
        self.config = config
        host_port = clean_uri(str(config.hostPort))
        token = config.token.get_secret_value() if config.token else None
        cloud_match = RILL_CLOUD_PROJECT_PATH.fullmatch(urlparse(host_port).path.rstrip("/"))
        if cloud_match and cloud_match.group("branch"):
            raise ValueError(
                "Rill Cloud branch-level routing is not supported yet. Remove the "
                f"'/branch/{cloud_match.group('branch')}' segment from the project URL [{host_port}]."
            )
        is_cloud = cloud_match is not None
        if is_cloud and not token:
            raise ValueError(
                f"An API token is required to connect to the Rill Cloud project at [{host_port}]. "
                "Provide the token in the connection configuration."
            )
        api_version = "runtime" if is_cloud else f"v1/instances/{DEFAULT_INSTANCE_ID}"
        client_config = ClientConfig(
            base_url=host_port,
            api_version=api_version,
            access_token=token,
            auth_header=AUTHORIZATION_HEADER if token else None,
            auth_token_mode="Bearer" if token else None,
        )
        self.client = TrackedREST(client_config, source_name="rill")

    @property
    def _resources_path(self) -> str:
        return "/resources"

    def test_access(self) -> dict:
        """Verify access to the configured Rill project."""
        response = self.client.get(self._resources_path, data={"pageSize": 1})
        return response or {}

    def _paginate_resources(self, kind: str) -> Iterable[RillResource]:
        page_token = None
        while True:
            params = {"kind": kind, "pageSize": PAGE_SIZE}
            if page_token:
                params["pageToken"] = page_token

            response = RillListResourcesResponse.model_validate(self.client.get(self._resources_path, data=params))
            yield from response.resources

            page_token = response.next_page_token
            if not page_token:
                break

    def get_dashboards(self) -> List[RillResource]:  # noqa: UP006
        """Return Explore and Canvas dashboards."""
        return [
            *self._paginate_resources(EXPLORE_KIND),
            *self._paginate_resources(CANVAS_KIND),
        ]

    def get_components(self) -> List[RillResource]:  # noqa: UP006
        """Return chart-like components used by Canvas dashboards."""
        return list(self._paginate_resources(COMPONENT_KIND))

    def get_datamodels(self) -> List[RillResource]:  # noqa: UP006
        """Return SQL models and metrics views."""
        return [
            *self._paginate_resources(MODEL_KIND),
            *self._paginate_resources(METRICS_VIEW_KIND),
        ]

    def get_resource(self, kind: str, name: str) -> RillResource:
        """Fetch the current details for one catalog resource."""
        response = RillGetResourceResponse.model_validate(
            self.client.get(
                "/resource",
                data={"name.kind": kind, "name.name": name},
            )
        )
        if response.resource is None:
            raise ValueError(f"Rill resource [{kind}/{name}] was not returned by the API")
        return response.resource
