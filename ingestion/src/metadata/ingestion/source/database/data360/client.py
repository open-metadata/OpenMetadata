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
API client methods for fetching metadata from Salesforce Data 360.
"""

from collections.abc import Callable
from typing import Any

from requests.exceptions import ConnectionError as RequestsConnectionError
from simple_salesforce.api import Salesforce
from simple_salesforce.exceptions import SalesforceResourceNotFound
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_fixed

from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
)
from metadata.ingestion.source.database.data360.exceptions import Data360ResponseError
from metadata.ingestion.source.database.data360.models import PaginatedPage
from metadata.ingestion.source.database.data360.utils import get_endpoint_paging
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Only a "resource not found" response is treated as a legitimate empty result.
# Every other Salesforce error (auth failure, expired session, refused/malformed
# request, general error) must propagate so callers don't mistake a genuine API
# failure for "no data".
_SALESFORCE_NOT_FOUND_ERRORS = (SalesforceResourceNotFound,)


@retry(
    retry=retry_if_exception_type(RequestsConnectionError),
    stop=stop_after_attempt(3),
    wait=wait_fixed(2),
    reraise=True,
)
def _get(
    client: Salesforce,
    path: str,
    metadata_type: str,
    params: dict | None = None,
    log_warning: Callable[[str], None] | None = None,
) -> dict | None:
    """Executes a GET request against the Data 360 REST API."""
    _warn = log_warning or logger.warning
    try:
        return client.restful(path=path, params=params)
    except _SALESFORCE_NOT_FOUND_ERRORS as exc:
        _warn(f"{metadata_type} not found in Data 360: {exc}")
        return None


def _run_paginator(
    client: Salesforce,
    object_type: str,
    path: str,
    limit: int,
    log_warning: Callable[[str], None],
    extra_params: dict | None = None,
) -> list[dict]:
    """Fetches all pages of a paginated Data 360 API endpoint and returns all items.

    Any page that cannot be fetched or validated aborts the whole listing instead of
    returning what was collected so far: callers treat the result as the complete set
    of live entities and soft-delete everything missing from it.
    """
    paging = get_endpoint_paging(object_type=object_type)
    params: dict[str, Any] = {
        paging.limit_param: limit,
        paging.offset_param: 0,
        **(extra_params or {}),
    }

    items: list[dict] = []
    fetched_pages = 0
    total_size: int | None = None

    while total_size is None or fetched_pages * limit < total_size:
        params[paging.offset_param] = fetched_pages * limit
        payload = _get(
            client=client,
            path=path,
            params=params,
            metadata_type=object_type,
            log_warning=log_warning,
        )
        if payload is None:
            raise Data360ResponseError(
                f"No response from Data 360 API for page {fetched_pages + 1} of {object_type} at {path}"
            )

        page = PaginatedPage.from_payload(
            payload=payload,
            paging=paging,
            context=f"page {fetched_pages + 1} of {object_type} at {path}",
        )
        total_size = page.total_size
        fetched_pages += 1

        if not page.items and fetched_pages * limit < total_size:
            raise Data360ResponseError(
                f"Data 360 reported {total_size} {object_type} at {path} but returned an empty page {fetched_pages}"
            )
        items.extend(page.items)

    return items


def get_dataspaces(client: Salesforce, limit: int, log_warning: Callable[[str], None]) -> list[dict]:
    """Fetches all data spaces from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.DATASPACES,
        path="ssot/data-spaces",
        limit=limit,
        log_warning=log_warning,
    )


def get_metadata_by_type(
    client: Salesforce,
    entity_type: str,
    dataspace_name: str,
    pagination_limit: int,
    log_warning: Callable[[str], None],
) -> list[dict]:
    """Fetches all metadata objects of the given type within a dataspace, across all pages."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.METADATA,
        path="ssot/metadata",
        limit=pagination_limit,
        log_warning=log_warning,
        extra_params={"dataspace": dataspace_name, "entityType": entity_type},
    )


def get_calculated_insight_by_name(
    client: Salesforce, entity_name: str, log_warning: Callable[[str], None]
) -> dict | None:
    """Fetches a single Calculated Insight definition by name."""
    return _get(
        client=client,
        path=f"ssot/calculated-insights/{entity_name}",
        metadata_type=MetadataTypesConstant.CALCULATED_INSIGHT,
        log_warning=log_warning,
    )


def get_datastreams(client: Salesforce, pagination_limit: int, log_warning: Callable[[str], None]) -> list[dict]:
    """Fetches all data streams (including field mappings) from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.DATASTREAMS,
        path="ssot/data-streams?includeMappings=true",
        limit=pagination_limit,
        log_warning=log_warning,
    )


def get_calculated_insights(
    client: Salesforce, pagination_limit: int, log_warning: Callable[[str], None]
) -> list[dict]:
    """Fetches all Calculated Insights from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.CALCULATED_INSIGHT,
        path="ssot/calculated-insights",
        limit=pagination_limit,
        log_warning=log_warning,
    )


def get_dmo_mappings(
    client: Salesforce, dataspace_name: str, dmo_name: str, log_warning: Callable[[str], None]
) -> dict | None:
    """Fetches DataModelObject field mappings for lineage."""
    return _get(
        client=client,
        path="ssot/data-model-object-mappings",
        params={"dataspace": dataspace_name, "dmoDeveloperName": dmo_name},
        metadata_type="DataModelObjectMappings",
        log_warning=log_warning,
    )


def get_datatransforms(client: Salesforce, pagination_limit: int, log_warning: Callable[[str], None]) -> list[dict]:
    """Fetches all data transforms from Data 360 (server-side cap of 20 per page)."""
    capped_limit = min(20, pagination_limit)
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.DATATRANSFORMS,
        path="ssot/data-transforms",
        limit=capped_limit,
        log_warning=log_warning,
    )


def get_data_transform_run_history(
    client: Salesforce, name: str, limit: int, log_warning: Callable[[str], None]
) -> dict | None:
    """Fetches the run history for a specific data transform."""
    return _get(
        client=client,
        path=f"ssot/data-transforms/{name}/run-history",
        params={Constant.LIMIT: limit},
        metadata_type="Data Transform Run History",
        log_warning=log_warning,
    )
