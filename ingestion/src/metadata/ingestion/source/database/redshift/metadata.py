#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Redshift source ingestion
"""

import re
import traceback
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import inspect, sql
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_redshift.dialect import RedshiftDialect, RedshiftDialectMixin

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TableConstraint,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.life_cycle_query_mixin import (
    LifeCycleQueryMixin,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.redshift.models import RedshiftStoredProcedure
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_GET_STORED_PROCEDURE_QUERIES,
    REDSHIFT_GET_STORED_PROCEDURES,
    REDSHIFT_LIFE_CYCLE_QUERY,
    REDSHIFT_PARTITION_DETAILS,
)
from metadata.ingestion.source.database.redshift.utils import (
    _get_all_relation_info,
    _get_column_info,
    _get_pg_column_info,
    _get_schema_column_info,
    get_columns,
    get_table_comment,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureMixin,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_all_table_comments

logger = ingestion_logger()


STANDARD_TABLE_TYPES = {
    "r": TableType.Regular,
    "e": TableType.External,
    "v": TableType.View,
}


RedshiftDialectMixin._get_column_info = (  # pylint: disable=protected-access
    _get_column_info
)
RedshiftDialectMixin._get_schema_column_info = (  # pylint: disable=protected-access
    _get_schema_column_info
)
RedshiftDialectMixin.get_columns = get_columns
PGDialect._get_column_info = _get_pg_column_info  # pylint: disable=protected-access
RedshiftDialect.get_all_table_comments = get_all_table_comments
RedshiftDialect.get_table_comment = get_table_comment
RedshiftDialect._get_all_relation_info = (  # pylint: disable=protected-access
    _get_all_relation_info
)


class RedshiftSource(
    LifeCycleQueryMixin, StoredProcedureMixin, CommonDbSourceService, MultiDBSource
):
    """
    Implements the necessary methods to extract
    Database metadata from Redshift Source
    """

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        self.partition_details = {}
        self.life_cycle_query = REDSHIFT_LIFE_CYCLE_QUERY

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedshiftConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_partition_details(self) -> None:
        """
        Populate partition details
        """
        try:
            self.partition_details.clear()
            results = self.engine.execute(REDSHIFT_PARTITION_DETAILS).fetchall()
            for row in results:
                self.partition_details[f"{row.schema}.{row.table}"] = row.diststyle
        except Exception as exe:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch partition details due: {exe}")

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Handle custom table types
        """

        result = self.connection.execute(
            sql.text(REDSHIFT_GET_ALL_RELATION_INFO),
            {"schema": schema_name},
        )

        return [
            TableNameAndType(
                name=name, type_=STANDARD_TABLE_TYPES.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def get_configured_database(self) -> Optional[str]:
        if not self.service_connection.ingestAllDatabases:
            return self.service_connection.database
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(REDSHIFT_GET_DATABASE_NAMES)

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            self.inspector = inspect(self.engine)
            self.get_partition_details()
            yield self.config.serviceConnection.__root__.config.database
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service,
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
                    self.get_partition_details()
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def _get_partition_key(self, diststyle: str) -> Optional[str]:
        try:
            regex = re.match(r"KEY\((\w+)\)", diststyle)
            if regex:
                return regex.group(1)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(err)
        return None

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:
        diststyle = self.partition_details.get(f"{schema_name}.{table_name}")
        if diststyle:
            distkey = self._get_partition_key(diststyle)
            if distkey is not None:
                partition_details = TablePartition(
                    columns=[
                        PartitionColumnDetails(
                            columnName=distkey,
                            intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                            interval=None,
                        )
                    ]
                )
            return True, partition_details
        return False, None

    def process_additional_table_constraints(
        self, column: dict, table_constraints: List[TableConstraint]
    ) -> None:
        """
        Process DIST_KEY & SORT_KEY column properties
        """

        if column.get("distkey"):
            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.DIST_KEY,
                    columns=[column.get("name")],
                )
            )

        if column.get("sortkey"):
            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.SORT_KEY,
                    columns=[column.get("name")],
                )
            )

    def get_stored_procedures(self) -> Iterable[RedshiftStoredProcedure]:
        """List Snowflake stored procedures"""
        if self.source_config.includeStoredProcedures:
            results = self.engine.execute(
                REDSHIFT_GET_STORED_PROCEDURES.format(
                    schema_name=self.context.database_schema,
                )
            ).all()
            for row in results:
                stored_procedure = RedshiftStoredProcedure.parse_obj(dict(row))
                yield stored_procedure

    def yield_stored_procedure(
        self, stored_procedure: RedshiftStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(__root__=stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.database_service,
                    database_name=self.context.database,
                    schema_name=self.context.database_schema,
                ),
            )
            yield Either(right=stored_procedure_request)

            self.register_record_stored_proc_request(stored_procedure_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = REDSHIFT_GET_STORED_PROCEDURE_QUERIES.format(
            start_date=start,
            database_name=self.context.database,
        )

        queries_dict = self.procedure_queries_dict(
            query=query,
        )

        return queries_dict
