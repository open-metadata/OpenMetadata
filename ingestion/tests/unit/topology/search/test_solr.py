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
"""Test the Solr source and schema parser."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import DataType, SearchIndexField
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.search.solr.metadata import SolrSource
from metadata.ingestion.source.search.solr.parser import parse_solr_schema

MOCK_SOLR_CONFIG = {
    "source": {
        "type": "solr",
        "serviceName": "local_solr",
        "serviceConnection": {
            "config": {
                "type": "Solr",
                "hostPort": "http://localhost:8983/solr",
                "username": "admin",
                "password": "admin",
            }
        },
        "sourceConfig": {"config": {"type": "SearchMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_SCHEMA = {
    "name": "books",
    "fieldTypes": [
        {"name": "string", "class": "solr.StrField"},
        {"name": "text_general", "class": "solr.TextField"},
        {"name": "pint", "class": "solr.IntPointField"},
        {"name": "pdate", "class": "solr.DatePointField"},
        {"name": "boolean", "class": "solr.BoolField"},
    ],
    "fields": [
        {"name": "id", "type": "string"},
        {"name": "title", "type": "text_general"},
        {"name": "pages", "type": "pint"},
        {"name": "published", "type": "pdate"},
        {"name": "in_stock", "type": "boolean"},
        {"name": "mystery", "type": "unknown_type"},
    ],
    "dynamicFields": [
        {"name": "*_s", "type": "string"},
    ],
}


def test_parse_solr_schema_maps_field_types():
    fields = parse_solr_schema(MOCK_SCHEMA)
    by_name = {field.name.root: field for field in fields}

    assert by_name["id"].dataType == DataType.KEYWORD
    assert by_name["title"].dataType == DataType.TEXT
    assert by_name["pages"].dataType == DataType.INTEGER
    assert by_name["published"].dataType == DataType.DATETIME
    assert by_name["in_stock"].dataType == DataType.BOOLEAN
    # Unmapped field type is reported as UNKNOWN, not dropped.
    assert by_name["mystery"].dataType == DataType.UNKNOWN
    # Dynamic fields are included under their glob name.
    assert by_name["*_s"].dataType == DataType.KEYWORD
    assert by_name["id"].dataTypeDisplay == "string"


def test_parse_solr_schema_empty():
    assert parse_solr_schema(None) == []
    assert parse_solr_schema({}) == []


@pytest.fixture
def solr_source() -> SolrSource:
    with patch("metadata.ingestion.source.search.search_service.SearchServiceSource.test_connection"):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_SOLR_CONFIG)
        source = SolrSource.create(
            MOCK_SOLR_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
    source.context.get().__dict__["search_service"] = "local_solr"
    return source


def test_get_search_index_list_pairs_collection_with_schema(solr_source):
    solr_source.client = MagicMock()
    solr_source.client.list_collections.return_value = ["books"]
    solr_source.client.get_schema.return_value = MOCK_SCHEMA

    indexes = list(solr_source.get_search_index_list())

    assert indexes == [{"name": "books", "schema": MOCK_SCHEMA}]


def test_get_search_index_list_skips_collection_on_schema_error(solr_source):
    solr_source.client = MagicMock()
    solr_source.client.list_collections.return_value = ["books", "broken"]
    solr_source.client.get_schema.side_effect = [MOCK_SCHEMA, Exception("boom")]

    names = [index["name"] for index in solr_source.get_search_index_list()]

    assert names == ["books"]


def test_yield_search_index_builds_request(solr_source):
    result = next(solr_source.yield_search_index({"name": "books", "schema": MOCK_SCHEMA})).right

    assert isinstance(result, CreateSearchIndexRequest)
    assert result.name.root == "books"
    assert result.service.root == "local_solr"
    assert SearchIndexField(name="id", dataType=DataType.KEYWORD, dataTypeDisplay="string") in result.fields
