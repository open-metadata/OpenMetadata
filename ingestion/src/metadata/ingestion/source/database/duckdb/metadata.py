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
DuckDB metadata source.

A DuckDB file is one OpenMetadata database, named after the file's catalog unless
``databaseName`` is set; its schemas and tables map one to one. See
ADR:2026-11-23-duckdb-ingests-one-file-as-one-database-and-reads-query-history-only-from-its-query-log-table.
"""

from collections.abc import Iterable
from typing import Any

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.duckdb.connection import get_database_name
from metadata.ingestion.source.database.duckdb.queries import DUCKDB_COLUMNS
from metadata.ingestion.source.database.duckdb.types import parse_duckdb_type


class DuckDBSource(CommonDbSourceService):
    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_connection = config.serviceConnection
        connection = service_connection.root.config if service_connection else None
        if not isinstance(connection, DuckDBConnection):
            raise InvalidSourceException(f"Expected DuckDBConnection, but got {connection}")
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        yield get_database_name(self.engine, self.service_connection)

    def _get_columns_internal(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType | None = None,
    ) -> list[dict[str, Any]]:
        """Columns with DuckDB types translated for ``ColumnTypeParser``.

        The raw DuckDB type is kept as ``system_data_type`` so the catalog shows the
        type as DuckDB spells it; nested types carry the Hive-style form instead,
        which the shared parser expands into child columns.
        """
        result = self.connection.execute(
            DUCKDB_COLUMNS, {"schema_name": schema_name.rsplit(".", 1)[-1], "table_name": table_name}
        )
        columns = []
        for row in result:
            column_type = parse_duckdb_type(row.data_type)
            columns.append(
                {
                    "name": row.column_name,
                    "type": column_type.om_type,
                    "nullable": row.is_nullable,
                    "default": row.column_default,
                    "comment": row.comment,
                    "ordinal_position": row.ordinal_position,
                    "system_data_type": column_type.complex_type or row.data_type,
                    "is_complex": column_type.complex_type is not None,
                }
            )
        return columns
