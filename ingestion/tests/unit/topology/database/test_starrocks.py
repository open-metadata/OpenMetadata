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

import pytest
from sqlalchemy import types as sqltypes

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.starrocks.metadata import (
    StarRocksSource,
    _get_sqlalchemy_type,
)

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


class TestStarRocksTypeMappings:
    """Verify _get_sqlalchemy_type returns the correct SQLAlchemy type for every
    type added in the recent type-mapping expansion."""

    @pytest.mark.parametrize(
        "type_str, expected_sqa_class",
        [
            # Integer family
            ("TINYINT", sqltypes.SMALLINT),
            ("SMALLINT", sqltypes.SMALLINT),
            ("INTEGER", sqltypes.INTEGER),
            ("INT", sqltypes.INT),
            ("BIGINT", sqltypes.BIGINT),
            ("LARGEINT", sqltypes.BIGINT),
            # Analytics / semi-structured types stored as TEXT
            ("MAP", sqltypes.TEXT),
            ("STRUCT", sqltypes.TEXT),
            ("BITMAP", sqltypes.TEXT),
            ("HLL", sqltypes.TEXT),
            ("PERCENTILE", sqltypes.TEXT),
            # Existing string types (regression guard)
            ("STRING", sqltypes.TEXT),
            ("TEXT", sqltypes.TEXT),
            ("JSON", sqltypes.JSON),
        ],
    )
    def test_type_resolves_to_expected_class(self, type_str, expected_sqa_class):
        result = _get_sqlalchemy_type(type_str)
        assert isinstance(result, expected_sqa_class), (
            f"_get_sqlalchemy_type('{type_str}') returned {type(result).__name__}, "
            f"expected {expected_sqa_class.__name__}"
        )

    def test_unknown_type_returns_null_type(self):
        result = _get_sqlalchemy_type("UNKNOWN_CUSTOM_TYPE")
        assert isinstance(result, sqltypes.NullType)


class TestStarRocksIcebergMapping(TestCase):
    def test_iceberg_relkind_mapping(self):
        from metadata.generated.schema.entity.data.table import TableType
        from metadata.ingestion.source.database.starrocks.metadata import RELKIND_MAP

        assert RELKIND_MAP["ICEBERG"] == TableType.Iceberg
