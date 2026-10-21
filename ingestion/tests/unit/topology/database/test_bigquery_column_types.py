#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""BigQuery NUMERIC/BIGNUMERIC/JSON columns keep their semantic type from reflection to profiling."""

import pytest
from google.cloud.bigquery import SchemaField
from sqlalchemy_bigquery import BigQueryDialect

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.ingestion.source.database.bigquery.metadata import get_columns
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.profiler.orm.converter.bigquery.converter import BigqueryMapTypes
from metadata.profiler.orm.registry import NOT_COMPUTE


def _reflect(field: SchemaField) -> dict:
    (column,) = get_columns([field])
    return column


@pytest.mark.parametrize(
    "field, data_type, precision",
    [
        pytest.param(SchemaField("amount", "NUMERIC", precision=10, scale=2), "NUMERIC", ("10", "2"), id="numeric"),
        pytest.param(SchemaField("amount", "NUMERIC"), "NUMERIC", None, id="numeric-unparameterized"),
        pytest.param(
            SchemaField("amount", "BIGNUMERIC", precision=40, scale=10), "NUMERIC", ("40", "10"), id="bignumeric"
        ),
        pytest.param(SchemaField("payload", "JSON"), "JSON", None, id="json"),
        pytest.param(SchemaField("id", "INT64"), "INT", None, id="int64-unchanged"),
        pytest.param(SchemaField("name", "STRING"), "STRING", None, id="string-unchanged"),
    ],
)
def test_reflected_bigquery_types_map_to_om_types(field, data_type, precision):
    column = _reflect(field)
    om_type = ColumnTypeParser.get_column_type(column["type"])
    assert om_type == data_type
    assert ColumnTypeParser.check_col_precision(om_type, column["type"]) == precision


def test_json_column_displays_as_json():
    assert _reflect(SchemaField("payload", "JSON"))["system_data_type"] == "JSON"


def _orm_type(data_type: DataType):
    column = Column(name="payload", dataType=data_type)
    return BigqueryMapTypes().map_types(column, DatabaseServiceType.BigQuery)


def test_json_orm_type_passes_through_values_the_driver_already_decoded():
    json_type = _orm_type(DataType.JSON)()
    processor = json_type.result_processor(BigQueryDialect(), None)
    decoded = {"kind": "fixture", "count": 2}
    assert processor(decoded) == decoded


def test_json_orm_type_is_excluded_from_metric_computation():
    assert _orm_type(DataType.JSON).__name__ in NOT_COMPUTE
