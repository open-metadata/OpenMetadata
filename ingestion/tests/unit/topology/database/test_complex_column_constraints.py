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
"""Complex (ARRAY/STRUCT) columns get the same nullability constraint as primitive columns."""

from types import SimpleNamespace

from google.cloud.bigquery import SchemaField

from metadata.generated.schema.entity.data.table import Constraint, DataType
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource, get_columns
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin

NO_KEYS = SimpleNamespace(
    get_unique_constraints=lambda table_name, schema_name: [],
    get_foreign_keys=lambda table_name, schema_name: [],
    get_pk_constraint=lambda table_name, schema_name: {"constrained_columns": []},
)


class _Handler(SqlColumnHandlerMixin):
    clean_raw_data_type = BigquerySource.clean_raw_data_type

    def __init__(self, fields):
        self.fields = fields

    def _get_columns_internal(self, schema_name, table_name, db_name, inspector, table_type=None):
        return get_columns(self.fields)

    def get_column_tag_labels(self, table_name, column):
        return None


def _columns(*fields):
    columns, _, _ = _Handler(list(fields)).get_columns_and_constraints("ds", "t", "proj", NO_KEYS)
    return {column.name.root: column for column in columns}


def test_complex_columns_carry_their_nullability_constraint():
    struct_fields = [SchemaField("x", "INT64"), SchemaField("y", "STRING")]
    columns = _columns(
        SchemaField("tags", "STRING", mode="REPEATED"),
        SchemaField("address", "RECORD", mode="NULLABLE", fields=struct_fields),
        SchemaField("required_address", "RECORD", mode="REQUIRED", fields=struct_fields),
        SchemaField("id", "INT64", mode="REQUIRED"),
    )
    assert {name: (column.dataType, column.constraint) for name, column in columns.items()} == {
        "tags": (DataType.ARRAY, Constraint.NULL),
        "address": (DataType.STRUCT, Constraint.NULL),
        "required_address": (DataType.STRUCT, Constraint.NOT_NULL),
        "id": (DataType.INT, Constraint.NOT_NULL),
    }
