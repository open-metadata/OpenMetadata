#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""BROWSE-aware Unity Catalog metadata reads without upgrading databricks-sdk."""

from collections.abc import Iterator
from typing import Any
from urllib.parse import quote

from databricks.sdk import WorkspaceClient


def iter_browse_items(
    client: WorkspaceClient, resource: str, collection: str, **filters: Any
) -> Iterator[dict[str, Any]]:
    """The pinned SDK predates include_browse; preserve API pagination directly."""
    # max_results=0 makes the server paginate with its configured page size; leaving it
    # unset returns every table of a schema in one response, which OOMs the pod on
    # schemas with many wide tables.
    query: dict[str, Any] = {"include_browse": "true", "max_results": 0, **filters}
    seen_tokens: set[str] = set()
    while True:
        response = client.api_client.do("GET", f"/api/2.1/unity-catalog/{resource}", query=query)
        if not isinstance(response, dict):
            # do() is typed dict | BinaryIO. A non-dict body carries no next_page_token
            # we can trust, and reading one off it would spin this loop forever.
            raise TypeError(f"expected a JSON object, got {type(response).__name__}")
        yield from response.get(collection) or []
        page_token = response.get("next_page_token")
        if not page_token:
            return
        if page_token in seen_tokens:
            raise RuntimeError(f"Unity Catalog reissued page token [{page_token}] for {resource}")
        seen_tokens.add(page_token)
        query["page_token"] = page_token


def get_browse_item(client: WorkspaceClient, resource: str, full_name: str) -> dict[str, Any]:
    """Use BROWSE visibility for a metadata GET, never SELECT privileges."""
    response = client.api_client.do(
        "GET",
        f"/api/2.1/unity-catalog/{resource}/{quote(full_name, safe='')}",
        query={"include_browse": "true"},
    )
    if not isinstance(response, dict):
        raise TypeError(f"expected a JSON object, got {type(response).__name__}")
    return response
