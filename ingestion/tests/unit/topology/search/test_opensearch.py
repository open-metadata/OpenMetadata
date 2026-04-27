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
Test OpenSearch using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import DataType, SearchIndexField
from metadata.generated.schema.entity.services.connections.search.openSearchConnection import (
    OpenSearchConnection,
)
from metadata.generated.schema.entity.services.searchService import (
    SearchConnection,
    SearchService,
    SearchServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.source.search.opensearch.connection import get_connection
from metadata.ingestion.source.search.opensearch.metadata import OpensearchSource

# Mock OpenSearch configuration
mock_os_config = {
    "source": {
        "type": "opensearch",
        "serviceName": "local_opensearch",
        "serviceConnection": {
            "config": {
                "type": "OpenSearch",
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
            "securityConfig": {"jwtToken": "eyJraWQiOiJ...dummy_token..."},
        }
    },
}

# Mock index settings and mappings (same as the Elasticsearch test)
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
                            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
                        },
                        "fullyQualifiedName": {"type": "text"},
                        "href": {"type": "text"},
                        "id": {"type": "text"},
                        "name": {
                            "type": "keyword",
                            "normalizer": "lowercase_normalizer",
                            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
                        },
                        "type": {"type": "keyword"},
                    }
                },
            }
        },
        "settings": MOCK_SETTINGS,
    }
}

# Create a mock search service. Adjust the serviceType if you have a dedicated type for OpenSearch.
MOCK_SEARCH_SERVICE = SearchService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="os_source",
    fullyQualifiedName="os_source",
    connection=SearchConnection(),
    serviceType=SearchServiceType.OpenSearch,  # Ensure that OpenSearch is defined; otherwise, use a fallback type.
)

EXPECTED_RESULT = CreateSearchIndexRequest(
    name="test_case_search_index",
    displayName="test_case_search_index",
    searchIndexSettings=MOCK_SETTINGS,
    service="os_source",
    fields=[
        SearchIndexField(name="href", dataType=DataType.TEXT, dataTypeDisplay="text"),
        SearchIndexField(name="name", dataType=DataType.TEXT, dataTypeDisplay="text"),
        SearchIndexField(
            name="owner",
            dataType=DataType.OBJECT,
            children=[
                SearchIndexField(name="deleted", dataType=DataType.TEXT, dataTypeDisplay="text"),
                SearchIndexField(name="description", dataType=DataType.TEXT, dataTypeDisplay="text"),
                SearchIndexField(name="displayName", dataType=DataType.TEXT, dataTypeDisplay="text"),
                SearchIndexField(
                    name="fullyQualifiedName",
                    dataType=DataType.TEXT,
                    dataTypeDisplay="text",
                ),
                SearchIndexField(name="href", dataType=DataType.TEXT, dataTypeDisplay="text"),
                SearchIndexField(name="id", dataType=DataType.TEXT, dataTypeDisplay="text"),
                SearchIndexField(name="name", dataType=DataType.KEYWORD, dataTypeDisplay="keyword"),
                SearchIndexField(name="type", dataType=DataType.KEYWORD, dataTypeDisplay="keyword"),
            ],
        ),
    ],
)


class OpenSearchUnitTest(TestCase):
    @patch("metadata.ingestion.source.search.search_service.SearchServiceSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        # Set the test_connection to return False so that test_connection doesn't interfere.
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_os_config)
        self.os_source = OpensearchSource.create(
            mock_os_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        # Manually set the search_service context to our mock search service name.
        self.os_source.context.get().__dict__["search_service"] = MOCK_SEARCH_SERVICE.name.root

    def test_partition_parse_columns(self):
        actual_index = next(self.os_source.yield_search_index(MOCK_DETAILS)).right
        self.assertEqual(actual_index, EXPECTED_RESULT)


class OpenSearchConnectionTest(TestCase):
    """
    Test OpenSearch connection handler with AWS credentials
    """

    @patch("metadata.ingestion.source.search.opensearch.connection.OpenSearch")
    @patch("metadata.ingestion.source.search.opensearch.connection.AWS4Auth")
    def test_aws_auth_with_session_token(self, mock_aws4auth, mock_opensearch):
        """
        Regression test for issue #21941: session token should not crash
        and should be passed as a plain string.
        """
        from unittest.mock import MagicMock

        mock_opensearch.return_value = MagicMock()
        mock_aws4auth.return_value = MagicMock()

        conn = OpenSearchConnection(
            hostPort="https://fake.us-east-1.es.amazonaws.com:443",
            authType=AWSCredentials(
                awsAccessKeyId="ASIAXXX",
                awsSecretAccessKey="mysecret",
                awsSessionToken="mytoken",  # This is the string that was causing crashes
                awsRegion="us-east-1",
            ),
        )

        # This should NOT raise AttributeError: 'str' object has no attribute 'get_secret_value'
        client = get_connection(conn)
        self.assertIsNotNone(client)

        # Verify AWS4Auth was called with the session_token as a plain string
        mock_aws4auth.assert_called_once_with(
            "ASIAXXX",
            "mysecret",
            "us-east-1",
            "es",
            session_token="mytoken",
        )
