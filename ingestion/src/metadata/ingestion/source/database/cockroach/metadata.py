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
Cockroach source module
"""
import re
import traceback
from collections import namedtuple
from typing import Iterable, List, Optional, Tuple

from sqlalchemy import sql
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.cockroachConnection import (
    CockroachConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.cockroach.queries import (
    COCKROACH_GET_DB_NAMES,
    COCKROACH_GET_PARTITION_DETAILS,
    COCKROACH_GET_TABLE_NAMES,
    COCKROACH_GET_VIEW_NAMES,
    COCKROACH_SCHEMA_COMMENTS,
)
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.common_pg_mappings import (
    INTERVAL_TYPE_MAP,
    RELKIND_MAP,
    ischema_names,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.importer import import_side_effects
from metadata.utils.logger import ingestion_logger

import_side_effects(
    "metadata.ingestion.source.database.postgres.converter_orm",
    "metadata.ingestion.source.database.postgres.metrics",
)

TableKey = namedtuple("TableKey", ["schema", "table_name"])

logger = ingestion_logger()

PGDialect.ischema_names = ischema_names

# Regex pattern to identify CockroachDB hidden shard columns.
# These columns are created for hash-sharded indexes with names like
# 'crdb_internal_id_shard_16'. They are marked as NOT VISIBLE and
# should be filtered from constraint columns.
# See: https://www.cockroachlabs.com/docs/stable/hash-sharded-indexes
HIDDEN_SHARD_COLUMN_PATTERN = re.compile(r"^crdb_internal_.*_shard_\d+$")


class CockroachSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Cockroach Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.schema_desc_map = {}

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadataConnection,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: CockroachConnection = config.serviceConnection.root.config
        if not isinstance(connection, CockroachConnection):
            raise InvalidSourceException(
                f"Expected CockroachConnection, but got {connection}"
            )
        return cls(config, metadata)

    def set_schema_description_map(self) -> None:
        self.schema_desc_map.clear()
        results = self.engine.execute(COCKROACH_SCHEMA_COMMENTS).all()
        for row in results:
            self.schema_desc_map[(row.database_name, row.schema_name)] = row.comment

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get((self.context.get().database, schema_name))

    @staticmethod
    def _is_hidden_shard_column(column_name: str) -> bool:
        """
        Check if a column is a CockroachDB hidden shard column.

        CockroachDB creates hidden virtual columns for hash-sharded indexes
        with names like 'crdb_internal_id_shard_16'. These columns are marked
        as NOT VISIBLE and are not returned by get_columns(), but they appear
        in primary key constraints, causing validation errors.

        See: https://www.cockroachlabs.com/docs/stable/hash-sharded-indexes
        """
        return bool(HIDDEN_SHARD_COLUMN_PATTERN.match(column_name))

    def _get_columns_with_constraints(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List, List]:
        """
        Get columns with constraints, filtering out hidden shard columns
        from primary key constraints.

        CockroachDB uses hidden virtual columns (NOT VISIBLE) for hash-sharded
        indexes. These columns appear in primary key constraints but are not
        included in the column list, causing a mismatch that results in
        'Invalid column name found in table constraint' errors from the server.
        """
        (
            pk_columns,
            unique_columns,
            foreign_columns,
        ) = super()._get_columns_with_constraints(schema_name, table_name, inspector)

        # Filter out hidden shard columns from primary key constraints
        if pk_columns:
            filtered_pk_columns = [
                col for col in pk_columns if not self._is_hidden_shard_column(col)
            ]
            pk_columns = filtered_pk_columns

        return pk_columns, unique_columns, foreign_columns

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        result = self.connection.execute(
            sql.text(COCKROACH_GET_TABLE_NAMES),
            {"schema": schema_name},
        )
        return [
            TableNameAndType(
                name=name, type_=RELKIND_MAP.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        result = self.connection.execute(
            sql.text(COCKROACH_GET_VIEW_NAMES),
            {"schema": schema_name},
        )
        return [
            TableNameAndType(
                name=name, type_=RELKIND_MAP.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def get_configured_database(self) -> Optional[str]:
        if not self.service_connection.ingestAllDatabases:
            return self.service_connection.database
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(COCKROACH_GET_DB_NAMES)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.root.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.root.config.database
            self.set_inspector(database_name=configured_db)
            self.set_schema_description_map()
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
                    (
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_database
                    ),
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    self.set_schema_description_map()
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector
    ) -> Tuple[bool, TablePartition]:
        result = self.engine.execute(
            COCKROACH_GET_PARTITION_DETAILS, table_name=table_name
        ).all()
        if result:
            partition_details = TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=row[1],
                        intervalType=INTERVAL_TYPE_MAP.get(
                            row[2], PartitionIntervalTypes.COLUMN_VALUE
                        ),
                        interval=None,
                    )
                    for row in result
                ]
            )
            return True, partition_details
        return False, None
