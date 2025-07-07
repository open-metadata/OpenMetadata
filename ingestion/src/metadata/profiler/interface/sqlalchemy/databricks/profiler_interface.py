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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
from typing import List, Type, cast

from pyhive.sqlalchemy_hive import HiveCompiler
from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import Column as OMColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    SystemProfile,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.system.databricks.system import (
    DatabricksSystemMetricsComputer,
)
from metadata.profiler.metrics.system.system import System
from metadata.profiler.orm.converter.base import build_orm_col
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class DatabricksProfilerInterface(SQAProfilerInterface):
    """Databricks profiler interface"""

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        logger.debug(f"Computing {metrics.name()} metric for {runner.table_name}")
        self.system_metrics_class = cast(
            Type[DatabricksSystemMetricsComputer], self.system_metrics_class
        )
        instance = self.system_metrics_class(
            session=self.session,
            runner=runner,
            catalog=self.service_connection_config.catalog,
        )
        return instance.get_system_metrics()

    def visit_column(self, *args, **kwargs):
        result = super(  # pylint: disable=bad-super-call
            HiveCompiler, self
        ).visit_column(*args, **kwargs)
        # Here the databricks uses HiveCompiler.
        # the `result` here would be `db.schema.table` or `db.schema.table.column`
        # for struct it will be `db.schema.table.column.nestedchild.nestedchild` etc
        # the logic is to add the backticks to nested children.
        dot_count = result.count(".")
        if dot_count > 1 and "." in result.split("`.`")[-1]:
            splitted_result = result.split("`.")[-1].split(".")
            result = "`.".join(result.split("`.")[:-1])
            if result:
                result += "`."
            result += "`.`".join(splitted_result)
        return result

    def __init__(self, service_connection_config, **kwargs):
        super().__init__(service_connection_config=service_connection_config, **kwargs)
        self.set_catalog(self.session)
        HiveCompiler.visit_column = DatabricksProfilerInterface.visit_column

    def _get_struct_columns(self, columns: List[OMColumn], parent: str):
        """Get struct columns"""

        columns_list = []
        for col in columns:
            if col.dataType != DataType.STRUCT:
                # For DBX struct we need to quote the column name as `a`.`b`.`c`
                # otherwise the driver will quote it as `a.b.c`
                col_name = ".".join([f"`{part}`" for part in parent.split(".")])
                col.name = ColumnName(f"{col_name}.`{col.name.root}`")
                # Set `_quote` to False to avoid quoting the column name again when compiled
                sqa_col = build_orm_col(
                    idx=1,
                    col=col,
                    table_service_type=DatabaseServiceType.Databricks,
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

    def get_columns(self) -> Column:
        """Get columns from table"""
        columns = []
        for idx, column_obj in enumerate(self.table_entity.columns):
            if column_obj.dataType == DataType.STRUCT:
                columns.extend(
                    self._get_struct_columns(column_obj.children, column_obj.name.root)
                )
            else:
                col = build_orm_col(idx, column_obj, DatabaseServiceType.Databricks)
                col._set_parent(  # pylint: disable=protected-access
                    self.table.__table__
                )
                columns.append(col)
        return columns
