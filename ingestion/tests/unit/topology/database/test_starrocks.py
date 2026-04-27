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
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import types as sqltypes

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.starrocks.metadata import (
    StarRocksSource,
    _get_sqlalchemy_type,
)
from metadata.ingestion.source.database.starrocks.utils import get_table_comment

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
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)
        self.starrocks_source = StarRocksSource.create(
            mock_starrocks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.starrocks_source.close()


class StarRocksSSLUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config_with_ssl)
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


class TestStarRocksGetTableDescription(TestCase):
    """Tests for get_table_description delegating to utils.get_table_comment"""

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def setUp(self, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)
        self.source = StarRocksSource.create(
            mock_starrocks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        thread_id = self.source.context.get_current_thread_id()
        self.source._connection_map[thread_id] = MagicMock()

    @patch("metadata.ingestion.source.database.starrocks.metadata.get_table_comment")
    def test_returns_table_comment(self, mock_get_table_comment):
        mock_get_table_comment.return_value = {"text": "审计日志表"}

        description = self.source.get_table_description(
            schema_name="test_db",
            table_name="audit_tbl",
            inspector=MagicMock(),
        )
        assert description == "审计日志表"
        mock_get_table_comment.assert_called_once_with(
            None, self.source.connection, "audit_tbl", schema="test_db"
        )

    @patch("metadata.ingestion.source.database.starrocks.metadata.get_table_comment")
    def test_returns_none_for_empty_comment(self, mock_get_table_comment):
        mock_get_table_comment.return_value = {"text": None}

        description = self.source.get_table_description(
            schema_name="test_db",
            table_name="no_comment_tbl",
            inspector=MagicMock(),
        )
        assert description is None

    @patch("metadata.ingestion.source.database.starrocks.metadata.get_table_comment")
    def test_returns_none_on_exception(self, mock_get_table_comment):
        mock_get_table_comment.side_effect = Exception("connection error")

        description = self.source.get_table_description(
            schema_name="test_db",
            table_name="error_tbl",
            inspector=MagicMock(),
        )
        assert description is None


class TestGetTableComment(TestCase):
    """Tests for utils.get_table_comment row parsing"""

    def _make_connection(self, rows):
        connection = MagicMock()
        result = MagicMock()
        result.mappings.return_value = iter(rows)
        connection.execute.return_value = result
        return connection

    def test_returns_comment_from_row(self):
        row = {"TABLE_COMMENT": "审计日志表"}
        connection = self._make_connection([row])

        result = get_table_comment(None, connection, "audit_tbl", schema="test_db")

        assert result == {"text": "审计日志表"}

    def test_returns_none_when_no_rows(self):
        connection = self._make_connection([])

        result = get_table_comment(None, connection, "missing_tbl", schema="test_db")

        assert result == {"text": None}
