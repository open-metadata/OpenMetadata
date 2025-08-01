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
Snowflake source module
"""
import json
import traceback
from datetime import datetime
from typing import Iterable, List, Optional, Tuple

import sqlalchemy.types as sqltypes
import sqlparse
from snowflake.sqlalchemy.custom_types import VARIANT, StructuredType
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine.reflection import Inspector
from sqlparse.sql import Function, Identifier, Token

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedureCode,
    StoredProcedureType,
)
from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    Table,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.delete import delete_entity_by_name
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
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
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.snowflake.constants import (
    DEFAULT_STREAM_COLUMNS,
)
from metadata.ingestion.source.database.snowflake.models import (
    STORED_PROC_LANGUAGE_MAP,
    SnowflakeStoredProcedure,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_DESC_FUNCTION,
    SNOWFLAKE_DESC_STORED_PROCEDURE,
    SNOWFLAKE_FETCH_ALL_TAGS,
    SNOWFLAKE_GET_CLUSTER_KEY,
    SNOWFLAKE_GET_CURRENT_ACCOUNT,
    SNOWFLAKE_GET_DATABASE_COMMENTS,
    SNOWFLAKE_GET_DATABASES,
    SNOWFLAKE_GET_EXTERNAL_LOCATIONS,
    SNOWFLAKE_GET_FUNCTIONS,
    SNOWFLAKE_GET_ORGANIZATION_NAME,
    SNOWFLAKE_GET_SCHEMA_COMMENTS,
    SNOWFLAKE_GET_STORED_PROCEDURES,
    SNOWFLAKE_GET_STREAM,
    SNOWFLAKE_LIFE_CYCLE_QUERY,
    SNOWFLAKE_SESSION_TAG_QUERY,
)
from metadata.ingestion.source.database.snowflake.utils import (
    _current_database_schema,
    get_columns,
    get_foreign_keys,
    get_pk_constraint,
    get_schema_columns,
    get_schema_foreign_keys,
    get_stream_definition,
    get_stream_names,
    get_stream_names_reflection,
    get_table_comment,
    get_table_ddl,
    get_table_names,
    get_table_names_reflection,
    get_unique_constraints,
    get_view_definition,
    get_view_names,
    get_view_names_reflection,
    normalize_names,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_all_view_definitions,
)
from metadata.utils.tag_utils import get_ometa_tag_and_classification


class MAP(StructuredType):
    __visit_name__ = "MAP"

    # Default to VARCHAR for key and value types if not provided
    # This is a workaround to avoid the error:
    # sqlalchemy.exc.ArgumentError: Map type requires a key_type and value_type
    # when creating a table with a MAP column.
    def __init__(
        self,
        key_type: sqltypes.TypeEngine = sqltypes.VARCHAR,
        value_type: sqltypes.TypeEngine = sqltypes.VARCHAR,
        not_null: bool = False,
    ):
        self.key_type = key_type
        self.value_type = value_type
        self.not_null = not_null
        super().__init__()


ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["GEOMETRY"] = create_sqlalchemy_type("GEOMETRY")
ischema_names["VECTOR"] = create_sqlalchemy_type("VECTOR")
ischema_names["MAP"] = MAP

logger = ingestion_logger()

# pylint: disable=protected-access
SnowflakeDialect._json_deserializer = json.loads
SnowflakeDialect.get_table_names = get_table_names
SnowflakeDialect.get_view_names = get_view_names
SnowflakeDialect.get_stream_names = get_stream_names
SnowflakeDialect.get_all_table_comments = get_all_table_comments
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect.get_table_comment = get_table_comment
SnowflakeDialect.get_all_view_definitions = get_all_view_definitions
SnowflakeDialect.get_view_definition = get_view_definition
SnowflakeDialect.get_unique_constraints = get_unique_constraints
SnowflakeDialect._get_schema_columns = get_schema_columns
Inspector.get_table_names = get_table_names_reflection
Inspector.get_view_names = get_view_names_reflection
Inspector.get_stream_names = get_stream_names_reflection
SnowflakeDialect._current_database_schema = _current_database_schema
SnowflakeDialect.get_pk_constraint = get_pk_constraint
SnowflakeDialect.get_foreign_keys = get_foreign_keys
SnowflakeDialect.get_columns = get_columns
Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl
Inspector.get_stream_definition = get_stream_definition
SnowflakeDialect._get_schema_foreign_keys = get_schema_foreign_keys


# pylint: disable=too-many-public-methods
class SnowflakeSource(
    ExternalTableLineageMixin,
    CommonDbSourceService,
    MultiDBSource,
):
    """
    Implements the necessary methods to extract
    Database metadata from Snowflake Source
    """

    service_connection: SnowflakeConnection

    def __init__(
        self,
        config,
        metadata,
        pipeline_name,
        incremental_configuration: IncrementalConfig,
    ):
        super().__init__(config, metadata)
        self.partition_details = {}
        self.schema_desc_map = {}
        self.database_desc_map = {}
        self.external_location_map = {}

        self._account: Optional[str] = None
        self._org_name: Optional[str] = None
        self.life_cycle_query = SNOWFLAKE_LIFE_CYCLE_QUERY
        self.context.get_global().deleted_tables = []
        self.pipeline_name = pipeline_name
        self.incremental = incremental_configuration

        if self.incremental.enabled:
            date = datetime.fromtimestamp(self.incremental.start_timestamp / 1000)
            logger.info(
                "Starting Incremental Metadata Extraction.\n\t Considering Table changes from %s",
                date,
            )

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.root.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )

        incremental_config = IncrementalConfig.create(
            config.sourceConfig.config.incremental, pipeline_name, metadata
        )
        return cls(config, metadata, pipeline_name, incremental_config)

    @property
    def account(self) -> Optional[str]:
        """
        Query the account information
            ref https://docs.snowflake.com/en/sql-reference/functions/current_account_name
        """
        if self._account is None:
            self._account = self._get_current_account()

        return self._account

    @property
    def org_name(self) -> Optional[str]:
        """
        Query the Organization information.
            ref https://docs.snowflake.com/en/sql-reference/functions/current_organization_name
        """
        if self._org_name is None:
            self._org_name = self._get_org_name()

        return self._org_name

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
        self.schema_desc_map.clear()
        results = self.engine.execute(SNOWFLAKE_GET_SCHEMA_COMMENTS).all()
        for row in results:
            self.schema_desc_map[(row.DATABASE_NAME, row.SCHEMA_NAME)] = row.COMMENT

    def set_database_description_map(self) -> None:
        self.database_desc_map.clear()
        if not self.database_desc_map:
            results = self.engine.execute(SNOWFLAKE_GET_DATABASE_COMMENTS).all()
            for row in results:
                self.database_desc_map[row.DATABASE_NAME] = row.COMMENT

    def set_external_location_map(self, database_name: str) -> None:
        self.external_location_map.clear()
        results = self.engine.execute(
            SNOWFLAKE_GET_EXTERNAL_LOCATIONS.format(database_name=database_name)
        ).all()
        self.external_location_map = {
            (row.database_name, row.schema_name, row.name): row.location
            for row in results
        }

    def get_schema_description(self, schema_name: str) -> Optional[str]:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get((self.context.get().database, schema_name))

    def get_database_description(self, database_name: str) -> Optional[str]:
        """
        Method to fetch the database description
        """
        return self.database_desc_map.get(database_name)

    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        results = self.connection.execute(SNOWFLAKE_GET_DATABASES)
        for res in results:
            row = list(res)
            yield row[1]

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.root.config.database
        if configured_db:
            self.set_inspector(configured_db)
            self.set_session_query_tag()
            self.set_partition_details()
            self.set_schema_description_map()
            self.set_database_description_map()
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
                    self.set_session_query_tag()
                    self.set_partition_details()
                    self.set_schema_description_map()
                    self.set_database_description_map()
                    self.set_external_location_map(new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def __clean_append(self, token: Token, result_list: List) -> None:
        """
        Appends the real name of the given token to the result list if it exists.

        Args:
            token (Token): The token whose real name is to be appended.
            result_list (List): The list to which the real name will be appended.

        Returns:
            None
        """
        name = token.get_real_name()
        if name is not None:
            result_list.append(name)

    def __get_identifier_from_function(self, function_token: Function) -> List:
        identifiers = []
        for token in function_token.get_parameters():
            if isinstance(token, Function):
                # get column names from nested functions
                identifiers.extend(self.__get_identifier_from_function(token))
            elif isinstance(token, Identifier):
                self.__clean_append(token, identifiers)
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
                    self.__clean_append(token, result)
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
    ) -> Tuple[bool, Optional[TablePartition]]:
        cluster_key = self.partition_details.get(f"{schema_name}.{table_name}")
        if cluster_key:
            partition_columns = self.parse_column_name_from_expr(cluster_key)
            partition_details = TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=column,
                        intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                        interval=None,
                    )
                    for column in self.__fix_partition_column_case(
                        table_name, schema_name, inspector, partition_columns
                    )
                ]
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
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                        account_usage=self.service_connection.accountUsageSchema,
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
                            database_name=f'"{self.context.get().database}"',
                            schema_name=f'"{self.context.get().database_schema}"',
                            account_usage=self.service_connection.accountUsageSchema,
                        )
                    )
                except Exception as inner_exc:
                    yield Either(
                        left=StackTraceError(
                            name="Tags and Classifications",
                            error=f"Failed to fetch tags due to [{inner_exc}]",
                            stackTrace=traceback.format_exc(),
                        )
                    )

            for res in result:
                row = list(res)
                fqn_elements = [name for name in row[2:] if name]
                yield from get_ometa_tag_and_classification(
                    tag_fqn=FullyQualifiedEntityName(
                        fqn._build(  # pylint: disable=protected-access
                            self.context.get().database_service, *fqn_elements
                        )
                    ),
                    tags=[row[1]],
                    classification_name=row[0],
                    tag_description="SNOWFLAKE TAG VALUE",
                    classification_description="SNOWFLAKE TAG NAME",
                    metadata=self.metadata,
                    system_tags=True,
                )

    def _get_table_names_and_types(
        self, schema_name: str, table_type: TableType = TableType.Regular
    ) -> List[TableNameAndType]:
        table_type_to_params_map = {
            TableType.Regular: {},
            TableType.External: {"external_tables": True},
            TableType.Transient: {"include_transient_tables": True},
            TableType.Dynamic: {"dynamic_tables": True},
        }

        snowflake_tables = self.inspector.get_table_names(
            schema=schema_name,
            incremental=self.incremental,
            account_usage=self.service_connection.accountUsageSchema,
            **table_type_to_params_map[table_type],
        )

        self.context.get_global().deleted_tables.extend(
            [
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=table.name,
                )
                for table in snowflake_tables.get_deleted()
            ]
        )

        return [
            TableNameAndType(name=table.name, type_=table_type)
            for table in snowflake_tables.get_not_deleted()
        ]

    def _get_stream_names_and_types(self, schema_name: str) -> List[TableNameAndType]:
        table_type = TableType.Stream

        snowflake_streams = self.inspector.get_stream_names(
            schema=schema_name,
            incremental=self.incremental,
        )

        self.context.get_global().deleted_tables.extend(
            [
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=stream.name,
                )
                for stream in snowflake_streams.get_deleted()
            ]
        )

        return [
            TableNameAndType(name=stream.name, type_=table_type)
            for stream in snowflake_streams.get_not_deleted()
        ]

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
        table_list = self._get_table_names_and_types(schema_name)

        table_list.extend(
            self._get_table_names_and_types(schema_name, table_type=TableType.External)
        )

        table_list.extend(
            self._get_table_names_and_types(schema_name, table_type=TableType.Dynamic)
        )

        if self.service_connection.includeTransientTables:
            table_list.extend(
                self._get_table_names_and_types(
                    schema_name, table_type=TableType.Transient
                )
            )

        if self.service_connection.includeStreams:
            table_list.extend(self._get_stream_names_and_types(schema_name))

        return table_list

    def _get_org_name(self) -> Optional[str]:
        try:
            res = self.engine.execute(SNOWFLAKE_GET_ORGANIZATION_NAME).one()
            if res:
                return res.NAME
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch Organization name due to: {exc}")
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
            f"https://app.snowflake.com/{self.org_name.lower()}"
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
            if self.account and self.org_name:
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

    def _get_view_names_and_types(
        self, schema_name: str, materialized_views: bool = False
    ) -> List[TableNameAndType]:
        table_type = (
            TableType.MaterializedView if materialized_views else TableType.View
        )

        snowflake_views = self.inspector.get_view_names(
            schema=schema_name,
            incremental=self.incremental,
            account_usage=self.service_connection.accountUsageSchema,
            materialized_views=materialized_views,
        )

        self.context.get_global().deleted_tables.extend(
            [
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=view.name,
                )
                for view in snowflake_views.get_deleted()
            ]
        )

        return [
            TableNameAndType(name=view.name, type_=table_type)
            for view in snowflake_views.get_not_deleted()
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
        views = self._get_view_names_and_types(schema_name)
        views.extend(
            self._get_view_names_and_types(schema_name, materialized_views=True)
        )

        return views

    def _get_stored_procedures_internal(
        self, query: str
    ) -> Iterable[SnowflakeStoredProcedure]:
        try:
            results = self.engine.execute(
                query.format(
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                    account_usage=self.service_connection.accountUsageSchema,
                )
            ).all()
            for row in results:
                stored_procedure = SnowflakeStoredProcedure.model_validate(dict(row))
                if stored_procedure.definition is None:
                    logger.debug(
                        f"Missing ownership permissions on procedure {stored_procedure.name}."
                        " Trying to fetch description via DESCRIBE."
                    )
                    stored_procedure.definition = self.describe_procedure_definition(
                        stored_procedure
                    )
                yield stored_procedure
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching stored procedures: {exc}")

    def get_stored_procedures(self) -> Iterable[SnowflakeStoredProcedure]:
        """List Snowflake stored procedures"""
        if self.source_config.includeStoredProcedures:
            yield from self._get_stored_procedures_internal(
                SNOWFLAKE_GET_STORED_PROCEDURES
            )
            yield from self._get_stored_procedures_internal(SNOWFLAKE_GET_FUNCTIONS)

    def describe_procedure_definition(
        self, stored_procedure: SnowflakeStoredProcedure
    ) -> str:
        """
        We can only get the SP definition via the INFORMATION_SCHEMA.PROCEDURES if the
        user has OWNERSHIP grants, which will not always be the case.

        Then, if the procedure is created with `EXECUTE AS CALLER`, we can still try to
        get the definition with a DESCRIBE.
        """
        try:
            if (
                stored_procedure.procedure_type
                == StoredProcedureType.StoredProcedure.value
            ):
                query = SNOWFLAKE_DESC_STORED_PROCEDURE
            else:
                query = SNOWFLAKE_DESC_FUNCTION
            res = self.engine.execute(
                query.format(
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                    procedure_name=stored_procedure.name,
                    procedure_signature=stored_procedure.unquote_signature(),
                )
            )
            return dict(res.all()).get("body", "")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching stored procedure definition: {exc}")
            return ""

    def yield_stored_procedure(
        self, stored_procedure: SnowflakeStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                description=stored_procedure.comment,
                storedProcedureCode=StoredProcedureCode(
                    language=STORED_PROC_LANGUAGE_MAP.get(stored_procedure.language),
                    code=stored_procedure.definition,
                ),
                storedProcedureType=stored_procedure.procedure_type
                or StoredProcedureType.StoredProcedure.value,
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
                sourceUrl=SourceUrl(
                    self._get_source_url_root(
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                    + f"/procedure/{stored_procedure.name}"
                    + f"{stored_procedure.signature if stored_procedure.signature else ''}"
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

    def _get_columns_internal(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ):
        """
        Get columns of table/view/stream
        """
        if table_type == TableType.Stream:
            cursor = self.connection.execute(
                SNOWFLAKE_GET_STREAM.format(stream_name=table_name, schema=schema_name)
            )
            try:
                result = cursor.fetchone()
                if result:
                    table_name = result[6].split(".")[-1]
            except Exception:
                pass

        columns = inspector.get_columns(
            table_name, schema_name, table_type=table_type, db_name=db_name
        )

        if table_type == TableType.Stream:
            columns = [*columns, *DEFAULT_STREAM_COLUMNS]

        return columns

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Optional[str]:
        """
        Get the DDL statement, View Definition or Stream Definition for a table

        To fetch the view definition, we have followed an optimised approach
        i.e. fetching view definition of all the views in schema storing it
        in cache and using the same cache to fetch the view definition.

        To fetch defintion for other types of tables, we have used the
        get_ddl method, since this method only accepts string literal as arguments
        it is not possible to do something like this:

        select table_name, schema, get_ddl('table', table_name) from information_schema.tables
        so we have to fetch the ddl for each table individually.

        Alternavies are executing an stroed procedure to automate this but
        it requires additional permissions like execute which users may not be comfortable doing.
        Or reconstruct the ddl from column types, which we can explore in the future.
        """
        try:
            schema_definition = None
            if table_type in (TableType.View, TableType.MaterializedView):
                schema_definition = inspector.get_view_definition(
                    table_name, schema_name
                )
            elif table_type == TableType.Stream:
                schema_definition = inspector.get_stream_definition(
                    self.connection, table_name, schema_name
                )
            elif self.source_config.includeDDL or table_type == TableType.Dynamic:
                schema_definition = inspector.get_table_ddl(
                    self.connection, table_name, schema_name
                )
            schema_definition = (
                str(schema_definition).strip()
                if schema_definition is not None
                else None
            )
            return schema_definition

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch schema definition for {table_name}: {exc}")

        return None

    def get_life_cycle_query(self):
        """
        Get the life cycle query
        """
        return self.life_cycle_query.format(
            database_name=self.context.get().database,
            schema_name=self.context.get().database_schema,
            account_usage=self.service_connection.accountUsageSchema,
        )

    def get_owner_ref(self, table_name: str) -> Optional[EntityReferenceList]:
        """
        Method to process the table owners

        Snowflake uses a role-based ownership model, not a user-based one.
        This means that ownership of database objects, such as tables, is assigned
        to roles rather than individual users.

        As OpenMetadata currently does not support role-based ownership assignment,
        we are unable to retrieve or associate a meaningful table owner using this method.
        Therefore, this function will return `None` or a placeholder, and ownership
        metadata will not be populated in the OpenMetadata ingestion process.
        """
        logger.debug(
            f"Processing ownership is not supported for {self.service_connection.type.name}"
        )
