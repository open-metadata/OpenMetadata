#  Copyright 2025 OpenMetadata
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
QuestDB source module
"""

import traceback
from collections.abc import Iterable

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.questdbConnection import (
    QuestDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.questdb.connection import (
    QUESTDB_DEFAULT_DATABASE,
)
from metadata.ingestion.source.database.questdb.utils import (
    _get_materialized_view_definition,
    _query_tables,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QuestDBSource(CommonDbSourceService):
    """
    QuestDB is a single-database (``qdb``), single-schema (``public``) system
    exposing metadata via QuestDB-native ``tables()`` and ``views()`` table
    functions.
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, QuestDBConnection):
            raise InvalidSourceException(f"Expected QuestDBConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata) -> None:
        super().__init__(config, metadata)
        try:
            rows = _query_tables(self.connection)
            self._tables_cache = {row.name: row for row in rows}
            logger.info("Loaded %d entries from QuestDB tables() catalog", len(self._tables_cache))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to load QuestDB table catalog: %s — partition details will be unavailable", exc)
            self._tables_cache = {}

    def get_database_names(self) -> Iterable[str]:
        yield self.service_connection.databaseName or QUESTDB_DEFAULT_DATABASE

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Yield ``TableNameAndType`` entries for QuestDB tables (``table_type == "T"``).

        Tables with a ``partitionBy`` value other than ``NONE`` are typed
        ``TableType.Partitioned``; all others are ``TableType.Regular``.
        """
        for row in self._tables_cache.values():
            if row.table_type != "T":
                continue
            try:
                table_type = (
                    TableType.Partitioned if row.partition_by and row.partition_by != "NONE" else TableType.Regular
                )
                yield TableNameAndType(name=row.name, type_=table_type)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Skipping table %s: %s", row.name, exc)

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Yield ``TableNameAndType`` entries for QuestDB views and materialized views.

        Rows with ``table_type == "V"`` are typed ``TableType.View``; rows with
        ``table_type == "M"`` are typed ``TableType.MaterializedView``.
        """
        for row in self._tables_cache.values():
            if row.table_type not in ("V", "M"):
                continue
            try:
                table_type = TableType.View if row.table_type == "V" else TableType.MaterializedView
                yield TableNameAndType(name=row.name, type_=table_type)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Skipping view %s: %s", row.name, exc)

    def get_schema_definition(self, table_type, table_name, schema_name, inspector):
        if table_type == TableType.MaterializedView:
            try:
                result = _get_materialized_view_definition(self.connection, table_name)
                return str(result).strip() if result else None
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to fetch materialized view definition for %s: %s", table_name, exc)
                return None
        return super().get_schema_definition(table_type, table_name, schema_name, inspector)

    def get_table_partition_details(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> tuple[bool, TablePartition | None]:
        """
        Return the partition details for a QuestDB table.

        Reads ``partitionBy`` and ``designatedTimestamp`` from the cached
        ``tables()`` row and returns a ``TablePartition`` with a single
        ``TIME_UNIT`` column using the designated timestamp and partition interval.
        """
        try:
            row = self._tables_cache.get(table_name)
            if row is None:
                return False, None
            partition_by = row.partition_by
            designated_timestamp = row.designated_timestamp
            if not partition_by or partition_by in ("NONE", "N/A") or not designated_timestamp:
                return False, None
            logger.debug("Table %s partitioned by %s on column %s", table_name, partition_by, designated_timestamp)
            return True, TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=designated_timestamp,
                        intervalType=PartitionIntervalTypes.TIME_UNIT,
                        interval=partition_by,
                    )
                ]
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to get partition details for %s: %s", table_name, exc)
            return False, None
