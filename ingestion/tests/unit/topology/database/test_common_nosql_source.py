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

"""MongoDB/NoSQL document values carry types that must not be re-parsed from text."""

from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.database.common_nosql_source import CommonNoSQLSource
from metadata.utils.schema_inference import NO_LIMITS


def _columns_from_nosql(records):
    source = MagicMock()
    source.get_table_columns_dict.return_value = records
    source.inference_limits = NO_LIMITS
    return CommonNoSQLSource.get_table_columns(source, "schema", "collection")


def test_numeric_looking_mongodb_strings_keep_their_bson_type():
    columns = _columns_from_nosql(
        [
            {"CODIGO": "01051", "COUNT": 10},
            {"CODIGO": "01052", "COUNT": 20},
            {"CODIGO": "01053", "COUNT": 30},
        ]
    )
    by_name = {column.name.root: column for column in columns}

    assert by_name["CODIGO"].dataType == DataType.STRING
    assert by_name["CODIGO"].dataTypeDisplay == DataType.STRING.value
    assert by_name["COUNT"].dataType == DataType.INT


def test_all_string_nosql_columns_remain_string_even_for_numbers_dates_and_bools():
    columns = _columns_from_nosql(
        [
            {"zip": "00501", "year": "2024", "day": "2024-01-01", "flag": "True"},
            {"zip": "00502", "year": "2025", "day": "2025-01-01", "flag": "False"},
        ]
    )

    assert {column.name.root: column.dataType for column in columns} == {
        "zip": DataType.STRING,
        "year": DataType.STRING,
        "day": DataType.STRING,
        "flag": DataType.STRING,
    }


def test_nosql_nested_objects_and_arrays_keep_generic_inference():
    columns = _columns_from_nosql([{"metadata": {"active": True}, "items": [1, 2], "amount": 3.5}])
    types = {column.name.root: column.dataType for column in columns}

    assert types["metadata"] == DataType.JSON
    assert types["items"] == DataType.ARRAY
    assert types["amount"] == DataType.FLOAT
