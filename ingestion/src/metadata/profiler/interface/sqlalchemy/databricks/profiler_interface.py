#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
from typing import List

from pyhive.sqlalchemy_hive import HiveCompiler
from sqlalchemy import Column, inspect

from metadata.generated.schema.entity.data.table import Column as OMColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, TableData
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.converter.base import build_orm_col


class DatabricksProfilerInterface(SQAProfilerInterface):
    """Databricks profiler interface"""

    def visit_column(self, *args, **kwargs):
        result = super(  # pylint: disable=bad-super-call
            HiveCompiler, self
        ).visit_column(*args, **kwargs)
        dot_count = result.count(".")
        # Here the databricks uses HiveCompiler.
        # the `result` here would be `db.schema.table` or `db.schema.table.column`
        # for struct it will be `db.schema.table.column.nestedchild.nestedchild` etc
        # the logic is to add the backticks to nested children.
        if dot_count > 2:
            splitted_result = result.split(".", 2)[-1].split(".")
            result = ".".join(result.split(".", 2)[:-1])
            result += "." + "`.`".join(splitted_result)
        return result

    def __init__(self, service_connection_config, **kwargs):
        super().__init__(service_connection_config=service_connection_config, **kwargs)
        self.set_catalog(self.session)
        HiveCompiler.visit_column = DatabricksProfilerInterface.visit_column

    def _get_struct_columns(self, columns: List[OMColumn], parent: str):
        """Get struct columns"""

        columns_list = []
        for idx, col in enumerate(columns):
            if col.dataType != DataType.STRUCT:
                col.name = ColumnName(__root__=f"{parent}.{col.name.__root__}")
                col = build_orm_col(idx, col, DatabaseServiceType.Databricks)
                col._set_parent(  # pylint: disable=protected-access
                    self.table.__table__
                )
                columns_list.append(col)
            else:
                col = self._get_struct_columns(
                    col.children, f"{parent}.{col.name.__root__}"
                )
                columns_list.extend(col)
        return columns_list

    def get_columns(self) -> Column:
        """Get columns from table"""
        columns = []
        for idx, column in enumerate(self.table_entity.columns):
            if column.dataType == DataType.STRUCT:
                columns.extend(
                    self._get_struct_columns(column.children, column.name.__root__)
                )
            else:
                col = build_orm_col(idx, column, DatabaseServiceType.Databricks)
                col._set_parent(  # pylint: disable=protected-access
                    self.table.__table__
                )
                columns.append(col)
        return columns

    def fetch_sample_data(self, table, columns) -> TableData:
        """Fetch sample data from database

        Args:
            table: ORM declarative table

        Returns:
            TableData: sample table data
        """
        sampler = self._get_sampler(
            table=table,
        )

        return sampler.fetch_sample_data(list(inspect(self.table).c))
