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
"""SearchServiceSource owns a single BaseConnection and reuses it for the
test-connection step."""

import ssl
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.common.sslCertValues import (
    SslCertificatesByValues,
)
from metadata.generated.schema.entity.services.connections.common.sslConfig import (
    SslConfig,
)
from metadata.generated.schema.entity.services.connections.search.elasticSearchConnection import (
    ElasticsearchConnection as ElasticsearchConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.search.openSearchConnection import (
    OpenSearchConnection as OpenSearchConnectionConfig,
)
from metadata.ingestion.source.search.elasticsearch.connection import (
    ElasticsearchConnection,
)
from metadata.ingestion.source.search.elasticsearch.metadata import ElasticsearchSource
from metadata.ingestion.source.search.opensearch.connection import OpenSearchConnection
from metadata.ingestion.source.search.opensearch.metadata import OpensearchSource

OPENSEARCH_CONFIG = {
    "type": "opensearch",
    "serviceName": "test-opensearch",
    "serviceConnection": {"config": {"type": "OpenSearch", "hostPort": "http://opensearch.example.com:9200"}},
    "sourceConfig": {"config": {"type": "SearchMetadata"}},
}


def _ssl_by_value(staging_dir) -> SslConfig:
    return SslConfig(
        certificates=SslCertificatesByValues(privateKeyValue="-----PRIVATE KEY-----", stagingDir=str(staging_dir))
    )


def test_owned_connection_closed_when_test_connection_fails():
    with patch("metadata.ingestion.source.search.search_service.create_connection") as mock_create_connection:
        owned_connection = mock_create_connection.return_value
        with (
            patch(
                "metadata.ingestion.source.search.search_service.run_test_connection",
                side_effect=RuntimeError("cannot connect"),
            ),
            pytest.raises(RuntimeError),
        ):
            OpensearchSource.create(OPENSEARCH_CONFIG, MagicMock())

        owned_connection.close.assert_called_once()


def test_elasticsearch_connection_removes_staging_dir_on_close(tmp_path):
    staging_dir = tmp_path / "es-staging"
    service_connection = ElasticsearchConnectionConfig(
        hostPort="http://localhost:9200", sslConfig=_ssl_by_value(staging_dir)
    )
    with patch("metadata.ingestion.source.search.elasticsearch.connection.Elasticsearch"):
        connection = ElasticsearchConnection(service_connection)
        assert connection.client is not None
        assert staging_dir.exists()
        connection.close()
    assert not staging_dir.exists()


def test_opensearch_connection_removes_staging_dir_on_close(tmp_path):
    staging_dir = tmp_path / "os-staging"
    service_connection = OpenSearchConnectionConfig(
        hostPort="http://localhost:9200", sslConfig=_ssl_by_value(staging_dir)
    )
    with patch("metadata.ingestion.source.search.opensearch.connection.OpenSearch"):
        connection = OpenSearchConnection(service_connection)
        assert connection.client is not None
        assert staging_dir.exists()
        connection.close()
    assert not staging_dir.exists()


def test_elasticsearch_removes_staging_dir_when_init_test_connection_fails(tmp_path):
    staging_dir = tmp_path / "es-staging"
    config = {
        "type": "elasticsearch",
        "serviceName": "test-elasticsearch",
        "serviceConnection": {
            "config": {
                "type": "ElasticSearch",
                "hostPort": "http://elasticsearch.example.com:9200",
                "sslConfig": {
                    "certificates": {"privateKeyValue": "-----PRIVATE KEY-----", "stagingDir": str(staging_dir)}
                },
            }
        },
        "sourceConfig": {"config": {"type": "SearchMetadata"}},
    }
    with (
        patch("metadata.ingestion.source.search.elasticsearch.connection.Elasticsearch"),
        patch(
            "metadata.ingestion.source.search.search_service.run_test_connection",
            side_effect=RuntimeError("cannot connect"),
        ),
        pytest.raises(RuntimeError),
    ):
        ElasticsearchSource.create(config, MagicMock())
    assert not staging_dir.exists()


def test_elasticsearch_removes_staging_dir_when_ssl_context_build_fails(tmp_path):
    staging_dir = tmp_path / "es-staging"
    service_connection = ElasticsearchConnectionConfig(
        hostPort="http://localhost:9200",
        sslConfig=SslConfig(
            certificates=SslCertificatesByValues(caCertValue="not-a-real-cert", stagingDir=str(staging_dir))
        ),
    )
    connection = ElasticsearchConnection(service_connection)
    with (
        patch(
            "metadata.ingestion.source.search.elasticsearch.connection.create_ssl_context",
            side_effect=ssl.SSLError("bad certificate"),
        ),
        pytest.raises(ssl.SSLError),
    ):
        _ = connection.client
    assert not staging_dir.exists()
