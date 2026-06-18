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

from requests.exceptions import ConnectionError as RequestsConnectionError
from simple_salesforce.api import Salesforce
from simple_salesforce.exceptions import (
    SalesforceAuthenticationFailed,
    SalesforceExpiredSession,
    SalesforceGeneralError,
    SalesforceMalformedRequest,
    SalesforceMoreThanOneRecord,
    SalesforceRefusedRequest,
    SalesforceResourceNotFound,
)
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_fixed

from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.utils import get_json_config
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_SALESFORCE_API_ERRORS = (
    SalesforceResourceNotFound,
    SalesforceRefusedRequest,
    SalesforceMoreThanOneRecord,
    SalesforceMalformedRequest,
    SalesforceExpiredSession,
    SalesforceAuthenticationFailed,
    SalesforceGeneralError,
)


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
    except _SALESFORCE_API_ERRORS as exc:
        _warn(f"Error fetching {metadata_type} from Data 360: {exc}")
        return None


def _run_paginator(
    client: Salesforce,
    object_type: str,
    path: str,
    limit: int,
    log_warning: Callable,
) -> list:
    """Fetches all pages of a paginated Data 360 API endpoint and returns all items."""
    json_config = get_json_config(object_type=object_type)
    params = {
        json_config.get(Constant.LIMIT): limit,
        json_config.get(Constant.OFFSET): 0,
    }
    total_objects = []

    response = None
    for _ in range(3):
        if response:
            break
        response = _get(
            client=client,
            path=path,
            params=params,
            metadata_type=object_type,
            log_warning=log_warning,
        )

    if not response:
        log_warning(f"No response from Data 360 API for {object_type} at {path}")
        return total_objects

    if object_type == MetadataTypesConstant.CALCULATED_INSIGHT:
        response = response.get(ResponseConstant.COLLECTION)

    total_size = response.get(json_config.get(ResponseConstant.TOTAL_SIZE), 0)
    total_objects = list(response.get(json_config.get(ResponseConstant.ITEMS), []))

    page = 1
    while (total_size - page * limit) > 0:
        params[json_config.get(Constant.OFFSET)] = page * limit
        page_response = _get(
            client=client,
            path=path,
            params=params,
            metadata_type=object_type,
            log_warning=log_warning,
        )
        page += 1
        if not page_response:
            log_warning(f"Skipping page {page} for {object_type}: API returned no response")
            continue
        if object_type == MetadataTypesConstant.CALCULATED_INSIGHT:
            page_response = page_response.get(ResponseConstant.COLLECTION)
        total_objects.extend(page_response.get(json_config.get(ResponseConstant.ITEMS), []))

    return total_objects


def get_dataspaces(client: Salesforce, limit: int, log_warning: Callable) -> list:
    """Fetches all data spaces from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.DATASPACES,
        path="ssot/data-spaces",
        limit=limit,
        log_warning=log_warning,
    )


def get_metadata_by_type(
    client: Salesforce, entity_type: str, dataspace_name: str, log_warning: Callable
) -> dict | None:
    """Fetches metadata objects of the given type within a dataspace."""
    return _get(
        client=client,
        path="ssot/metadata",
        params={"dataspace": dataspace_name, "entityType": entity_type},
        metadata_type=entity_type,
        log_warning=log_warning,
    )


def get_calculated_insight_by_name(
    client: Salesforce, entity_name: str, log_warning: Callable
) -> dict | None:
    """Fetches a single Calculated Insight definition by name."""
    return _get(
        client=client,
        path=f"ssot/calculated-insights/{entity_name}",
        metadata_type=MetadataTypesConstant.CALCULATED_INSIGHT,
        log_warning=log_warning,
    )


def get_datastreams(client: Salesforce, pagination_limit: int, log_warning: Callable) -> list:
    """Fetches all data streams (including field mappings) from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.DATASTREAMS,
        path="ssot/data-streams?includeMappings=true",
        limit=pagination_limit,
        log_warning=log_warning,
    )


def get_calculated_insights(
    client: Salesforce, pagination_limit: int, log_warning: Callable
) -> list:
    """Fetches all Calculated Insights from Data 360."""
    return _run_paginator(
        client=client,
        object_type=MetadataTypesConstant.CALCULATED_INSIGHT,
        path="ssot/calculated-insights",
        limit=pagination_limit,
        log_warning=log_warning,
    )


def get_dmo_mappings(
    client: Salesforce, dataspace_name: str, dmo_name: str, log_warning: Callable
) -> dict | None:
    """Fetches DataModelObject field mappings for lineage."""
    return _get(
        client=client,
        path="ssot/data-model-object-mappings",
        params={"dataspace": dataspace_name, "dmoDeveloperName": dmo_name},
        metadata_type="DataModelObjectMappings",
        log_warning=log_warning,
    )


def get_datatransforms(
    client: Salesforce, pagination_limit: int, log_warning: Callable
) -> list:
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
    client: Salesforce, name: str, limit: int, log_warning: Callable
) -> dict | None:
    """Fetches the run history for a specific data transform."""
    return _get(
        client=client,
        path=f"ssot/data-transforms/{name}/run-history",
        params={Constant.LIMIT: limit},
        metadata_type="Data Transform Run History",
        log_warning=log_warning,
    )
