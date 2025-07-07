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
import traceback
from collections import namedtuple
from typing import Iterable, Optional, Tuple

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
    GREENPLUM_GET_TABLE_NAMES,
    GREENPLUM_PARTITION_DETAILS,
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
    get_all_view_definitions,
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


class GreenplumSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Greenplum Source
    """

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadataConnection,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GreenplumConnection = config.serviceConnection.root.config
        if not isinstance(connection, GreenplumConnection):
            raise InvalidSourceException(
                f"Expected GreenplumConnection, but got {connection}"
            )
        return cls(config, metadata)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        result = self.connection.execute(
            sql.text(GREENPLUM_GET_TABLE_NAMES),
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
        yield from self._execute_database_query(GREENPLUM_GET_DB_NAMES)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.root.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.root.config.database
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
                    database_fqn
                    if self.source_config.useFqnForFiltering
                    else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:
        result = self.engine.execute(
            GREENPLUM_PARTITION_DETAILS.format(
                table_name=table_name, schema_name=schema_name
            )
        ).all()

        if result:
            partition_details = TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=row.column_name,
                        intervalType=INTERVAL_TYPE_MAP.get(
                            result[0].partition_strategy,
                            PartitionIntervalTypes.COLUMN_VALUE,
                        ),
                        interval=None,
                    )
                    for row in result
                    if row.column_name
                ]
            )
            return True, partition_details
        return False, None
