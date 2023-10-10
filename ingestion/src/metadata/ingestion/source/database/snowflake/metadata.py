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
Snowflake source module
"""
import json
import traceback
from typing import Iterable, List, Optional, Tuple

import sqlparse
from requests.utils import quote
from snowflake.sqlalchemy.custom_types import VARIANT
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine.reflection import Inspector
from sqlparse.sql import Function, Identifier

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.data.table import (
    IntervalType,
    Table,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, SourceUrl
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.life_cycle_query_mixin import (
    LifeCycleQueryMixin,
)
from metadata.ingestion.source.database.snowflake.constants import (
    SNOWFLAKE_REGION_ID_MAP,
)
from metadata.ingestion.source.database.snowflake.models import (
    STORED_PROC_LANGUAGE_MAP,
    SnowflakeStoredProcedure,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_FETCH_ALL_TAGS,
    SNOWFLAKE_GET_CLUSTER_KEY,
    SNOWFLAKE_GET_CURRENT_ACCOUNT,
    SNOWFLAKE_GET_CURRENT_REGION,
    SNOWFLAKE_GET_DATABASE_COMMENTS,
    SNOWFLAKE_GET_FILTER_DATABASES,
    SNOWFLAKE_GET_SCHEMA_COMMENTS,
    SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES,
    SNOWFLAKE_GET_STORED_PROCEDURES,
    SNOWFLAKE_LIFE_CYCLE_QUERY,
    SNOWFLAKE_SESSION_TAG_QUERY,
)
from metadata.ingestion.source.database.snowflake.utils import (
    _current_database_schema,
    get_columns,
    get_filter_pattern_tuple,
    get_foreign_keys,
    get_pk_constraint,
    get_schema_columns,
    get_schema_names,
    get_schema_names_reflection,
    get_table_comment,
    get_table_names,
    get_table_names_reflection,
    get_unique_constraints,
    get_view_definition,
    get_view_names,
    normalize_names,
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
from metadata.utils.tag_utils import get_ometa_tag_and_classification
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["GEOMETRY"] = create_sqlalchemy_type("GEOMETRY")

logger = ingestion_logger()


SnowflakeDialect._json_deserializer = json.loads  # pylint: disable=protected-access
SnowflakeDialect.get_table_names = get_table_names
SnowflakeDialect.get_view_names = get_view_names
SnowflakeDialect.get_all_table_comments = get_all_table_comments
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect.get_table_comment = get_table_comment
SnowflakeDialect.get_view_definition = get_view_definition
SnowflakeDialect.get_unique_constraints = get_unique_constraints
SnowflakeDialect._get_schema_columns = (  # pylint: disable=protected-access
    get_schema_columns
)
SnowflakeDialect.get_schema_names = get_schema_names

Inspector.get_table_names = get_table_names_reflection
Inspector.get_schema_names = get_schema_names_reflection
SnowflakeDialect._current_database_schema = (  # pylint: disable=protected-access
    _current_database_schema
)
SnowflakeDialect.get_pk_constraint = get_pk_constraint
SnowflakeDialect.get_foreign_keys = get_foreign_keys
SnowflakeDialect.get_columns = get_columns


class SnowflakeSource(LifeCycleQueryMixin, StoredProcedureMixin, CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Snowflake Source
    """

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        self.partition_details = {}
        self.schema_desc_map = {}
        self.database_desc_map = {}

        self._account: Optional[str] = None
        self._region: Optional[str] = None

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata)

    @property
    def account(self) -> Optional[str]:
        """Query the account information"""
        if self._account is None:
            self._account = self._get_current_account()

        return self._account

    @property
    def region(self) -> Optional[str]:
        """
        Query the region information

        Region id can be a vanilla id like "AWS_US_WEST_2"
        and in case of multi region group it can be like "PUBLIC.AWS_US_WEST_2"
        in such cases this method will extract vanilla region id and return the
        region name from constant map SNOWFLAKE_REGION_ID_MAP

        for more info checkout this doc:
            https://docs.snowflake.com/en/sql-reference/functions/current_region
        """
        if self._region is None:
            raw_region = self._get_current_region()
            if raw_region:
                clean_region_id = raw_region.split(".")[-1]
                self._region = SNOWFLAKE_REGION_ID_MAP.get(clean_region_id.lower())

        return self._region

    def set_session_query_tag(self) -> None:
        """
        Method to set query tag for current session
        """
        if self.service_connection.queryTag:
            self.engine.execute(
                SNOWFLAKE_SESSION_TAG_QUERY.format(
                    query_tag=self.service_connection.queryTag
                )
            )

    def set_partition_details(self) -> None:
        self.partition_details.clear()
        results = self.engine.execute(SNOWFLAKE_GET_CLUSTER_KEY).all()
        for row in results:
            if row.CLUSTERING_KEY:
                self.partition_details[
                    f"{row.TABLE_SCHEMA}.{row.TABLE_NAME}"
                ] = row.CLUSTERING_KEY

    def set_schema_description_map(self) -> None:
        results = self.engine.execute(SNOWFLAKE_GET_SCHEMA_COMMENTS).all()
        for row in results:
            self.schema_desc_map[(row.DATABASE_NAME, row.SCHEMA_NAME)] = row.COMMENT

    def set_database_description_map(self) -> None:
        if not self.database_desc_map:
            results = self.engine.execute(SNOWFLAKE_GET_DATABASE_COMMENTS).all()
            for row in results:
                self.database_desc_map[row.DATABASE_NAME] = row.COMMENT

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get(
            (self.context.database.name.__root__, schema_name)
        )

    def get_database_description(self, database_name: str) -> Optional[str]:
        """
        Method to fetch the database description
        """
        return self.database_desc_map.get(database_name)

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.__root__.config.database
        if configured_db:
            self.set_inspector(configured_db)
            self.set_session_query_tag()
            self.set_partition_details()
            self.set_schema_description_map()
            self.set_database_description_map()
            yield configured_db
        else:
            if self.source_config.databaseFilterPattern:
                format_pattern = (
                    f"WHERE DATABASE_NAME LIKE ANY {get_filter_pattern_tuple(self.source_config.databaseFilterPattern.includes)}"  # pylint: disable=line-too-long
                    if self.source_config.databaseFilterPattern.includes
                    else f"WHERE DATABASE_NAME NOT LIKE ANY {get_filter_pattern_tuple(self.source_config.databaseFilterPattern.excludes)}"  # pylint: disable=line-too-long
                )

            filter_query = SNOWFLAKE_GET_FILTER_DATABASES.format(format_pattern)
            query = SNOWFLAKE_GET_FILTER_DATABASES.format("")
            results = self.connection.execute(
                filter_query
                if self.source_config.pushFilterDown
                and self.source_config.databaseFilterPattern
                else query
            )
            for res in results:
                row = list(res)
                new_database = row[1]
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
                self.set_session_query_tag()
                self.set_partition_details()
                self.set_schema_description_map()
                self.set_database_description_map()
                yield new_database
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
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

    def __get_identifier_from_function(self, function_token: Function) -> List:
        identifiers = []
        for token in function_token.get_parameters():
            if isinstance(token, Function):
                # get column names from nested functions
                identifiers.extend(self.__get_identifier_from_function(token))
            elif isinstance(token, Identifier):
                identifiers.append(token.get_real_name())
        return identifiers

    def parse_column_name_from_expr(self, cluster_key_expr: str) -> Optional[List[str]]:
        try:
            parser = sqlparse.parse(cluster_key_expr)
            if not parser:
                return []
            result = []
            tokens_list = parser[0].tokens
            for token in tokens_list:
                if isinstance(token, Function):
                    result.extend(self.__get_identifier_from_function(token))
                elif isinstance(token, Identifier):
                    result.append(token.get_real_name())
            return result
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to parse cluster key - {err}")
        return None

    def __fix_partition_column_case(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
        partition_columns: Optional[List[str]],
    ) -> List[str]:
        if partition_columns:
            columns = []
            table_columns = inspector.get_columns(
                table_name=table_name, schema=schema_name
            )
            for pcolumn in partition_columns:
                for tcolumn in table_columns:
                    if tcolumn["name"].lower() == pcolumn.lower():
                        columns.append(tcolumn["name"])
                        break
            return columns
        return []

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, TablePartition]:
        cluster_key = self.partition_details.get(f"{schema_name}.{table_name}")
        if cluster_key:
            partition_columns = self.parse_column_name_from_expr(cluster_key)
            partition_details = TablePartition(
                columns=self.__fix_partition_column_case(
                    table_name, schema_name, inspector, partition_columns
                ),
                intervalType=IntervalType.COLUMN_VALUE,
            )
            return True, partition_details
        return False, None

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        if self.source_config.includeTags:
            result = []
            try:
                result = self.connection.execute(
                    SNOWFLAKE_FETCH_ALL_TAGS.format(
                        database_name=self.context.database.name.__root__,
                        schema_name=schema_name,
                    )
                )

            except Exception as exc:
                try:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error fetching tags {exc}. Trying with quoted names"
                    )
                    result = self.connection.execute(
                        SNOWFLAKE_FETCH_ALL_TAGS.format(
                            database_name=f'"{self.context.database.name.__root__}"',
                            schema_name=f'"{self.context.database_schema.name.__root__}"',
                        )
                    )
                except Exception as inner_exc:
                    yield Either(
                        left=StackTraceError(
                            name="Tags and Classifications",
                            error=f"Failed to fetch tags due to [{inner_exc}]",
                            stack_trace=traceback.format_exc(),
                        )
                    )

            for res in result:
                row = list(res)
                fqn_elements = [name for name in row[2:] if name]
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn._build(  # pylint: disable=protected-access
                        self.context.database_service.name.__root__, *fqn_elements
                    ),
                    tags=[row[1]],
                    classification_name=row[0],
                    tag_description="SNOWFLAKE TAG VALUE",
                    classification_description="SNOWFLAKE TAG NAME",
                )

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """
        table_list = [
            TableNameAndType(name=table_name)
            for table_name in self.inspector.get_table_names(
                schema=schema_name,
                pushFilterDown=self.source_config.pushFilterDown,
                filter_include_table_name=self.source_config.tableFilterPattern.includes
                if self.source_config.tableFilterPattern
                and self.source_config.tableFilterPattern.includes
                else [],
                filter_exclude_table_name=self.source_config.tableFilterPattern.excludes
                if self.source_config.tableFilterPattern
                and self.source_config.tableFilterPattern.excludes
                else [],
            )
        ]

        table_list.extend(
            [
                TableNameAndType(name=table_name, type_=TableType.External)
                for table_name in self.inspector.get_table_names(
                    schema=schema_name,
                    external_tables=True,
                    pushFilterDown=self.source_config.pushFilterDown,
                    filter_include_table_name=self.source_config.tableFilterPattern.includes
                    if self.source_config.tableFilterPattern
                    and self.source_config.tableFilterPattern.includes
                    else [],
                    filter_exclude_table_name=self.source_config.tableFilterPattern.excludes
                    if self.source_config.tableFilterPattern
                    and self.source_config.tableFilterPattern.excludes
                    else [],
                )
            ]
        )

        if self.service_connection.includeTransientTables:
            table_list.extend(
                [
                    TableNameAndType(name=table_name, type_=TableType.Transient)
                    for table_name in self.inspector.get_table_names(
                        schema=schema_name,
                        include_transient_tables=True,
                        pushFilterDown=self.source_config.pushFilterDown,
                        filter_include_table_name=self.source_config.tableFilterPattern.includes
                        if self.source_config.tableFilterPattern
                        and self.source_config.tableFilterPattern.includes
                        else [],
                        filter_exclude_table_name=self.source_config.tableFilterPattern.excludes
                        if self.source_config.tableFilterPattern
                        and self.source_config.tableFilterPattern.excludes
                        else [],
                    )
                ]
            )

        return table_list

    def _get_current_region(self) -> Optional[str]:
        try:
            res = self.engine.execute(SNOWFLAKE_GET_CURRENT_REGION).one()
            if res:
                return res.REGION
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch current region due to: {exc}")
        return None

    def _get_current_account(self) -> Optional[str]:
        try:
            res = self.engine.execute(SNOWFLAKE_GET_CURRENT_ACCOUNT).one()
            if res:
                return res.ACCOUNT
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch current account due to: {exc}")
        return None

    def _get_source_url_root(
        self, database_name: Optional[str] = None, schema_name: Optional[str] = None
    ) -> str:
        url = (
            f"https://app.snowflake.com/{self.region.lower()}"
            f"/{self.account.lower()}/#/data/databases/{database_name}"
        )
        if schema_name:
            url = f"{url}/schemas/{schema_name}"

        return url

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for snowflake
        """
        try:
            if self.account and self.region:
                tab_type = "view" if table_type == TableType.View else "table"
                url = self._get_source_url_root(
                    database_name=database_name, schema_name=schema_name
                )
                if table_name:
                    url = f"{url}/{tab_type}/{table_name}"
                return url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def yield_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the table
        """
        table = self.context.table
        try:
            life_cycle_data = self.life_cycle_query_dict(
                query=SNOWFLAKE_LIFE_CYCLE_QUERY.format(
                    database_name=table.database.name,
                    schema_name=table.databaseSchema.name,
                )
            ).get(table.name.__root__)
            if life_cycle_data:
                life_cycle = LifeCycle(
                    created=AccessDetails(
                        timestamp=convert_timestamp_to_milliseconds(
                            life_cycle_data.created_at.timestamp()
                        )
                    )
                )
                yield Either(
                    right=OMetaLifeCycleData(entity=table, life_cycle=life_cycle)
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table.name.__root__,
                    error=f"Unable to get the table life cycle data for table {table.name.__root__}: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )

    def get_stored_procedures(self) -> Iterable[SnowflakeStoredProcedure]:
        """List Snowflake stored procedures"""
        if self.source_config.includeStoredProcedures:
            results = self.engine.execute(
                SNOWFLAKE_GET_STORED_PROCEDURES.format(
                    database_name=self.context.database.name.__root__,
                    schema_name=self.context.database_schema.name.__root__,
                )
            ).all()
            for row in results:
                stored_procedure = SnowflakeStoredProcedure.parse_obj(dict(row))
                yield stored_procedure

    def yield_stored_procedure(
        self, stored_procedure: SnowflakeStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            yield Either(
                right=CreateStoredProcedureRequest(
                    name=EntityName(__root__=stored_procedure.name),
                    description=stored_procedure.comment,
                    storedProcedureCode=StoredProcedureCode(
                        language=STORED_PROC_LANGUAGE_MAP.get(
                            stored_procedure.language
                        ),
                        code=stored_procedure.definition,
                    ),
                    databaseSchema=self.context.database_schema.fullyQualifiedName,
                    sourceUrl=SourceUrl(
                        __root__=self._get_source_url_root(
                            database_name=self.context.database.name.__root__,
                            schema_name=self.context.database_schema.name.__root__,
                        )
                        + f"/procedure/{stored_procedure.name}"
                        + f"{quote(stored_procedure.signature) if stored_procedure.signature else ''}"
                    ),
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
            query = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES.format(
                start_date=start,
                warehouse=self.service_connection.warehouse,
                schema_name=self.context.database_schema.name.__root__,
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
