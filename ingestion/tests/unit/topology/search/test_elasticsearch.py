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
Test ES using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import DataType, SearchIndexField
from metadata.generated.schema.entity.services.searchService import (
    SearchConnection,
    SearchService,
    SearchServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.search.elasticsearch.metadata import ElasticsearchSource

mock_es_config = {
    "source": {
        "type": "elasticsearch",
        "serviceName": "local_elasticsearch",
        "serviceConnection": {
            "config": {
                "type": "ElasticSearch",
                "authType": {
                    "username": "username",
                    "password": "password",
                },
                "hostPort": "http://localhost:9200",
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

MOCK_SETTINGS = {
    "index": {
        "routing": {"allocation": {"include": {"_tier_preference": "data_content"}}},
        "number_of_shards": "1",
        "provided_name": "test_case_search_index",
        "creation_date": "1692181190239",
        "analysis": {
            "filter": {"om_stemmer": {"name": "english", "type": "stemmer"}},
            "normalizer": {
                "lowercase_normalizer": {
                    "filter": ["lowercase"],
                    "type": "custom",
                    "char_filter": [],
                }
            },
            "analyzer": {
                "om_ngram": {
                    "filter": ["lowercase"],
                    "min_gram": "1",
                    "max_gram": "2",
                    "tokenizer": "ngram",
                },
                "om_analyzer": {
                    "filter": ["lowercase", "om_stemmer"],
                    "tokenizer": "letter",
                },
            },
        },
        "number_of_replicas": "1",
        "uuid": "8HAGhnVkSy-X__XwWFdJqg",
        "version": {"created": "7160399"},
    }
}

MOCK_DETAILS = {
    "test_case_search_index": {
        "aliases": {},
        "mappings": {
            "properties": {
                "href": {"type": "text"},
                "name": {
                    "type": "text",
                    "fields": {
                        "keyword": {"type": "keyword", "ignore_above": 256},
                        "ngram": {"type": "text", "analyzer": "om_ngram"},
                    },
                    "analyzer": "om_analyzer",
                },
                "owner": {
                    "properties": {
                        "deleted": {"type": "text"},
                        "description": {"type": "text"},
                        "displayName": {
                            "type": "text",
                            "fields": {
                                "keyword": {"type": "keyword", "ignore_above": 256}
                            },
                        },
                        "fullyQualifiedName": {"type": "text"},
                        "href": {"type": "text"},
                        "id": {"type": "text"},
                        "name": {
                            "type": "keyword",
                            "normalizer": "lowercase_normalizer",
                            "fields": {
                                "keyword": {"type": "keyword", "ignore_above": 256}
                            },
                        },
                        "type": {"type": "keyword"},
                    }
                },
            }
        },
        "settings": MOCK_SETTINGS,
    }
}

MOCK_SEARCH_SERVICE = SearchService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="es_source",
    fullyQualifiedName="es_source",
    connection=SearchConnection(),
    serviceType=SearchServiceType.ElasticSearch,
)

EXPECTED_RESULT = CreateSearchIndexRequest(
    name="test_case_search_index",
    displayName="test_case_search_index",
    searchIndexSettings=MOCK_SETTINGS,
    service="es_source",
    fields=[
        SearchIndexField(name="href", dataType=DataType.TEXT, dataTypeDisplay="text"),
        SearchIndexField(name="name", dataType=DataType.TEXT, dataTypeDisplay="text"),
        SearchIndexField(
            name="owner",
            dataType=DataType.OBJECT,
            children=[
                SearchIndexField(
                    name="deleted", dataType=DataType.TEXT, dataTypeDisplay="text"
                ),
                SearchIndexField(
                    name="description", dataType=DataType.TEXT, dataTypeDisplay="text"
                ),
                SearchIndexField(
                    name="displayName", dataType=DataType.TEXT, dataTypeDisplay="text"
                ),
                SearchIndexField(
                    name="fullyQualifiedName",
                    dataType=DataType.TEXT,
                    dataTypeDisplay="text",
                ),
                SearchIndexField(
                    name="href", dataType=DataType.TEXT, dataTypeDisplay="text"
                ),
                SearchIndexField(
                    name="id", dataType=DataType.TEXT, dataTypeDisplay="text"
                ),
                SearchIndexField(
                    name="name", dataType=DataType.KEYWORD, dataTypeDisplay="keyword"
                ),
                SearchIndexField(
                    name="type", dataType=DataType.KEYWORD, dataTypeDisplay="keyword"
                ),
            ],
        ),
    ],
)


class ElasticSearchUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.search.search_service.SearchServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_es_config)
        self.es_source = ElasticsearchSource.create(
            mock_es_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.es_source.context.get().__dict__[
            "search_service"
        ] = MOCK_SEARCH_SERVICE.name.root

    def test_partition_parse_columns(self):
        actual_index = next(self.es_source.yield_search_index(MOCK_DETAILS)).right
        self.assertEqual(actual_index, EXPECTED_RESULT)
