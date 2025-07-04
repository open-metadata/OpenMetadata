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

from sqlalchemy import Column, inspect

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.system.bigquery.system import (
    BigQuerySystemMetricsComputer,
)
from metadata.profiler.metrics.system.system import System
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class BigQueryProfilerInterface(SQAProfilerInterface):
    """BigQuery profiler interface"""

    def _compute_system_metrics(
        self,
        metrics: Type[System],
        runner: QueryRunner,
        *args,
        **kwargs,
    ) -> List[SystemProfile]:
        logger.debug(f"Computing {metrics.name()} metric for {runner.table_name}")
        self.system_metrics_class = cast(
            Type[BigQuerySystemMetricsComputer], self.system_metrics_class
        )
        instance = self.system_metrics_class(
            session=self.session,
            runner=runner,
            usage_location=self.service_connection_config.usageLocation,
        )
        return instance.get_system_metrics()

    def _get_struct_columns(self, columns: dict, parent: str):
        """"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns_list = []
        for key, value in columns:
            if not isinstance(value, STRUCT):
                col = Column(f"{parent}.{key}", value)
                # pylint: disable=protected-access
                col._set_parent(self.table.__table__)
                # pylint: enable=protected-access
                columns_list.append(col)
            else:
                col = self._get_struct_columns(
                    value.__dict__.get("_STRUCT_fields"), f"{parent}.{key}"
                )
                columns_list.extend(col)
        return columns_list

    def get_columns(self) -> Column:
        """Get columns from table"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns = []
        for column in inspect(self.table).c:
            if isinstance(column.type, STRUCT):
                columns.extend(
                    self._get_struct_columns(
                        column.type.__dict__.get("_STRUCT_fields"), column.name
                    )
                )
            else:
                columns.append(column)
        return columns
