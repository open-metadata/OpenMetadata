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
from typing import Iterable, List, Optional, Tuple

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
    EntityName,
    IntervalType,
    Table,
    TableConstraint,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.redshift.models import RedshiftStoredProcedure
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_DATABASE_NAMES,
    REDSHIFT_GET_STORED_PROCEDURE_QUERIES,
    REDSHIFT_GET_STORED_PROCEDURES,
    REDSHIFT_PARTITION_DETAILS,
)
from metadata.ingestion.source.database.redshift.utils import (
    _get_all_relation_info,
    _get_column_info,
    _get_pg_column_info,
    _get_schema_column_info,
    get_columns,
    get_filter_pattern_query,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureMixin,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
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
PGDialect.get_schema_names = get_schema_names
Inspector.get_schema_names = get_schema_names_reflection


class RedshiftSource(StoredProcedureMixin, CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Redshift Source
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.partition_details = {}

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedshiftConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        return cls(config, metadata_config)

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

        if self.source_config.tableFilterPattern:
            tb_patterns_include = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.includes
                if self.source_config.tableFilterPattern.includes
            ]
            tb_patterns_exclude = [
                tb_name.replace("%", "%%")
                for tb_name in self.source_config.tableFilterPattern.excludes
                if self.source_config.tableFilterPattern.excludes
            ]
            if (
                self.source_config.tableFilterPattern.includes
                and self.source_config.tableFilterPattern.excludes
            ):
                format_pattern = f"where {get_filter_pattern_query(tb_patterns_include, 'name')} or {get_filter_pattern_query(tb_patterns_exclude,'name', exclude=True)} "  # pylint: disable=line-too-long
            else:
                format_pattern = (
                    f"where {get_filter_pattern_query(tb_patterns_include,'name')}"
                    if self.source_config.tableFilterPattern.includes
                    else f"and ({get_filter_pattern_query(tb_patterns_exclude, 'name',exclude=True)}"
                )
        result = self.connection.execute(
            sql.text(REDSHIFT_GET_ALL_RELATION_INFO.format(format_pattern))
            if self.source_config.pushFilterDown
            and self.source_config.tableFilterPattern
            else sql.text(REDSHIFT_GET_ALL_RELATION_INFO.format("")),
            {"schema": schema_name},
        )

        return [
            TableNameAndType(
                name=name, type_=STANDARD_TABLE_TYPES.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.
        Fetches them up using the context information and
        the inspector set when preparing the db.
        :return: tables or views, depending on config
        """
        try:
            schema_name = self.context.database_schema.name.__root__
            if self.source_config.includeTables:
                for table_and_type in self.query_table_names_and_types(schema_name):
                    table_name = self.standardize_table_name(
                        schema_name, table_and_type.name
                    )
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if not self.source_config.pushFilterDown:
                        if filter_by_table(
                            self.source_config.tableFilterPattern,
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name,
                        ):
                            self.status.filter(
                                table_fqn,
                                "Table Filtered Out",
                            )
                            continue
                    yield table_name, table_and_type.type_

            if self.source_config.includeViews:
                for view_name in self.inspector.get_view_names(schema_name):
                    view_name = self.standardize_table_name(schema_name, view_name)
                    view_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=view_name,
                    )

                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        view_fqn
                        if self.source_config.useFqnForFiltering
                        else view_name,
                    ):
                        self.status.filter(
                            view_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield view_name, TableType.View
        except Exception as err:
            logger.warning(
                f"Fetching tables names failed for schema {schema_name} due to - {err}"
            )
            logger.debug(traceback.format_exc())

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            self.inspector = inspect(self.engine)
            self.get_partition_details()
            yield self.config.serviceConnection.__root__.config.database
        else:
            if self.source_config.databaseFilterPattern:
                db_patterns_include = [
                    db_name.replace("%", "%%")
                    for db_name in self.source_config.databaseFilterPattern.includes
                    if self.source_config.databaseFilterPattern.includes
                ]
                db_patterns_exclude = [
                    db_name.replace("%", "%%")
                    for db_name in self.source_config.databaseFilterPattern.excludes
                    if self.source_config.databaseFilterPattern.excludes
                ]
                if (
                    self.source_config.databaseFilterPattern.includes
                    and self.source_config.databaseFilterPattern.excludes
                ):
                    format_pattern = f"where {get_filter_pattern_query(db_patterns_include,'datname')} or {get_filter_pattern_query(db_patterns_exclude,'datname', exclude=True)} "  # pylint: disable=line-too-long
                else:
                    format_pattern = (
                        f"where {get_filter_pattern_query(db_patterns_include,'datname')}"
                        if self.source_config.databaseFilterPattern.includes
                        else f"where {get_filter_pattern_query(db_patterns_exclude,'datname', exclude=True)}"
                    )

            results = self.connection.execute(
                REDSHIFT_GET_DATABASE_NAMES.format(format_pattern)
                if self.source_config.pushFilterDown
                and self.source_config.databaseFilterPattern
                else REDSHIFT_GET_DATABASE_NAMES.format("")
            )
            for res in results:
                row = list(res)
                new_database = row[0]
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name=new_database,
                )
                if not self.source_config.pushFilterDown:
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

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                pushFilterDown=self.source_config.pushFilterDown,
                filter_include_schema_name=self.source_config.schemaFilterPattern.includes
                if self.source_config.schemaFilterPattern
                and self.source_config.schemaFilterPattern.includes
                else [],
                filter_exclude_schema_name=self.source_config.schemaFilterPattern.excludes
                if self.source_config.schemaFilterPattern
                and self.source_config.schemaFilterPattern.excludes
                else [],
            ):
                yield schema_name

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=schema_name,
            )
            if not self.source_config.pushFilterDown:
                if filter_by_schema(
                    self.source_config.schemaFilterPattern,
                    schema_fqn
                    if self.source_config.useFqnForFiltering
                    else schema_name,
                ):
                    if add_to_status:
                        self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
            yield schema_fqn if return_fqn else schema_name

    def _get_partition_key(self, diststyle: str) -> Optional[List[str]]:
        try:
            regex = re.match(r"KEY\((\w+)\)", diststyle)
            if regex:
                return [regex.group(1)]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(err)
        return None

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, TablePartition]:
        diststyle = self.partition_details.get(f"{schema_name}.{table_name}")
        if diststyle:
            partition_details = TablePartition(
                columns=self._get_partition_key(diststyle),
                intervalType=IntervalType.COLUMN_VALUE,
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
                    schema_name=self.context.database_schema.name.__root__,
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
            yield Either(
                right=CreateStoredProcedureRequest(
                    name=EntityName(__root__=stored_procedure.name),
                    storedProcedureCode=StoredProcedureCode(
                        language=Language.SQL,
                        code=stored_procedure.definition,
                    ),
                    databaseSchema=self.context.database_schema.fullyQualifiedName,
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.name}] due to [{exc}]",
                    stack_trace=traceback.format_exc(),
                )
            )

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """
        Pick the stored procedure name from the context
        and return the list of associated queries
        """
        # Only process if we actually have yield a stored procedure
        if self.context.stored_procedure:
            start, _ = get_start_and_end(self.source_config.queryLogDuration)
            query = REDSHIFT_GET_STORED_PROCEDURE_QUERIES.format(
                start_date=start,
                database_name=self.context.database.name.__root__,
            )

            queries_dict = self.procedure_queries_dict(
                query=query,
                schema_name=self.context.database_schema.name.__root__,
                database_name=self.context.database.name.__root__,
            )

            for query_by_procedure in (
                queries_dict.get(self.context.stored_procedure.name.__root__.lower())
                or []
            ):
                yield query_by_procedure
