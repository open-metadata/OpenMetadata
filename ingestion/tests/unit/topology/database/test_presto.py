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

"""Test Presto Iceberg detection"""

import unittest
from unittest.mock import Mock

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.presto.metadata import PrestoSource


class TestPrestoIcebergDetection(unittest.TestCase):
    def _make_mock_source(self, connector_id, table_names):
        mock_self = Mock()
        mock_self.context.get.return_value.database = "test_catalog"
        mock_result = Mock()
        mock_result.first.return_value = (connector_id,) if connector_id else None
        mock_self.connection.execute.return_value = mock_result
        mock_self.inspector.get_table_names.return_value = table_names
        return mock_self

    def test_iceberg_catalog_returns_iceberg_type(self):
        mock_self = self._make_mock_source("iceberg", ["orders", "customers"])
        result = PrestoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [
            TableNameAndType(name="orders", type_=TableType.Iceberg),
            TableNameAndType(name="customers", type_=TableType.Iceberg),
        ]

    def test_non_iceberg_catalog_returns_regular_type(self):
        mock_self = self._make_mock_source("hive", ["orders"])
        result = PrestoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="orders", type_=TableType.Regular)]

    def test_connection_error_falls_back_to_regular(self):
        mock_self = Mock()
        mock_self.context.get.return_value.database = "test_catalog"
        mock_self.connection.execute.side_effect = Exception("permission denied")
        mock_self.inspector.get_table_names.return_value = ["orders"]
        result = PrestoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="orders", type_=TableType.Regular)]


if __name__ == "__main__":
    unittest.main()
