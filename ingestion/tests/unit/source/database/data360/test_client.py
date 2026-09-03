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
Unit tests for the Salesforce Data 360 API client helpers
"""

from unittest.mock import MagicMock

import pytest
from simple_salesforce.exceptions import SalesforceExpiredSession, SalesforceResourceNotFound

from metadata.ingestion.source.database.data360.client import (
    _get,
    _run_paginator,
    get_calculated_insight_by_name,
    get_calculated_insights,
    get_data_transform_run_history,
    get_dataspaces,
    get_datastreams,
    get_datatransforms,
    get_dmo_mappings,
    get_metadata_by_type,
)


def _client(restful_return_value=None, side_effect=None) -> MagicMock:
    client = MagicMock()
    if side_effect is not None:
        client.restful.side_effect = side_effect
    else:
        client.restful.return_value = restful_return_value
    return client


def test_get_returns_response_on_success():
    client = _client(restful_return_value={"foo": "bar"})
    log_warning = MagicMock()
    result = _get(client=client, path="ssot/data-spaces", metadata_type="Dataspaces", log_warning=log_warning)
    assert result == {"foo": "bar"}
    log_warning.assert_not_called()


def test_get_returns_none_and_warns_on_resource_not_found():
    client = _client(side_effect=SalesforceResourceNotFound("session", 404, "resource", "content"))
    log_warning = MagicMock()
    result = _get(client=client, path="ssot/data-spaces", metadata_type="Dataspaces", log_warning=log_warning)
    assert result is None
    log_warning.assert_called_once()
    assert "Dataspaces" in log_warning.call_args[0][0]


def test_get_raises_on_fatal_salesforce_api_error():
    client = _client(side_effect=SalesforceExpiredSession("session", 401, "resource", "content"))
    log_warning = MagicMock()
    with pytest.raises(SalesforceExpiredSession):
        _get(client=client, path="ssot/data-spaces", metadata_type="Dataspaces", log_warning=log_warning)
    log_warning.assert_not_called()


def test_run_paginator_single_page():
    client = _client(
        restful_return_value={
            "totalSize": 2,
            "dataSpaces": [{"name": "customer_360"}, {"name": "marketing"}],
        }
    )
    log_warning = MagicMock()
    result = _run_paginator(
        client=client,
        object_type="Dataspaces",
        path="ssot/data-spaces",
        limit=50,
        log_warning=log_warning,
    )
    assert result == [{"name": "customer_360"}, {"name": "marketing"}]
    client.restful.assert_called_once()


def test_run_paginator_walks_multiple_pages():
    page_one = {"totalSize": 3, "dataSpaces": [{"name": "a"}, {"name": "b"}]}
    page_two = {"totalSize": 3, "dataSpaces": [{"name": "c"}]}
    client = _client()
    client.restful.side_effect = [page_one, page_two]
    log_warning = MagicMock()
    result = _run_paginator(
        client=client,
        object_type="Dataspaces",
        path="ssot/data-spaces",
        limit=2,
        log_warning=log_warning,
    )
    assert result == [{"name": "a"}, {"name": "b"}, {"name": "c"}]
    assert client.restful.call_count == 2


def test_run_paginator_raises_on_a_failed_page():
    page_one = {"totalSize": 4, "dataSpaces": [{"name": "a"}, {"name": "b"}]}
    client = _client()
    client.restful.side_effect = [page_one, None]
    log_warning = MagicMock()
    # A failed page must raise rather than silently return a partial listing,
    # since callers use this result to mark unseen entities as deleted.
    with pytest.raises(RuntimeError, match="Failed to fetch page"):
        _run_paginator(
            client=client,
            object_type="Dataspaces",
            path="ssot/data-spaces",
            limit=2,
            log_warning=log_warning,
        )


def test_run_paginator_raises_when_first_page_has_no_response():
    client = _client(restful_return_value=None)
    log_warning = MagicMock()
    # A failed initial fetch must raise rather than silently return an empty
    # listing, since callers use this result to mark unseen entities as deleted.
    with pytest.raises(RuntimeError, match="No response from Data 360 API"):
        _run_paginator(
            client=client,
            object_type="Dataspaces",
            path="ssot/data-spaces",
            limit=50,
            log_warning=log_warning,
        )


def test_run_paginator_unwraps_calculated_insight_collection():
    client = _client(
        restful_return_value={
            "collection": {
                "total": 1,
                "items": [{"apiName": "revenue_ci"}],
            }
        }
    )
    log_warning = MagicMock()
    result = _run_paginator(
        client=client,
        object_type="CalculatedInsight",
        path="ssot/calculated-insights",
        limit=50,
        log_warning=log_warning,
    )
    assert result == [{"apiName": "revenue_ci"}]


def test_run_paginator_raises_when_collection_missing_on_first_page():
    client = _client(restful_return_value={"total": 1})
    log_warning = MagicMock()
    with pytest.raises(RuntimeError, match="Missing 'collection'"):
        _run_paginator(
            client=client,
            object_type="CalculatedInsight",
            path="ssot/calculated-insights",
            limit=50,
            log_warning=log_warning,
        )


def test_run_paginator_raises_when_collection_missing_on_later_page():
    page_one = {"collection": {"total": 2, "items": [{"apiName": "a"}]}}
    client = _client()
    client.restful.side_effect = [page_one, {"total": 2}]
    log_warning = MagicMock()
    with pytest.raises(RuntimeError, match="Missing 'collection'"):
        _run_paginator(
            client=client,
            object_type="CalculatedInsight",
            path="ssot/calculated-insights",
            limit=1,
            log_warning=log_warning,
        )


def test_get_dataspaces_delegates_to_paginator():
    client = _client(restful_return_value={"totalSize": 0, "dataSpaces": []})
    result = get_dataspaces(client, limit=25, log_warning=MagicMock())
    assert result == []
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["path"] == "ssot/data-spaces"
    assert called_kwargs["params"]["limit"] == 25


def test_get_datastreams_requests_field_mappings():
    client = _client(restful_return_value={"totalSize": 0, "dataStreams": []})
    get_datastreams(client, pagination_limit=10, log_warning=MagicMock())
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["path"] == "ssot/data-streams?includeMappings=true"


def test_get_calculated_insights_delegates_to_paginator():
    client = _client(restful_return_value={"collection": {"total": 0, "items": []}})
    result = get_calculated_insights(client, pagination_limit=10, log_warning=MagicMock())
    assert result == []


def test_get_datatransforms_caps_pagination_limit_at_twenty():
    client = _client(restful_return_value={"totalSize": 0, "dataTransforms": []})
    get_datatransforms(client, pagination_limit=200, log_warning=MagicMock())
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["params"]["limit"] == 20


def test_get_datatransforms_respects_lower_pagination_limit():
    client = _client(restful_return_value={"totalSize": 0, "dataTransforms": []})
    get_datatransforms(client, pagination_limit=5, log_warning=MagicMock())
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["params"]["limit"] == 5


def test_get_metadata_by_type_passes_dataspace_and_entity_type():
    client = _client(restful_return_value={"totalSize": 0, "metadata": []})
    result = get_metadata_by_type(
        client,
        entity_type="DataLakeObject",
        dataspace_name="customer_360",
        pagination_limit=50,
        log_warning=MagicMock(),
    )
    assert result == []
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["params"]["dataspace"] == "customer_360"
    assert called_kwargs["params"]["entityType"] == "DataLakeObject"


def test_get_metadata_by_type_walks_multiple_pages():
    page_one = {
        "totalSize": 3,
        "metadata": [{"name": "a"}, {"name": "b"}],
    }
    page_two = {"totalSize": 3, "metadata": [{"name": "c"}]}
    client = _client()
    client.restful.side_effect = [page_one, page_two]
    result = get_metadata_by_type(
        client,
        entity_type="DataLakeObject",
        dataspace_name="customer_360",
        pagination_limit=2,
        log_warning=MagicMock(),
    )
    assert result == [{"name": "a"}, {"name": "b"}, {"name": "c"}]
    assert client.restful.call_count == 2


def test_get_metadata_by_type_raises_on_fatal_api_error():
    client = _client(side_effect=SalesforceExpiredSession("session", 401, "resource", "content"))
    with pytest.raises(SalesforceExpiredSession):
        get_metadata_by_type(
            client,
            entity_type="DataLakeObject",
            dataspace_name="customer_360",
            pagination_limit=50,
            log_warning=MagicMock(),
        )


def test_get_calculated_insight_by_name_builds_entity_path():
    client = _client(restful_return_value={"expression": "SUM(Amount)"})
    result = get_calculated_insight_by_name(client, "revenue_cio", log_warning=MagicMock())
    assert result == {"expression": "SUM(Amount)"}
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["path"] == "ssot/calculated-insights/revenue_cio"


def test_get_dmo_mappings_passes_dataspace_and_dmo_name():
    client = _client(restful_return_value={"mappings": []})
    result = get_dmo_mappings(client, dataspace_name="customer_360", dmo_name="Account__dlm", log_warning=MagicMock())
    assert result == {"mappings": []}
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["params"] == {"dataspace": "customer_360", "dmoDeveloperName": "Account__dlm"}


def test_get_data_transform_run_history_builds_entity_path():
    client = _client(restful_return_value={"histories": []})
    result = get_data_transform_run_history(client, name="my_transform", limit=5, log_warning=MagicMock())
    assert result == {"histories": []}
    called_kwargs = client.restful.call_args.kwargs
    assert called_kwargs["path"] == "ssot/data-transforms/my_transform/run-history"
    assert called_kwargs["params"] == {"limit": 5}
