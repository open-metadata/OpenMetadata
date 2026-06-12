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
Greenplum source module
"""

import re
import traceback
from collections import namedtuple
from typing import Iterable, Optional, Tuple  # noqa: UP035

from sqlalchemy import sql, text
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.engine import Inspector
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import (
    GreenplumConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.common_pg_mappings import (
    INTERVAL_TYPE_MAP,
    RELKIND_MAP,
    ischema_names,
)
from metadata.ingestion.source.database.greenplum.queries import (
    GREENPLUM_GET_DB_NAMES,
    GREENPLUM_GET_TABLE_NAMES_V6,
    GREENPLUM_GET_TABLE_NAMES_V7,
    GREENPLUM_GET_VERSION,
    GREENPLUM_PARTITION_DETAILS_V6,
    GREENPLUM_PARTITION_DETAILS_V7,
)
from metadata.ingestion.source.database.greenplum.utils import (
    get_column_info,
    get_columns,
    get_table_comment,
    get_view_definition,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_all_view_definitions,
    get_table_ddl,
)

TableKey = namedtuple("TableKey", ["schema", "table_name"])

logger = ingestion_logger()


PGDialect.get_all_table_comments = get_all_table_comments
PGDialect.get_table_comment = get_table_comment
PGDialect._get_column_info = get_column_info  # pylint: disable=protected-access
PGDialect.get_view_definition = get_view_definition
PGDialect.get_columns = get_columns
PGDialect.get_all_view_definitions = get_all_view_definitions

PGDialect.ischema_names = ischema_names

Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl


class GreenplumSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Greenplum Source
    """

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        self._greenplum_version: int | None = None

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadataConnection,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GreenplumConnection = config.serviceConnection.root.config
        if not isinstance(connection, GreenplumConnection):
            raise InvalidSourceException(f"Expected GreenplumConnection, but got {connection}")
        return cls(config, metadata)

    def _get_greenplum_major_version(self) -> int:
        if self._greenplum_version is None:
            try:
                with self.engine.connect() as conn:
                    result = conn.execute(text(GREENPLUM_GET_VERSION))
                    version_string = result.scalar() or ""
                match = re.search(r"Greenplum Database (\d+)", version_string)
                if match:
                    self._greenplum_version = int(match.group(1))
                    logger.info("Detected Greenplum major version %d", self._greenplum_version)
                else:
                    logger.warning(
                        "Could not parse Greenplum major version from SELECT version() output, "
                        "defaulting to 7 to avoid querying removed GP6-specific catalog tables"
                    )
                    logger.debug("Full version() output: %s", version_string)
                    self._greenplum_version = 7
            except SQLAlchemyError as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Could not determine Greenplum version (%s), "
                    "defaulting to 7 to avoid querying removed GP6-specific catalog tables",
                    exc,
                )
                self._greenplum_version = 7
        return self._greenplum_version

    def _is_v7_or_later(self) -> bool:
        return self._get_greenplum_major_version() >= 7

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        table_names_query = GREENPLUM_GET_TABLE_NAMES_V7 if self._is_v7_or_later() else GREENPLUM_GET_TABLE_NAMES_V6
        result = self.connection.execute(
            sql.text(table_names_query),
            {"schema": schema_name},
        )

        return [
            TableNameAndType(name=name, type_=RELKIND_MAP.get(relkind, TableType.Regular)) for name, relkind in result
        ]

    def get_configured_database(self) -> Optional[str]:  # noqa: UP045
        if not self.service_connection.ingestAllDatabases:
            return self.service_connection.database
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(GREENPLUM_GET_DB_NAMES)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.root.config.ingestAllDatabases:  # pyright: ignore[reportAttributeAccessIssue]
            configured_db = self.config.serviceConnection.root.config.database  # pyright: ignore[reportAttributeAccessIssue]
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )

                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn if self.source_config.useFqnForFiltering else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Error trying to connect to database {new_database}: {exc}")

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:  # noqa: UP006, UP045
        if self._is_v7_or_later():
            return self._get_table_partition_details_v7(table_name, schema_name)
        return self._get_table_partition_details_v6(table_name, schema_name)

    def _get_table_partition_details_v6(
        self, table_name: str, schema_name: str
    ) -> Tuple[bool, Optional[TablePartition]]:  # noqa: UP006, UP045
        with self.engine.connect() as conn:
            result = conn.execute(
                text(GREENPLUM_PARTITION_DETAILS_V6),
                {"table_name": table_name, "schema_name": schema_name},
            ).all()

        return self._build_partition_result(result)

    def _get_table_partition_details_v7(
        self, table_name: str, schema_name: str
    ) -> Tuple[bool, Optional[TablePartition]]:  # noqa: UP006, UP045
        with self.engine.connect() as conn:
            result = conn.execute(
                text(GREENPLUM_PARTITION_DETAILS_V7),
                {"table_name": table_name, "schema_name": schema_name},
            ).all()

        return self._build_partition_result(result)

    @staticmethod
    def _build_partition_result(
        result,
    ) -> Tuple[bool, Optional[TablePartition]]:  # noqa: UP006, UP045
        # When a partition key is an expression (not a plain column),
        # pg_partitioned_table.partattrs / pg_partition.paratts contains 0, so the
        # join to information_schema.columns yields NULL column_name and the row is
        # filtered out below. The table is still partitioned; we just cannot surface
        # the partition-column details yet. Return (True, None) so it is ingested as
        # TableType.Partitioned rather than TableType.Regular.
        if not result:
            return False, None
        columns = [
            PartitionColumnDetails(
                columnName=row.column_name,
                intervalType=INTERVAL_TYPE_MAP.get(
                    row.partition_strategy,
                    PartitionIntervalTypes.COLUMN_VALUE,
                ),
                interval=None,
            )
            for row in result
            if row.column_name
        ]
        if not columns:
            # Partition exists but all keys are expression-based (column_name is NULL).
            return True, None
        return True, TablePartition(columns=columns)
