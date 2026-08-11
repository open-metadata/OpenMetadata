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
from collections import defaultdict
from collections.abc import Iterable
from itertools import chain
from typing import TYPE_CHECKING

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
    get_materialized_view_definition,
    query_tables,
)

if TYPE_CHECKING:
    from metadata.ingestion.source.database.questdb.models import QuestDBTableRow
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

QUESTDB_TABLE_TYPE_TABLE = "T"
QUESTDB_TABLE_TYPE_VIEW = "V"
QUESTDB_TABLE_TYPE_MATERIALIZED_VIEW = "M"
QUESTDB_PARTITION_NONE = "NONE"
QUESTDB_PARTITION_NA = "N/A"

QUESTDB_VIEW_TYPE_MAP = {
    QUESTDB_TABLE_TYPE_VIEW: TableType.View,
    QUESTDB_TABLE_TYPE_MATERIALIZED_VIEW: TableType.MaterializedView,
}


class QuestDBSource(CommonDbSourceService):
    """
    QuestDB is a single-database (``qdb``), single-schema (``public``) system
    exposing metadata via QuestDB-native ``tables()`` and ``views()`` table
    functions.
    """

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_conn = config.serviceConnection
        connection = service_conn.root.config if service_conn is not None else None
        if not isinstance(connection, QuestDBConnection):
            raise InvalidSourceException(f"Expected QuestDBConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata) -> None:
        super().__init__(config, metadata)
        self._tables_cache: defaultdict[str, dict[str, QuestDBTableRow]] = defaultdict(dict)
        try:
            rows = query_tables(self.connection)
            for row in rows:
                self._tables_cache[row.table_type][row.name] = row
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to load QuestDB table catalog: %s — partition details will be unavailable", exc)

    def get_database_names(self) -> Iterable[str]:
        yield QUESTDB_DEFAULT_DATABASE

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Yield ``TableNameAndType`` entries for QuestDB tables (``table_type == "T"``).

        Tables with a ``partitionBy`` value other than ``NONE`` are typed
        ``TableType.Partitioned``; all others are ``TableType.Regular``.
        """
        for row in self._tables_cache.get(QUESTDB_TABLE_TYPE_TABLE, {}).values():
            try:
                table_type = (
                    TableType.Partitioned
                    if row.partition_by and row.partition_by != QUESTDB_PARTITION_NONE
                    else TableType.Regular
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
        for row in chain(
            self._tables_cache.get(QUESTDB_TABLE_TYPE_VIEW, {}).values(),
            self._tables_cache.get(QUESTDB_TABLE_TYPE_MATERIALIZED_VIEW, {}).values(),
        ):
            try:
                yield TableNameAndType(name=row.name, type_=QUESTDB_VIEW_TYPE_MAP[row.table_type])
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Skipping view %s: %s", row.name, exc)

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        if table_type == TableType.MaterializedView:
            try:
                result = get_materialized_view_definition(self.connection, table_name)
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
            row = self._tables_cache.get(QUESTDB_TABLE_TYPE_TABLE, {}).get(table_name)
            if row is None:
                return False, None
            partition_by = row.partition_by
            designated_timestamp = row.designated_timestamp
            if (
                not partition_by
                or partition_by in (QUESTDB_PARTITION_NONE, QUESTDB_PARTITION_NA)
                or not designated_timestamp
            ):
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
