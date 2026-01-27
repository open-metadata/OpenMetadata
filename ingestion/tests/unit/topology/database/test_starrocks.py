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
Test StarRocks using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.starrocks.metadata import StarRocksSource

mock_starrocks_config = {
    "source": {
        "type": "starrocks",
        "serviceName": "local_starrocks",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}

mock_starrocks_config_with_ssl = {
    "source": {
        "type": "starrocks",
        "serviceName": "local_starrocks_ssl",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
                "sslConfig": {
                    "caCertificate": "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAK...\n-----END CERTIFICATE-----\n",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}


class StarRocksUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)
        self.starrocks_source = StarRocksSource.create(
            mock_starrocks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.starrocks_source.close()


class StarRocksSSLUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_starrocks_config_with_ssl
        )
        self.starrocks_source = StarRocksSource.create(
            mock_starrocks_config_with_ssl["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_ssl_manager_initialized(self):
        """Test that SSL manager is initialized when SSL config is provided"""
        self.assertIsNotNone(self.starrocks_source.ssl_manager)
