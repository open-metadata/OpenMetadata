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
Redshift source ingestion
"""
import re
import traceback
from typing import Iterable, List, Optional, Tuple

from sqlalchemy import sql
from sqlalchemy.dialects.postgresql.base import PGDialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_redshift.dialect import (
    FOREIGN_KEY_RE,
    SQL_IDENTIFIER_RE,
    RedshiftDialect,
    RedshiftDialectMixin,
)

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
    Table,
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
from metadata.ingestion.api.delete import delete_entity_by_name
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.life_cycle_query_mixin import (
    LifeCycleQueryMixin,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.redshift.incremental_table_processor import (
    RedshiftIncrementalTableProcessor,
)
from metadata.ingestion.source.database.redshift.models import RedshiftStoredProcedure
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_EXTERNAL_TABLE_LOCATION,
    REDSHIFT_GET_ALL_CONSTRAINTS,
    REDSHIFT_GET_ALL_RELATION_INFO,
    REDSHIFT_GET_DATABASE_NAMES,
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
    get_redshift_columns,
    get_table_comment,
    get_view_definition,
)
from metadata.utils import fqn
from metadata.utils.execution_time_tracker import (
    calculate_execution_time,
    calculate_execution_time_generator,
)
from metadata.utils.filters import filter_by_database
from metadata.utils.helpers import clean_up_starting_ending_double_quotes_in_string
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_table_ddl,
)

logger = ingestion_logger()


STANDARD_TABLE_TYPES = {
    "r": TableType.Regular,
    "e": TableType.External,
    "v": TableType.View,
    "m": TableType.MaterializedView,
}

# pylint: disable=protected-access
RedshiftDialectMixin._get_column_info = _get_column_info
RedshiftDialectMixin._get_schema_column_info = _get_schema_column_info
RedshiftDialectMixin.get_columns = get_columns
PGDialect._get_column_info = _get_pg_column_info
RedshiftDialect.get_all_table_comments = get_all_table_comments
RedshiftDialect.get_table_comment = get_table_comment
RedshiftDialect.get_view_definition = get_view_definition
RedshiftDialect._get_redshift_columns = get_redshift_columns
RedshiftDialect._get_all_relation_info = (  # pylint: disable=protected-access
    _get_all_relation_info
)
Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl


class RedshiftSource(
    ExternalTableLineageMixin, LifeCycleQueryMixin, CommonDbSourceService, MultiDBSource
):
    """
    Implements the necessary methods to extract
    Database metadata from Redshift Source
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata,
        incremental_configuration: IncrementalConfig,
    ):
        super().__init__(config, metadata)
        self.partition_details = {}
        self.constraint_details: dict[
            str, dict[str, set[str] | list[dict[str, str]]]
        ] = {}
        self.life_cycle_query = REDSHIFT_LIFE_CYCLE_QUERY
        self.context.get_global().deleted_tables = []
        self.incremental = incremental_configuration
        self.incremental_table_processor: Optional[
            RedshiftIncrementalTableProcessor
        ] = None
        self.external_location_map = {}

        if self.incremental.enabled:
            logger.info(
                "Starting Incremental Metadata Extraction.\n\t Considering Table changes from %s",
                self.incremental.start_datetime_utc,
            )

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: RedshiftConnection = config.serviceConnection.root.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        incremental_config = IncrementalConfig.create(
            config.sourceConfig.config.incremental, pipeline_name, metadata
        )
        return cls(config, metadata, incremental_config)

    def get_location_path(self, table_name: str, schema_name: str) -> Optional[str]:
        """
        Method to fetch the location path of the table
        """
        return self.external_location_map.get(
            (self.context.get().database, schema_name, table_name)
        )

    def get_partition_details(self) -> None:
        """
        Populate partition details
        """
        try:
            self.partition_details.clear()
            results = self.connection.execute(
                statement=REDSHIFT_PARTITION_DETAILS
            ).fetchall()
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
        self._set_constraint_details(schema_name)

        result = self.connection.execute(
            sql.text(
                REDSHIFT_GET_ALL_RELATION_INFO.format(
                    view_filter=(
                        "OR c.relkind IN ('v', 'm')"
                        if self.source_config.includeViews
                        else "AND c.relkind NOT IN ('v', 'm')"
                    )
                )
            ),
            {"schema": schema_name},
        )

        if self.incremental.enabled:
            result = [
                (name, relkind)
                for name, relkind in result
                if name
                in self.incremental_table_processor.get_not_deleted(
                    schema_name=schema_name
                )
            ]

        return [
            TableNameAndType(
                name=name, type_=STANDARD_TABLE_TYPES.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the view
        name and type. By default, use the inspector method
        to get the names and pass the View type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., material views,...
        """
        return []

    def get_configured_database(self) -> Optional[str]:
        if not self.service_connection.ingestAllDatabases:
            return self.service_connection.database
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(REDSHIFT_GET_DATABASE_NAMES)

    def _set_incremental_table_processor(self, database: str):
        """Prepares the needed data for doing incremental metadata extraction for a given database.

        1. Queries Redshift to get the changes done after the `self.incremental.start_datetime_utc`
        2. Sets the table map with the changes within the RedshiftIncrementalTableProcessor
        3. Sets the deleted tables in the context
        """
        if self.incremental.enabled:
            self.incremental_table_processor = RedshiftIncrementalTableProcessor.create(
                self.connection, self.inspector.default_schema_name
            )

            self.incremental_table_processor.set_table_map(
                database=database, start_date=self.incremental.start_datetime_utc
            )

            self.context.get_global().deleted_tables.extend(
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=database,
                    schema_name=schema_name,
                    table_name=table_name,
                )
                for schema_name, table_name in self.incremental_table_processor.get_deleted()
            )

    def set_external_location_map(self, database_name: str) -> None:
        self.external_location_map.clear()
        results = self.engine.execute(
            REDSHIFT_EXTERNAL_TABLE_LOCATION.format(database_name=database_name)
        ).all()
        self.external_location_map = {
            (database_name, row.schemaname, row.tablename): row.location
            for row in results
        }

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.root.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.root.config.database
            self.get_partition_details()
            self._set_incremental_table_processor(configured_db)
            self.set_external_location_map(configured_db)
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
                    self.get_partition_details()
                    self._set_incremental_table_processor(new_database)
                    self.set_external_location_map(new_database)
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

    @calculate_execution_time()
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
            results = self.connection.execute(
                REDSHIFT_GET_STORED_PROCEDURES.format(
                    schema_name=self.context.get().database_schema,
                )
            ).all()
            for row in results:
                stored_procedure = RedshiftStoredProcedure.model_validate(dict(row))
                yield stored_procedure

    @calculate_execution_time_generator()
    def yield_stored_procedure(
        self, stored_procedure: RedshiftStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
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

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if self.incremental.enabled:
            if not self.context.get().__dict__.get("database"):
                raise ValueError(
                    "No Database found in the context. We cannot run the table deletion."
                )

            if self.source_config.markDeletedTables:
                logger.info(
                    f"Mark Deleted Tables set to True. Processing database [{self.context.get().database}]"
                )
                yield from delete_entity_by_name(
                    self.metadata,
                    entity_type=Table,
                    entity_names=self.context.get_global().deleted_tables,
                    mark_deleted_entity=self.source_config.markDeletedTables,
                )
        else:
            yield from super().mark_tables_as_deleted()

    def _get_columns_with_constraints(
        self,
        schema_name: str,
        table_name: str,
        *args,
        **kwargs,
    ) -> tuple[list[str], list[str], list[str]]:
        """Fetch constraint for a specific schema and table

        Args:
            schema_name (str): schema name
            table_name (str): table name

        Returns:
            tuple[list, list, list]: list of primary, unique and foreign columns
        """
        constraints = self.constraint_details.get(f"{schema_name}.{table_name}", {})
        if not constraints:
            return [], [], []
        pkeys = [
            clean_up_starting_ending_double_quotes_in_string(p)
            for p in constraints.get("pkey", set())
        ]
        ukeys = [
            clean_up_starting_ending_double_quotes_in_string(p)
            for p in constraints.get("ukey", set())
        ]

        fkeys = []
        fkey_constraints: list[dict[str, str]] = constraints.get("fkey", [])
        for fkey_constraint in fkey_constraints:
            fkey_constraint.update(
                {
                    "constrained_columns": [
                        clean_up_starting_ending_double_quotes_in_string(column)
                        for column in fkey_constraint.get("constrained_columns")
                    ],
                    "referred_columns": [
                        clean_up_starting_ending_double_quotes_in_string(column)
                        for column in fkey_constraint.get("referred_columns")
                    ],
                }
            )
            fkeys.append(fkey_constraint)

        return pkeys, [ukeys], fkeys

    def _set_constraint_details(self, schema_name: str):
        """Get all the column constraints in a given schema

        Args:
            schema_name (str): schema name
        """
        self.constraint_details = (
            {}
        )  # reset constraint_details dict when fetching for a new schema

        rows = self.connection.execute(
            sql.text(REDSHIFT_GET_ALL_CONSTRAINTS),
            {"schema": schema_name},
        )

        for row in rows or []:
            schema_table_name = f"{row.schema}.{row.table_name}"
            schema_table_constraints = self.constraint_details.setdefault(
                schema_table_name, {}
            )
            if row.constraint_type == "p":
                pkey = schema_table_constraints.setdefault("pkey", set())
                pkey.add(row.column_name)
            if row.constraint_type == "f":
                fkey_constraint = {
                    "key": row.conkey,
                    "condef": row.condef,
                    "database": self.connection.engine.url.database,
                }
                extracted_fkey = self._extract_fkeys(fkey_constraint)
                fkey: list[dict[str, str]] = schema_table_constraints.setdefault(
                    "fkey", []
                )
                fkey.extend(extracted_fkey)
            if row.constraint_type == "u":
                ukey = schema_table_constraints.setdefault("ukey", set())
                ukey.add(row.column_name)

    def _extract_fkeys(self, fkey_constraint: dict) -> list[dict[str, str]]:
        """extract foreign keys from rows

        Args:
            uniques (dict): _description_
        """
        fkeys = []

        m = FOREIGN_KEY_RE.match(fkey_constraint["condef"])
        colstring = m.group("referred_columns")
        referred_columns = SQL_IDENTIFIER_RE.findall(colstring)
        referred_table = m.group("referred_table")
        referred_schema = m.group("referred_schema")
        colstring = m.group("columns")
        constrained_columns = SQL_IDENTIFIER_RE.findall(colstring)
        fkey_d = {
            "name": fkey_constraint["key"],
            "constrained_columns": constrained_columns,
            "referred_schema": referred_schema,
            "referred_table": referred_table,
            "referred_columns": referred_columns,
            "referred_database": fkey_constraint["database"],
        }
        fkeys.append(fkey_d)

        return fkeys
