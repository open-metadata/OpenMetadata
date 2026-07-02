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
"""Unit tests for the InfluxDB 3 connector."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.entity.services.connections.database.influxdbConnection import (
    InfluxdbConnection,
)
from metadata.ingestion.source.database.influxdb.connection import (
    InfluxDBClient,
    InfluxDBConnection,
)
from metadata.ingestion.source.database.influxdb.metadata import (
    _INFLUX_TO_OM_TYPE,
    InfluxDBSource,
)


class TestInfluxTypeMapping:
    """Verify InfluxDB → OpenMetadata type mappings."""

    def test_known_types(self):
        assert _INFLUX_TO_OM_TYPE["Int64"] == DataType.BIGINT
        assert _INFLUX_TO_OM_TYPE["Int32"] == DataType.INT
        assert _INFLUX_TO_OM_TYPE["UInt64"] == DataType.BIGINT
        assert _INFLUX_TO_OM_TYPE["Float64"] == DataType.DOUBLE
        assert _INFLUX_TO_OM_TYPE["Utf8"] == DataType.VARCHAR
        assert _INFLUX_TO_OM_TYPE["Bool"] == DataType.BOOLEAN

    def test_string_like_types(self):
        assert _INFLUX_TO_OM_TYPE["LargeUtf8"] == DataType.VARCHAR
        assert _INFLUX_TO_OM_TYPE["Dictionary(Int32, Utf8)"] == DataType.VARCHAR

    def test_timestamp_types(self):
        assert _INFLUX_TO_OM_TYPE["Timestamp(Nanosecond, None)"] == DataType.TIMESTAMP
        assert _INFLUX_TO_OM_TYPE['Timestamp(Nanosecond, Some("UTC"))'] == DataType.TIMESTAMP

    def test_unknown_type_defaults_to_varchar(self):
        assert _INFLUX_TO_OM_TYPE.get("UnknownType", DataType.VARCHAR) == DataType.VARCHAR


class TestInfluxDBClient:
    """Test the HTTP API wrapper."""

    @patch("metadata.ingestion.source.database.influxdb.connection.Session")
    def test_list_databases_filters_internal(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session.get.return_value.json.return_value = [
            {"database_name": "_internal"},
            {"database_name": "iot_data"},
            {"database_name": "analytics"},
        ]
        mock_session.get.return_value.raise_for_status = MagicMock()
        mock_session_cls.return_value = mock_session

        client = InfluxDBClient(url="http://localhost:8086", token="test-token")
        databases = client.list_databases()

        assert databases == ["iot_data", "analytics"]

    @patch("metadata.ingestion.source.database.influxdb.connection.Session")
    def test_list_tables(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session.get.return_value.json.return_value = [
            {"table_name": "temperature"},
            {"table_name": "humidity"},
        ]
        mock_session.get.return_value.raise_for_status = MagicMock()
        mock_session_cls.return_value = mock_session

        client = InfluxDBClient(url="http://localhost:8086", token="test-token")
        tables = client.list_tables("iot_data")

        assert tables == ["temperature", "humidity"]

    @patch("metadata.ingestion.source.database.influxdb.connection.Session")
    def test_get_columns(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session.get.return_value.json.return_value = [
            {"column_name": "time", "data_type": "Timestamp(Nanosecond, None)", "is_nullable": "NO"},
            {"column_name": "device_id", "data_type": "Utf8", "is_nullable": "YES"},
            {"column_name": "value", "data_type": "Float64", "is_nullable": "YES"},
        ]
        mock_session.get.return_value.raise_for_status = MagicMock()
        mock_session_cls.return_value = mock_session

        client = InfluxDBClient(url="http://localhost:8086", token="test-token")
        columns = client.get_columns("iot_data", "temperature")

        assert len(columns) == 3
        assert columns[1]["column_name"] == "device_id"
        assert columns[2]["data_type"] == "Float64"

    @patch("metadata.ingestion.source.database.influxdb.connection.Session")
    def test_test_connection_healthy(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session.get.return_value.status_code = 200
        mock_session_cls.return_value = mock_session

        client = InfluxDBClient(url="http://localhost:8086", token="test-token")
        assert client.test_connection() is True

    @patch("metadata.ingestion.source.database.influxdb.connection.Session")
    def test_test_connection_unhealthy(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session.get.return_value.status_code = 503
        mock_session_cls.return_value = mock_session

        client = InfluxDBClient(url="http://localhost:8086", token="test-token")
        assert client.test_connection() is False


class TestInfluxDBConnectionClass:
    """Test the BaseConnection subclass."""

    def test_creates_client_with_url_and_token(self):
        config = InfluxdbConnection(
            type="InfluxDB",
            hostPort="https://cluster.example.com",
            token="secret-token",
        )
        conn = InfluxDBConnection(config)
        client = conn._get_client()

        assert client._url == "https://cluster.example.com"
        assert client._session.headers["Authorization"] == "Bearer secret-token"


class TestInfluxDBSource:
    """Test the main source class methods."""

    def test_create_validates_connection_type(self):
        config_dict = {
            "type": "influxdb",
            "serviceName": "influxdb_prod",
            "serviceConnection": {
                "config": {
                    "type": "InfluxDB",
                    "hostPort": "http://localhost:8086",
                    "token": "test-token",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                }
            },
        }

        with patch(
            "metadata.ingestion.source.database.influxdb.metadata.InfluxDBSource.__init__",
            return_value=None,
        ):
            mock_metadata = MagicMock()
            source = InfluxDBSource.create(config_dict, mock_metadata, pipeline_name="test-pipeline")
            assert isinstance(source, InfluxDBSource)

    def test_create_rejects_wrong_connection_type(self):
        config_dict = {
            "type": "influxdb",
            "serviceName": "influxdb_prod",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "hostPort": "localhost:3306",
                    "username": "test",
                    "authType": {"password": "test"},
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                }
            },
        }

        with pytest.raises(TypeError, match="Expected InfluxdbConnection"):
            InfluxDBSource.create(config_dict, MagicMock(), pipeline_name="test-pipeline")

    def test_get_table_columns_adds_time_column(self):
        mock_client = MagicMock()
        mock_client.get_columns.return_value = [
            {"column_name": "device_id", "data_type": "Utf8"},
            {"column_name": "value", "data_type": "Float64"},
        ]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client

        columns = source.get_table_columns("iot_data", "temperature")

        assert columns[0].name.root == "time"
        assert columns[0].dataType == DataType.TIMESTAMP
        assert columns[1].name.root == "device_id"
        assert columns[2].name.root == "value"

    def test_get_table_columns_skips_duplicate_time(self):
        mock_client = MagicMock()
        mock_client.get_columns.return_value = [
            {"column_name": "time", "data_type": "Timestamp(Nanosecond, None)"},
            {"column_name": "device_id", "data_type": "Utf8"},
        ]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client

        columns = source.get_table_columns("iot_data", "temperature")

        assert len(columns) == 2  # time + device_id (not 3)
        assert columns[0].name.root == "time"
        assert columns[1].name.root == "device_id"

    def test_get_table_columns_maps_varchar_data_length(self):
        mock_client = MagicMock()
        mock_client.get_columns.return_value = [
            {"column_name": "tag", "data_type": "Utf8"},
        ]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client

        columns = source.get_table_columns("iot_data", "temperature")

        tag_col = columns[1]  # index 1 because time is index 0
        assert tag_col.dataType == DataType.VARCHAR
        assert tag_col.dataLength == 1

    def test_get_table_columns_unknown_type_defaults_to_varchar(self):
        mock_client = MagicMock()
        mock_client.get_columns.return_value = [
            {"column_name": "weird_col", "data_type": "ExoticType"},
        ]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client

        columns = source.get_table_columns("iot_data", "temperature")

        assert columns[1].dataType == DataType.VARCHAR


class TestInfluxDBSourceSchemaList:
    """Test schema/database listing with optional databaseName filtering."""

    def test_get_schema_name_list_no_filter(self):
        mock_client = MagicMock()
        mock_client.list_databases.return_value = ["db1", "db2", "db3"]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client
        source.service_connection = MagicMock()
        source.service_connection.databaseName = None

        schemas = source.get_schema_name_list()
        assert schemas == ["db1", "db2", "db3"]

    def test_get_schema_name_list_with_filter(self):
        mock_client = MagicMock()
        mock_client.list_databases.return_value = ["db1", "db2", "db3"]

        source = InfluxDBSource.__new__(InfluxDBSource)
        source.connection_obj = mock_client
        source.service_connection = MagicMock()
        source.service_connection.databaseName = "db2"

        schemas = source.get_schema_name_list()
        assert schemas == ["db2"]
