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
"""Regression tests for Unity Catalog's metadata-only BROWSE privileges."""

from unittest.mock import MagicMock

import pytest

from metadata.ingestion.source.database.unitycatalog.browse import (
    get_browse_item,
    iter_browse_items,
)


def test_browse_list_collects_paginated_tables_without_select_grants():
    client = MagicMock()
    client.api_client.do.side_effect = [
        {"tables": [{"name": "first"}], "next_page_token": "page2"},
        {"tables": [{"name": "second"}]},
    ]

    assert list(iter_browse_items(client, "tables", "tables", catalog_name="c", schema_name="s")) == [
        {"name": "first"},
        {"name": "second"},
    ]
    assert client.api_client.do.call_count == 2
    assert all(call.kwargs["query"]["include_browse"] == "true" for call in client.api_client.do.call_args_list)
    assert client.api_client.do.call_args_list[-1].kwargs["query"]["page_token"] == "page2"


def test_browse_get_uses_metadata_visibility_and_encodes_path():
    client = MagicMock()
    client.api_client.do.return_value = {"name": "my table"}
    assert get_browse_item(client, "tables", "c.s.my table") == {"name": "my table"}
    client.api_client.do.assert_called_once_with(
        "GET",
        "/api/2.1/unity-catalog/tables/c.s.my%20table",
        query={"include_browse": "true"},
    )


def test_browse_list_stops_if_page_token_repeats():
    client = MagicMock()
    client.api_client.do.return_value = {"tables": [], "next_page_token": "same"}
    with pytest.raises(RuntimeError, match="reissued page token"):
        list(iter_browse_items(client, "tables", "tables"))
    assert client.api_client.do.call_count == 2


def test_browse_list_rejects_non_json_response():
    client = MagicMock()
    client.api_client.do.return_value = "not-json"
    with pytest.raises(TypeError, match="expected a JSON object"):
        list(iter_browse_items(client, "schemas", "schemas"))
