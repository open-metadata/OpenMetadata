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

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, cast

from google.cloud.bigquery.dataset import DatasetReference
from google.cloud.bigquery.table import TableReference
from sqlalchemy import Column, inspect

from metadata.generated.schema.entity.data.table import SystemProfile, TableType
from metadata.generated.schema.security.credentials.gcpValues import SingleProjectId
from metadata.ingestion.ometa.utils import model_str
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.ssl_manager import get_ssl_connection

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable

    from sqlalchemy.orm import Session
    from sqlalchemy.sql.type_api import TypeEngine

    from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
    from metadata.profiler.metrics.system.system import System, SystemMetricsComputer
    from metadata.profiler.processor.runner import QueryRunner

logger = profiler_interface_registry_logger()


class BigQueryProfilerInterface(SQAProfilerInterface):
    """BigQuery profiler interface"""

    run_started_at: datetime | None = None

    def create_session(self):
        connection_config = deepcopy(self.service_connection_config)
        # Create a modified connection for BigQuery with the correct project ID
        if hasattr(connection_config.credentials.gcpConfig, "projectId") and self.table_entity.database:
            connection_config.credentials.gcpConfig.projectId = SingleProjectId(root=self.table_entity.database.name)
            self.connection = get_ssl_connection(connection_config)
        return super().create_session()

    def _compute_system_metrics(
        self,
        metrics: type[System],
        runner: QueryRunner,
        session: Session,
        *args,
        **kwargs,
    ) -> list[SystemProfile]:
        if self.table_entity.tableType == TableType.Sharded:
            self.status.warning(
                model_str(self.table_entity.fullyQualifiedName),
                "System metrics are not supported for sharded tables yet",
            )
            return []
        logger.debug("Computing %s metric for %s", metrics.name(), runner.table_name)
        project = self.table_entity.database
        dataset = self.table_entity.databaseSchema
        if not project or not project.name or not dataset or not dataset.name:
            raise ValueError("BigQuery system metrics require the table's project and dataset references")
        destination = TableReference(
            DatasetReference(model_str(project.name), model_str(dataset.name)), runner.table_name
        )
        computer = cast(
            "Callable[[Session, TableReference, BigQueryConnection, datetime], SystemMetricsComputer]",
            self.system_metrics_class,
        )
        connection = cast("BigQueryConnection", self.service_connection_config)
        run_started_at = self.run_started_at or datetime.now(timezone.utc)
        return computer(session, destination, connection, run_started_at).get_system_metrics()

    def _get_struct_columns(
        self,
        columns: Iterable[tuple[str, TypeEngine[Any]]],
        parent: str,
    ):
        """"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns_list = []
        for key, value in columns:
            if not isinstance(value, STRUCT):
                col = Column(f"{parent}.{key}", value)
                # pylint: disable=protected-access
                col._set_parent(
                    self.table.__table__,
                    all_names={c.name: c for c in self.table.__table__.columns},
                    allow_replacements=True,
                )
                # pylint: enable=protected-access
                columns_list.append(col)
            else:
                col = self._get_struct_columns(value.__dict__.get("_STRUCT_fields"), f"{parent}.{key}")
                columns_list.extend(col)
        return columns_list

    def get_columns(self) -> Column:
        """Get columns from table"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        columns = []
        for column in inspect(self.table).c:
            if isinstance(column.type, STRUCT):
                columns.extend(self._get_struct_columns(column.type.__dict__.get("_STRUCT_fields"), column.name))
            else:
                columns.append(column)
        return columns
