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
Paginated Unity Catalog listing helpers.

Unity Catalog rejects unpaginated ``list`` calls on large metastores with
``InvalidParameterValue: The List... result set is too large to return in a single
response ... #UC-PGRQD``, so every listing this connector issues has to ask for a
page instead of the whole result set.
"""

from collections.abc import Iterator
from typing import Any, cast

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.catalog import CatalogInfo

# Unity Catalog reads max_results=0 as "use the server configured page size", the
# value Databricks recommends: a positive value is capped by the server anyway, and
# leaving it unset is what asks for the entire result set and trips #UC-PGRQD.
SERVER_PAGE_SIZE = 0

CATALOGS_API_PATH = "/api/2.1/unity-catalog/catalogs"


def list_catalogs(client: WorkspaceClient) -> Iterator[CatalogInfo]:
    """
    Yield every catalog in the metastore, one page at a time.

    ``client.catalogs.list()`` cannot be used: the pinned databricks-sdk exposes no
    pagination parameters for it and issues a single unpaginated request, so this walks
    the REST endpoint directly. A page may come back empty while more catalogs remain —
    only a missing ``next_page_token`` means the listing is exhausted.
    """
    headers = {"Accept": "application/json"}
    page_token = None
    while True:
        query: dict[str, Any] = {"max_results": SERVER_PAGE_SIZE}
        if page_token:
            query["page_token"] = page_token
        response = cast(
            "dict[str, Any]",
            client.api_client.do("GET", CATALOGS_API_PATH, query=query, headers=headers),
        )
        for catalog in response.get("catalogs") or []:
            yield CatalogInfo.from_dict(catalog)
        next_page_token = response.get("next_page_token")
        # A repeated token would page over the same results forever.
        if not next_page_token or next_page_token == page_token:
            return
        page_token = next_page_token
