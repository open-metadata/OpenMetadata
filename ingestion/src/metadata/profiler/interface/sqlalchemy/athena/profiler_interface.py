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
Athena profiler interface with struct column support.

Athena (Presto SQL) accesses struct fields via dot notation:
    SELECT "my_struct"."my_field" FROM table

This interface flattens STRUCT columns into their leaf fields
so they can be profiled individually, and patches the Athena compiler
to quote each dot-separated segment individually.
"""
from typing import List, Optional

from pyathena.sqlalchemy.compiler import AthenaStatementCompiler
from sqlalchemy import Column
from sqlalchemy.sql.compiler import SQLCompiler

from metadata.generated.schema.entity.data.table import Column as OMColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.converter.base import build_orm_col


def _visit_column_with_struct_quoting(self, column, *args, **kwargs):
    """Compile column references, quoting each segment for struct fields.

    For struct leaf columns (whose names contain dots like "address.street"),
    each segment is quoted individually so the SQL output is:
        "address"."street"
    instead of the default "address.street" (single identifier).

    This handles reserved words in struct field names correctly.
    """
    result = SQLCompiler.visit_column(self, column, *args, **kwargs)
    col_name = str(getattr(column, "name", ""))
    if "." in col_name:
        col_idx = result.find(col_name)
        if col_idx >= 0:
            prefix = result[:col_idx]
            segments = col_name.split(".")
            quoted = ".".join(self.preparer.quote_identifier(seg) for seg in segments)
            result = prefix + quoted
    return result


class AthenaProfilerInterface(SQAProfilerInterface):
    """Athena profiler interface with struct column flattening"""

    def __init__(self, service_connection_config, **kwargs):
        super().__init__(service_connection_config=service_connection_config, **kwargs)
        AthenaStatementCompiler.visit_column = _visit_column_with_struct_quoting

    def _get_struct_columns(
        self, columns: Optional[List[OMColumn]], parent: str
    ) -> List[Column]:
        """Recursively flatten struct children into leaf columns.

        Column names are set to plain dot notation (e.g. "address.street")
        for OM API profile matching. The compiler patch in __init__ handles
        quoting each segment at SQL generation time.

        Args:
            columns: child columns of a STRUCT column
            parent: dot-separated parent path (e.g. "address" or "address.geo")

        Returns:
            list of SQLAlchemy Column objects for each leaf field
        """
        columns_list = []
        for col in columns or []:
            if col.dataType != DataType.STRUCT:
                col.name = ColumnName(f"{parent}.{col.name.root}")
                sqa_col = build_orm_col(
                    idx=1,
                    col=col,
                    table_service_type=DatabaseServiceType.Athena,
                    _quote=False,
                )
                sqa_col._set_parent(  # pylint: disable=protected-access
                    self.table.__table__
                )
                columns_list.append(sqa_col)
            else:
                cols = self._get_struct_columns(
                    col.children, f"{parent}.{col.name.root}"
                )
                columns_list.extend(cols)
        return columns_list

    def get_columns(self) -> List[Column]:
        """Get columns from table, flattening STRUCT columns into leaf fields."""
        columns = []
        for idx, column_obj in enumerate(self.table_entity.columns):
            if column_obj.dataType == DataType.STRUCT:
                columns.extend(
                    self._get_struct_columns(column_obj.children, column_obj.name.root)
                )
            else:
                col = build_orm_col(idx, column_obj, DatabaseServiceType.Athena)
                col._set_parent(  # pylint: disable=protected-access
                    self.table.__table__
                )
                columns.append(col)
        return columns
