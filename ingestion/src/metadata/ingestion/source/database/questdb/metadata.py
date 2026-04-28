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
from metadata.ingestion.source.database.questdb.utils import _query_tables


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
        self._tables_cache = {row.name: row for row in _query_tables(self.connection)}

    def get_database_names(self) -> Iterable[str]:
        yield self.service_connection.databaseName or QUESTDB_DEFAULT_DATABASE

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Yield ``TableNameAndType`` entries for QuestDB tables (``table_type == "T"``).

        Tables with a ``partitionBy`` value other than ``NONE`` are typed
        ``TableType.Partitioned``; all others are ``TableType.Regular``.
        """
        result: list[TableNameAndType] = []
        for row in self._tables_cache.values():
            if row.table_type != "T":
                continue
            table_type = TableType.Partitioned if row.partition_by and row.partition_by != "NONE" else TableType.Regular
            result.append(TableNameAndType(name=row.name, type_=table_type))
        return result

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Yield ``TableNameAndType`` entries for QuestDB views and materialized views.

        Rows with ``table_type == "V"`` are typed ``TableType.View``; rows with
        ``table_type == "M"`` are typed ``TableType.MaterializedView``.
        """
        return [
            TableNameAndType(
                name=row.name,
                type_=(TableType.View if row.table_type == "V" else TableType.MaterializedView),
            )
            for row in self._tables_cache.values()
            if row.table_type in ("V", "M")
        ]

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
        row = self._tables_cache.get(table_name)
        if row is None:
            return False, None
        partition_by = row.partition_by
        designated_timestamp = row.designated_timestamp
        if not partition_by or partition_by in ("NONE", "N/A") or not designated_timestamp:
            return False, None
        return True, TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName=designated_timestamp,
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval=partition_by,
                )
            ]
        )
