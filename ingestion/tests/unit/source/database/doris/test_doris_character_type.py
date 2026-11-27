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
"""Doris CHAR columns that SHOW FULL COLUMNS prints as character(N)"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.types import CHAR

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.doris.metadata import DorisSource, _get_column

DORIS_WORKFLOW_CONFIG = {
    "source": {
        "type": "doris",
        "serviceName": "local_doris",
        "serviceConnection": {"config": {"type": "Doris", "username": "root", "hostPort": "localhost:9030"}},
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "doris"},
        }
    },
}

# SHOW FULL COLUMNS rows from Doris for CHAR(10), CHAR(255) and ARRAY<CHAR(255)> columns.
# Doris prints CHAR(255), and a CHAR without a length such as CAST(x AS CHAR), as character(255).
# Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
CHAR_SHOW_FULL_COLUMNS_ROWS = [
    ("k", "int", "", "NO", "YES", None, "", "", ""),
    ("c_char_10", "char(10)", "", "YES", "NO", None, "NONE", "", ""),
    ("c_char_255", "character(255)", "", "YES", "NO", None, "NONE", "", ""),
    ("c_arr_char_255", "array<character(255)>", "", "YES", "NO", None, "NONE", "", ""),
]


@pytest.fixture
def doris_source():
    with (
        patch("metadata.ingestion.source.database.common_db_source.create_connection"),
        patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
    ):
        source = DorisSource.create(DORIS_WORKFLOW_CONFIG["source"], MagicMock())
    source.engine.dialect = MySQLDialect()
    context = source.context.get()
    context.upsert("database_service", "local_doris")
    context.upsert("database", "default")
    context.upsert("database_schema", "om_verify")
    return source


class TestCharacterType:
    """_get_column reads character(N) as CHAR(N) and keeps the type text Doris printed"""

    @pytest.mark.parametrize("raw_type", ["character(255)", "char(10)"])
    def test_character_is_char(self, raw_type):
        column = _get_column(0, "c", raw_type, "YES", None, "")

        assert column["system_data_type"] == DataType.CHAR.value
        assert isinstance(column["data_type"], CHAR)
        assert column["display_type"] == raw_type

    def test_array_of_character_is_array_of_char(self):
        column = _get_column(0, "c", "array<character(255)>", "YES", None, "")

        assert column["system_data_type"] == DataType.ARRAY.value
        assert column["arr_data_type"] == DataType.CHAR.value
        assert column["display_type"] == "array<character(255)>"

    def test_struct_field_named_character_keeps_its_name(self):
        column = _get_column(0, "c", "struct<character:int,b:character(255)>", "YES", None, "")

        assert [(child["name"], child["dataType"]) for child in column["children"]] == [
            ("character", "INT"),
            ("b", "CHAR"),
        ]


class TestCharacterColumnsAreIngested:
    """CHAR(255) columns reach the Table entity instead of being dropped"""

    def test_character_columns_are_ingested(self, doris_source):
        doris_source.engine.connect.return_value.execute.return_value = CHAR_SHOW_FULL_COLUMNS_ROWS

        columns, _, _ = doris_source.get_columns_and_constraints("om_verify", "t_char", "default", inspector=None)

        assert [
            (model_str(column.name), column.dataType, column.arrayDataType, column.dataLength, column.dataTypeDisplay)
            for column in columns
        ] == [
            ("k", DataType.INT, None, 1, "int"),
            ("c_char_10", DataType.CHAR, None, 10, "char(10)"),
            ("c_char_255", DataType.CHAR, None, 255, "character(255)"),
            ("c_arr_char_255", DataType.ARRAY, DataType.CHAR, 1, "array<character(255)>"),
        ]
