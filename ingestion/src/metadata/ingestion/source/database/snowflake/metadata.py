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
import threading
import traceback
from collections.abc import Iterable
from datetime import datetime
from typing import cast

import sqlalchemy.types as sqltypes
import sqlparse
from sqlalchemy import exc as sa_exc
from sqlalchemy import text
from sqlalchemy.engine.reflection import Inspector
from sqlparse.sql import Function, Identifier, Token

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
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
    Column,
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
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import delete_entity_by_name
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.progress.modes import TotalsDeclarer
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
    PROCEDURE_TYPE_URL_MAP,
    SNOWFLAKE_CLASSIFICATION_DESCRIPTION,
    SNOWFLAKE_TAG_DESCRIPTION,
    TABLE_TYPE_URL_MAP,
)
from metadata.ingestion.source.database.snowflake.models import (
    STORED_PROC_LANGUAGE_MAP,
    SnowflakeStoredProcedure,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_DESC_FUNCTION,
    SNOWFLAKE_DESC_STORED_PROCEDURE,
    SNOWFLAKE_FETCH_DATABASE_TAGS,
    SNOWFLAKE_FETCH_SCHEMA_TAGS,
    SNOWFLAKE_FETCH_TABLE_TAGS,
    SNOWFLAKE_GET_CLUSTER_KEY,
    SNOWFLAKE_GET_CURRENT_ACCOUNT,
    SNOWFLAKE_GET_DATABASE_COMMENTS,
    SNOWFLAKE_GET_DATABASES,
    SNOWFLAKE_GET_EXTERNAL_LOCATIONS,
    SNOWFLAKE_GET_ORGANIZATION_NAME,
    SNOWFLAKE_GET_SCHEMA_COMMENTS,
    SNOWFLAKE_GET_SCHEMATA,
    SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW,
    SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA,
    SNOWFLAKE_GET_STORED_PROCEDURES_AND_FUNCTIONS,
    SNOWFLAKE_GET_STREAM,
    SNOWFLAKE_LIFE_CYCLE_QUERY,
)
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    build_metric_request,
)
from metadata.ingestion.source.database.snowflake.utils import (
    INFO_SCHEMA_TOO_MUCH_DATA,
    SEMANTIC_CATALOG_CACHE_SIZE,
    SEMANTIC_CATALOG_VIEWS,
    SEMANTIC_DIMENSIONS,
    SEMANTIC_FACTS,
    SEMANTIC_METRICS,
    SEMANTIC_VIEW_COLUMN_KINDS,
    SemanticCatalog,
    _current_database_schema,
    _get_schema_unique_constraints,
    build_semantic_view_column,
    get_columns,
    get_foreign_keys,
    get_pk_constraint,
    get_schema_columns,
    get_schema_foreign_keys,
    get_semantic_view_definition,
    get_semantic_view_names,
    get_semantic_view_names_reflection,
    get_stage_names,
    get_stage_names_reflection,
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
    merge_semantic_view_column,
    normalize_names,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_all_view_definitions,
)
from snowflake.sqlalchemy.custom_types import VARIANT, StructuredType
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names


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
SnowflakeDialect.get_stage_names = get_stage_names
SnowflakeDialect.get_semantic_view_names = get_semantic_view_names  # pyright: ignore[reportAttributeAccessIssue]
SnowflakeDialect.get_all_table_comments = get_all_table_comments
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect.get_table_comment = get_table_comment
SnowflakeDialect.get_all_view_definitions = get_all_view_definitions
SnowflakeDialect.get_view_definition = get_view_definition
SnowflakeDialect.get_unique_constraints = get_unique_constraints
SnowflakeDialect._get_schema_unique_constraints = _get_schema_unique_constraints
SnowflakeDialect._get_schema_columns = get_schema_columns
Inspector.get_table_names = get_table_names_reflection
Inspector.get_view_names = get_view_names_reflection
Inspector.get_stream_names = get_stream_names_reflection
Inspector.get_stage_names = get_stage_names_reflection
Inspector.get_semantic_view_names = get_semantic_view_names_reflection  # pyright: ignore[reportAttributeAccessIssue]
SnowflakeDialect._current_database_schema = _current_database_schema
SnowflakeDialect.get_pk_constraint = get_pk_constraint
SnowflakeDialect.get_foreign_keys = get_foreign_keys
SnowflakeDialect.get_columns = get_columns
Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl
Inspector.get_stream_definition = get_stream_definition
Inspector.get_semantic_view_definition = get_semantic_view_definition  # pyright: ignore[reportAttributeAccessIssue]
SnowflakeDialect._get_schema_foreign_keys = get_schema_foreign_keys


def _show_column(row, name: str):
    """Read a column from a Snowflake ``SHOW`` result row by name,
    case-insensitively (SHOW exposes lowercase column names)."""
    mapping = getattr(row, "_mapping", None)
    if mapping is not None:
        lowered = {str(key).lower(): value for key, value in mapping.items()}
        result = lowered.get(name.lower())
    else:
        result = getattr(row, name, None)
    return result


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
        self.schema_tags_map = {}
        self.database_tags_map = {}
        self._semantic_catalog_local = threading.local()

        self._account: str | None = None
        self._org_name: str | None = None
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
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.root.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(f"Expected SnowflakeConnection, but got {connection}")

        incremental_config = IncrementalConfig.create(config.sourceConfig.config.incremental, pipeline_name, metadata)  # pyright: ignore[reportAttributeAccessIssue]
        return cls(config, metadata, pipeline_name, incremental_config)

    @property
    def account(self) -> str | None:
        """
        Query the account information
            ref https://docs.snowflake.com/en/sql-reference/functions/current_account_name
        """
        if self._account is None:
            self._account = self._get_current_account()

        return self._account

    @property
    def org_name(self) -> str | None:
        """
        Query the Organization information.
            ref https://docs.snowflake.com/en/sql-reference/functions/current_organization_name
        """
        if self._org_name is None:
            self._org_name = self._get_org_name()

        return self._org_name

    def set_partition_details(self) -> None:
        self.partition_details.clear()
        with self.engine.connect() as conn:
            for row in conn.execute(text(SNOWFLAKE_GET_CLUSTER_KEY)):
                if row.CLUSTERING_KEY:
                    self.partition_details[f"{row.TABLE_SCHEMA}.{row.TABLE_NAME}"] = row.CLUSTERING_KEY

    def set_schema_description_map(self) -> None:
        self.schema_desc_map.clear()
        with self.engine.connect() as conn:
            for row in conn.execute(text(SNOWFLAKE_GET_SCHEMA_COMMENTS)):
                self.schema_desc_map[(row.DATABASE_NAME, row.SCHEMA_NAME)] = row.COMMENT

    def set_database_description_map(self) -> None:
        self.database_desc_map.clear()
        if not self.database_desc_map:
            with self.engine.connect() as conn:
                for row in conn.execute(text(SNOWFLAKE_GET_DATABASE_COMMENTS)):
                    self.database_desc_map[row.DATABASE_NAME] = row.COMMENT

    def set_external_location_map(self, database_name: str) -> None:
        self.external_location_map.clear()
        with self.engine.connect() as conn:
            self.external_location_map = {
                (row.database_name, row.schema_name, row.name): row.location
                for row in conn.execute(text(SNOWFLAKE_GET_EXTERNAL_LOCATIONS.format(database_name=database_name)))
            }

    def set_schema_tags_map(self, database_name: str) -> None:
        """Fetch and store all schema-level tags for the current database"""
        self.schema_tags_map.clear()
        if not self.source_config.includeTags:
            return

        try:
            with self.engine.connect() as conn:
                for row in conn.execute(
                    text(
                        SNOWFLAKE_FETCH_SCHEMA_TAGS.format(
                            database_name=database_name,
                            account_usage=self.service_connection.accountUsageSchema,
                        )
                    )
                ):
                    schema_name = row.SCHEMA_NAME
                    if not row.TAG_VALUE:
                        logger.warning(
                            f"Skipping tag '{row.TAG_NAME}' for schema '{schema_name}' - "
                            "TAG_VALUE is empty. Snowflake tags require a value to be ingested."
                        )
                        continue
                    if schema_name not in self.schema_tags_map:
                        self.schema_tags_map[schema_name] = []
                    self.schema_tags_map[schema_name].append({"tag_name": row.TAG_NAME, "tag_value": row.TAG_VALUE})

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch schema tags: {exc}")

    def set_database_tags_map(self, database_name: str) -> None:
        """Fetch and store database-level tags for the current database"""
        self.database_tags_map.clear()
        if not self.source_config.includeTags:
            return

        try:
            with self.engine.connect() as conn:
                for row in conn.execute(
                    text(
                        SNOWFLAKE_FETCH_DATABASE_TAGS.format(
                            database_name=database_name,
                            account_usage=self.service_connection.accountUsageSchema,
                        )
                    )
                ):
                    db_name = row.DATABASE_NAME
                    if db_name not in self.database_tags_map:
                        self.database_tags_map[db_name] = []
                    self.database_tags_map[db_name].append({"tag_name": row.TAG_NAME, "tag_value": row.TAG_VALUE})

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch database tags: {exc}")

    def get_schema_description(self, schema_name: str) -> str | None:
        """
        Method to fetch the schema description
        """
        return self.schema_desc_map.get((self.context.get().database, schema_name))

    def get_database_description(self, database_name: str) -> str | None:
        """
        Method to fetch the database description
        """
        return self.database_desc_map.get(database_name)

    def get_configured_database(self) -> str | None:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        results = self.connection.execute(text(SNOWFLAKE_GET_DATABASES)).fetchall()
        database_names = [list(res)[1] for res in results]
        logger.info(
            "SHOW DATABASES returned %d database(s) visible to the ingestion role",
            len(database_names),
        )
        logger.debug("Databases visible to the ingestion role: %s", database_names)
        yield from database_names

    def _compute_filtered_database_names(self) -> list[str]:
        """Database names that pass the filter pattern. Pure enumeration +
        filtering with no inspector/session setup, so the same list feeds both
        the progress denominator and the lazy, stateful producer."""
        configured_db = self.config.serviceConnection.root.config.database  # pyright: ignore[reportAttributeAccessIssue]
        if configured_db:
            return [configured_db]
        names: list[str] = []
        for new_database in self.get_database_names_raw():
            database_fqn = fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=new_database,
            )
            filter_name: str = database_fqn if self.source_config.useFqnForFiltering and database_fqn else new_database
            if filter_by_database(self.source_config.databaseFilterPattern, filter_name):
                logger.info(
                    "Filtering out database '%s': did not pass databaseFilterPattern "
                    "(matched against '%s', useFqnForFiltering=%s)",
                    new_database,
                    filter_name,
                    self.source_config.useFqnForFiltering,
                )
                self.status.filter(database_fqn, "Database Filtered Out")  # pyright: ignore[reportArgumentType]
                continue
            names.append(new_database)
        return names

    def _filtered_database_names(self) -> list[str]:
        """Filtered database names, computed once per run (the filter emits
        status side effects, so it must not run twice)."""
        cached = self.__dict__.get("_filtered_database_names_cache")
        if cached is None:
            cached = self.__dict__["_filtered_database_names_cache"] = (  # pyright: ignore[reportIndexIssue]
                self._compute_filtered_database_names()
            )
        return cached

    def _schema_names_by_database(self) -> "dict[str, list[str]] | None":
        """``{database: [schema_names]}`` for every filtered database, from a
        single account-wide ``SHOW SCHEMAS`` — one round-trip, no per-database
        reconnect. Returns ``None`` when the account-level SHOW is unavailable
        (e.g. role privileges) so the caller can fall back to reconcile-only."""
        by_database: dict[str, list[str]] = {db: [] for db in self._filtered_database_names()}
        try:
            rows = self.connection.execute(text(SNOWFLAKE_GET_SCHEMATA)).fetchall()
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(
                "SHOW SCHEMAS IN ACCOUNT failed (%s); progress schema total will reconcile during the walk.",
                exc,
            )
            return None
        for row in rows:
            database_name = _show_column(row, "database_name")
            schema_name = _show_column(row, "name")
            if database_name in by_database and schema_name is not None:
                by_database[database_name].append(str(schema_name))
        return by_database

    def declare_progress_totals(self, totals: TotalsDeclarer) -> None:
        """Seed the run-level ``Database`` and ``DatabaseSchema`` global counters
        upfront. ``Database`` is the filtered DB count; ``DatabaseSchema`` is the
        post-filter schema count per database from the account-wide SHOW. When
        that SHOW is unavailable, the schema counter is marked reconcilable so the
        walk fills its total instead."""
        database_names = self._filtered_database_names()
        totals.set_total(Database.__name__, len(database_names))
        schemas_by_database = self._schema_names_by_database()
        if schemas_by_database is None:
            totals.mark_reconcilable(DatabaseSchema.__name__)
        else:
            for database_name in database_names:
                kept = [
                    schema_name
                    for schema_name in schemas_by_database.get(database_name, [])
                    if not self._is_schema_filtered(database_name, schema_name)
                ]
                totals.seed_scope_total(DatabaseSchema.__name__, database_name, len(kept))

    def get_database_names(self) -> Iterable[str]:
        for database_name in self._filtered_database_names():
            try:
                self.set_inspector(database_name=database_name)
                self.set_partition_details()
                self.set_schema_description_map()
                self.set_database_description_map()
                self.set_external_location_map(database_name)
                self.set_schema_tags_map(database_name)
                self.set_database_tags_map(database_name)
                yield database_name
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error trying to connect to database {database_name}: {exc}")

    def __clean_append(self, token: Token, result_list: list) -> None:
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

    def __get_identifier_from_function(self, function_token: Function) -> list:
        identifiers = []
        for token in function_token.get_parameters():
            if isinstance(token, Function):
                # get column names from nested functions
                identifiers.extend(self.__get_identifier_from_function(token))
            elif isinstance(token, Identifier):
                self.__clean_append(token, identifiers)
        return identifiers

    def parse_column_name_from_expr(self, cluster_key_expr: str) -> list[str] | None:
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
            return result  # noqa: TRY300
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to parse cluster key - {err}")
        return None

    def __fix_partition_column_case(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
        partition_columns: list[str] | None,
    ) -> list[str]:
        if partition_columns:
            columns = []
            table_columns = inspector.get_columns(table_name=table_name, schema=schema_name)
            for pcolumn in partition_columns:
                for tcolumn in table_columns:
                    if tcolumn["name"].lower() == pcolumn.lower():
                        columns.append(tcolumn["name"])
                        break
            return columns
        return []

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> tuple[bool, TablePartition | None]:
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

    def yield_tag(self, schema_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Yield tags for tables/columns and schemas.
        """
        if self.source_config.includeTags:
            result = []
            try:
                result = self.connection.execute(
                    text(
                        SNOWFLAKE_FETCH_TABLE_TAGS.format(
                            database_name=self.context.get().database,
                            schema_name=schema_name,
                            account_usage=self.service_connection.accountUsageSchema,
                        )
                    )
                )

            except Exception as exc:
                try:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Error fetching tags {exc}. Trying with quoted names")
                    result = self.connection.execute(
                        text(
                            SNOWFLAKE_FETCH_TABLE_TAGS.format(
                                database_name=f'"{self.context.get().database}"',
                                schema_name=f'"{self.context.get().database_schema}"',
                                account_usage=self.service_connection.accountUsageSchema,
                            )
                        )
                    )
                except Exception as inner_exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Failed to fetch tags due to [{inner_exc}]")

            schema_fqn = cast(
                "str",
                fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                ),
            )
            for res in result:
                row = list(res)
                fqn_elements = [name for name in row[2:] if name]

                # row[0] = TAG_NAME, row[1] = TAG_VALUE
                if not row[1]:
                    logger.warning(
                        f"Skipping tag '{row[0]}' for '{'.'.join(fqn_elements)}' - "
                        "TAG_VALUE is empty. Snowflake tags require a value to be ingested."
                    )
                    continue

                entity_fqn = fqn._build(self.context.get().database_service, *fqn_elements)  # pyright: ignore[reportAttributeAccessIssue]
                try:
                    classification = self.tag_canonicalizer.classification(
                        row[0], default_description=SNOWFLAKE_CLASSIFICATION_DESCRIPTION
                    )
                    tag = self.tag_canonicalizer.tag(
                        classification.name, row[1], default_tag_description=SNOWFLAKE_TAG_DESCRIPTION
                    )

                    self.tags_registry.attach(
                        scope_fqn=schema_fqn,
                        entity_fqn=entity_fqn,
                        classification_name=classification.name,
                        tag_name=tag.name,
                        classification_description=classification.description,
                        tag_description=tag.description,
                    )
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    yield Either(
                        left=StackTraceError(
                            name=f"{row[0]}.{row[1]}",
                            error=f"Tag canonicalization failed for {row[0]}.{row[1]}: {exc}",
                            stackTrace=traceback.format_exc(),
                        ),
                        right=None,
                    )

            # Yield schema-level tags
            if schema_name in self.schema_tags_map:
                for tag_info in self.schema_tags_map[schema_name]:
                    try:
                        classification = self.tag_canonicalizer.classification(
                            tag_info["tag_name"], default_description=SNOWFLAKE_CLASSIFICATION_DESCRIPTION
                        )
                        tag = self.tag_canonicalizer.tag(
                            classification.name,
                            tag_info["tag_value"],
                            default_tag_description=SNOWFLAKE_TAG_DESCRIPTION,
                        )

                        self.tags_registry.attach(
                            scope_fqn=schema_fqn,
                            entity_fqn=schema_fqn,
                            classification_name=classification.name,
                            tag_name=tag.name,
                            classification_description=classification.description,
                            tag_description=tag.description,
                        )
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        yield Either(
                            left=StackTraceError(
                                name=f"{tag_info['tag_name']}.{tag_info['tag_value']}",
                                error=f"Tag canonicalization failed for {tag_info['tag_name']}.{tag_info['tag_value']}: {exc}",
                                stackTrace=traceback.format_exc(),
                            ),
                            right=None,
                        )
            yield from (Either(left=None, right=record) for record in self.tags_registry.drain())

    def yield_database_tag(self, database_name: str) -> Iterable[Either[OMetaTagAndClassification]]:
        """Yield database-level tags for the topology."""
        if not self.source_config.includeTags:
            return

        if database_name not in self.database_tags_map:
            return

        database_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=database_name,
            ),
        )
        for tag_info in self.database_tags_map[database_name]:
            try:
                classification = self.tag_canonicalizer.classification(
                    tag_info["tag_name"], default_description=SNOWFLAKE_CLASSIFICATION_DESCRIPTION
                )
                tag = self.tag_canonicalizer.tag(
                    classification.name, tag_info["tag_value"], default_tag_description=SNOWFLAKE_TAG_DESCRIPTION
                )

                self.tags_registry.attach(
                    scope_fqn=database_fqn,
                    entity_fqn=database_fqn,
                    classification_name=classification.name,
                    tag_name=tag.name,
                    classification_description=classification.description,
                    tag_description=tag.description,
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                yield Either(
                    left=StackTraceError(
                        name=f"{tag_info['tag_name']}.{tag_info['tag_value']}",
                        error=f"Tag canonicalization failed for {tag_info['tag_name']}.{tag_info['tag_value']}: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                    right=None,
                )
        yield from (Either(left=None, right=record) for record in self.tags_registry.drain())

    def _get_table_names_and_types(
        self, schema_name: str, table_type: TableType = TableType.Regular
    ) -> list[TableNameAndType]:

        snowflake_tables = self.inspector.get_table_names(
            schema=schema_name,
            incremental=self.incremental,
            account_usage=self.service_connection.accountUsageSchema,
            include_views=self.source_config.includeViews,
            **({"include_transient_tables": True} if self.service_connection.includeTransientTables else {}),
        )

        deleted_fqns = []
        for table in snowflake_tables.get_deleted():  # pyright: ignore[reportAttributeAccessIssue]
            try:
                deleted_fqns.append(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                        database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
                        schema_name=schema_name,
                        table_name=table.name,
                    )
                )
            except Exception as err:
                logger.warning(f"Skipping deleted-table FQN for {table.name!r} in schema {schema_name}: {err}")
                logger.debug(traceback.format_exc())
        self.context.get_global().deleted_tables.extend(deleted_fqns)

        return [TableNameAndType(name=table.name, type_=table.type_) for table in snowflake_tables.get_not_deleted()]  # pyright: ignore[reportAttributeAccessIssue]

    def _get_stream_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
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

        return [TableNameAndType(name=stream.name, type_=table_type) for stream in snowflake_streams.get_not_deleted()]

    def _get_stage_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        """Fetch named stages from the schema"""
        table_type = TableType.Stage

        snowflake_stages = self.inspector.get_stage_names(schema=schema_name)

        return [TableNameAndType(name=stage.name, type_=table_type) for stage in snowflake_stages.get_not_deleted()]

    def _get_semantic_view_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        """Fetch semantic views from the schema"""
        table_type = TableType.SemanticView

        snowflake_semantic_views = self.inspector.get_semantic_view_names(schema=schema_name)  # pyright: ignore[reportAttributeAccessIssue]

        return [
            TableNameAndType(name=semantic_view.name, type_=table_type)
            for semantic_view in snowflake_semantic_views.get_not_deleted()
        ]

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """
        table_list = self._get_table_names_and_types(schema_name)

        if self.service_connection.includeStreams:
            table_list.extend(self._get_stream_names_and_types(schema_name))

        if self.service_connection.includeStages:
            table_list.extend(self._get_stage_names_and_types(schema_name))

        if self.service_connection.includeSemanticViews:
            try:
                table_list.extend(self._get_semantic_view_names_and_types(schema_name))
            except Exception as exc:
                logger.warning(f"Failed to list semantic views for schema [{schema_name}]: {exc}")
                logger.debug(traceback.format_exc())

        return table_list

    def _get_org_name(self) -> str | None:
        try:
            with self.engine.connect() as conn:
                res = conn.execute(text(SNOWFLAKE_GET_ORGANIZATION_NAME)).one()
            if res:
                return res.NAME
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch Organization name due to: {exc}")
        return None

    def _get_current_account(self) -> str | None:
        try:
            with self.engine.connect() as conn:
                res = conn.execute(text(SNOWFLAKE_GET_CURRENT_ACCOUNT)).one()
            if res:
                return res.ACCOUNT
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch current account due to: {exc}")
        return None

    def _get_source_url_root(self, database_name: str | None = None, schema_name: str | None = None) -> str:
        url = (
            f"https://{self.service_connection.snowflakeSourceHost}/{self.org_name.lower()}"
            f"/{self.account.lower()}/#/data/databases/{database_name}"
        )
        if schema_name:
            url = f"{url}/schemas/{schema_name}"

        return url

    def get_source_url(
        self,
        database_name: str | None = None,
        schema_name: str | None = None,
        table_name: str | None = None,
        table_type: TableType | None = None,
    ) -> str | None:
        """
        Method to get the source url for snowflake tables
        """
        try:
            if self.account and self.org_name:
                tab_type = TABLE_TYPE_URL_MAP.get(table_type, "table")
                url = self._get_source_url_root(database_name=database_name, schema_name=schema_name)
                if table_name:
                    url = f"{url}/{tab_type}/{table_name}"
                return url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def get_procedure_source_url(
        self,
        database_name: str | None = None,
        schema_name: str | None = None,
        procedure_name: str | None = None,
        procedure_signature: str | None = None,
        procedure_type: str | None = None,
    ) -> str | None:
        """
        Method to get the source url for snowflake stored procedures
        """
        try:
            if self.account and self.org_name:
                url = self._get_source_url_root(database_name=database_name, schema_name=schema_name)

                # Convert string procedure type to enum and get URL mapping
                proc_type_enum = (
                    StoredProcedureType(procedure_type) if procedure_type else StoredProcedureType.StoredProcedure
                )
                tab_type = PROCEDURE_TYPE_URL_MAP.get(proc_type_enum, "procedure")

                if procedure_name:
                    full_name = f"{procedure_name}{procedure_signature or ''}"
                    url = f"{url}/{tab_type}/{full_name}"

                return url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get procedure source url: {exc}")
        return None

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the view
        name and type. By default, use the inspector method
        to get the names and pass the View type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., material views,...
        """
        return []

    def _get_stored_procedures_internal(self, query: str) -> Iterable[SnowflakeStoredProcedure]:
        try:
            with self.engine.connect() as conn:
                for row in conn.execute(
                    text(
                        query.format(
                            database_name=self.context.get().database,
                            schema_name=self.context.get().database_schema,
                            account_usage=self.service_connection.accountUsageSchema,
                        )
                    )
                ):
                    stored_procedure = SnowflakeStoredProcedure.model_validate(row._asdict())
                    if stored_procedure.definition is None:
                        logger.debug(
                            f"Missing ownership permissions on procedure {stored_procedure.name}."
                            " Trying to fetch description via DESCRIBE."
                        )
                        stored_procedure.definition = self.describe_procedure_definition(stored_procedure)
                    if self.is_stored_procedure_filtered(stored_procedure.name):
                        continue
                    yield stored_procedure
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching stored procedures: {exc}")

    def get_stored_procedures(self) -> Iterable[SnowflakeStoredProcedure]:
        """List Snowflake stored procedures"""
        if self.source_config.includeStoredProcedures:
            yield from self._get_stored_procedures_internal(SNOWFLAKE_GET_STORED_PROCEDURES_AND_FUNCTIONS)

    def describe_procedure_definition(self, stored_procedure: SnowflakeStoredProcedure) -> str:
        """
        We can only get the SP definition via the INFORMATION_SCHEMA.PROCEDURES if the
        user has OWNERSHIP grants, which will not always be the case.

        Then, if the procedure is created with `EXECUTE AS CALLER`, we can still try to
        get the definition with a DESCRIBE.
        """
        try:
            if stored_procedure.procedure_type == StoredProcedureType.StoredProcedure.value:
                query = SNOWFLAKE_DESC_STORED_PROCEDURE
            else:
                query = SNOWFLAKE_DESC_FUNCTION
            with self.engine.connect() as conn:
                res = conn.execute(
                    text(
                        query.format(
                            database_name=self.context.get().database,
                            schema_name=self.context.get().database_schema,
                            procedure_name=stored_procedure.name,
                            procedure_signature=stored_procedure.unquote_signature(),
                        )
                    )
                )
                rows = res.all()
                return rows[0]._mapping["body"] if rows else ""
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
                storedProcedureType=stored_procedure.procedure_type or StoredProcedureType.StoredProcedure.value,
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
                sourceUrl=SourceUrl(
                    self.get_procedure_source_url(
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        procedure_name=stored_procedure.name,
                        procedure_signature=stored_procedure.signature,
                        procedure_type=stored_procedure.procedure_type,
                    )
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
                raise ValueError("No Database found in the context. We cannot run the table deletion.")

            if self.source_config.markDeletedTables:
                logger.info(f"Mark Deleted Tables set to True. Processing database [{self.context.get().database}]")
                yield from delete_entity_by_name(
                    self.metadata,
                    entity_type=Table,
                    entity_names=self.context.get_global().deleted_tables,
                    recursive=self.source_config.markDeletedTables,
                )
        else:
            yield from super().mark_tables_as_deleted()

    def _get_semantic_view_columns(self, schema_name: str, table_name: str) -> list[dict]:
        """Build columns for a semantic view from its dimensions, facts and metrics.

        Semantic views expose logical objects rather than physical columns; each
        dimension/fact/metric becomes a column. Failures are swallowed (warn +
        continue) so an unsupported account or missing catalog view never fails
        ingestion of the semantic view itself.
        """
        columns = []
        try:
            columns = self._fetch_semantic_view_columns(schema_name, table_name)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"Failed to fetch semantic view columns for [{schema_name}.{table_name}]: {exc}")
            logger.debug(traceback.format_exc())
        return columns

    def _fetch_semantic_view_columns(self, schema_name: str, table_name: str) -> list[dict]:
        """Merge the schema's dimension/fact rows for one view (deduplicated by
        column name) into OpenMetadata column dicts."""
        schema = fqn.unquote_name(schema_name)
        semantic_view = fqn.unquote_name(table_name)
        merged: dict[str, dict] = {}
        for kind, catalog_view in SEMANTIC_VIEW_COLUMN_KINDS:
            for row in self._semantic_rows(catalog_view, schema, semantic_view):
                merge_semantic_view_column(merged, kind, row)
        return [build_semantic_view_column(entry) for entry in merged.values()]

    def _semantic_catalog_cache(self) -> "LRUCache[SemanticCatalog | None]":
        """Bounded, per-thread LRU of schema-wide semantic catalogs.

        Per-thread because the ``databaseSchema`` topology node runs with
        ``threads=True`` and each worker walks a different schema: at the default
        capacity of 2 a shared cache would thrash, every worker evicting the
        others' schema. Bounded because a schema with very many semantic objects
        would otherwise be retained for the whole database run (``info_cache``
        only clears between databases).
        """
        if not hasattr(self._semantic_catalog_local, "cache"):
            self._semantic_catalog_local.cache = LRUCache(SEMANTIC_CATALOG_CACHE_SIZE)
        return self._semantic_catalog_local.cache

    def _semantic_catalog(self, schema: str) -> SemanticCatalog | None:
        """Every semantic object in ``schema``, in three queries total.

        Replaces the previous three-queries-per-view pattern, which cost 3N
        round-trips for N semantic views. Returns ``None`` when Snowflake refuses
        the bulk query with errno 90030, signalling the per-view fallback.
        """
        cache = self._semantic_catalog_cache()
        if schema in cache:
            return cache.get(schema)

        catalog: SemanticCatalog | None = {}
        try:
            for catalog_view in SEMANTIC_CATALOG_VIEWS:
                by_view: dict[str, list[tuple]] = {}
                query = SNOWFLAKE_GET_SEMANTIC_OBJECTS_IN_SCHEMA.format(catalog_view=catalog_view, schema=schema)
                for row in self._execute_semantic_query(query):
                    # SEMANTIC_VIEW_NAME leads the projection; strip it so the rest of
                    # the row keeps the layout the per-view queries return.
                    by_view.setdefault(row[0], []).append(row[1:])
                catalog[catalog_view] = by_view
        except sa_exc.ProgrammingError as p_err:
            if getattr(p_err.orig, "errno", None) != INFO_SCHEMA_TOO_MUCH_DATA:
                raise
            logger.warning(
                f"Schema-wide semantic catalog query for [{schema}] returned too much data; "
                "falling back to per-view queries"
            )
            catalog = None

        # The ``None`` 90030 sentinel is cached too, so we do not re-run the bulk
        # query for every view in the schema just to fail again.
        cache.put(schema, catalog)
        return catalog

    def _execute_semantic_query(self, query: str) -> list[tuple]:
        """Run a semantic catalog query and materialize the rows as plain tuples."""
        cursor = self.connection.execute(text(query))
        return [tuple(row) for row in cursor]  # pyright: ignore[reportOptionalIterable]

    def _semantic_rows(self, catalog_view: str, schema: str, view: str) -> list[tuple]:
        """Rows of one catalog view for one semantic view, from the schema-wide
        batch when available, else from a single per-view query."""
        catalog = self._semantic_catalog(schema)
        if catalog is not None:
            return catalog.get(catalog_view, {}).get(view, [])
        query = SNOWFLAKE_GET_SEMANTIC_OBJECTS_FOR_VIEW.format(
            catalog_view=catalog_view, schema=schema, semantic_view=view
        )
        return self._execute_semantic_query(query)

    def _semantic_view_reference(self, database: str, schema: str, view: str) -> EntityReference | None:
        view_fqn = fqn._build(self.context.get().database_service, database, schema, view)  # pyright: ignore[reportAttributeAccessIssue]
        entity = self.metadata.get_by_name(entity=Table, fqn=view_fqn)
        reference = None
        if entity is not None:
            reference = EntityReference(id=entity.id.root, type="table")  # pyright: ignore[reportCallIssue]
        return reference

    def yield_table_metrics(
        self,
        table_name_and_type: tuple[str, TableType],
    ) -> Iterable[Either[CreateMetricRequest]]:
        """Yield one Metric entity per Snowflake metric on a semantic view."""
        view, table_type = table_name_and_type
        if table_type == TableType.SemanticView:
            service = self.context.get().database_service  # pyright: ignore[reportAttributeAccessIssue]
            database = self.context.get().database  # pyright: ignore[reportAttributeAccessIssue]
            schema = self.context.get().database_schema  # pyright: ignore[reportAttributeAccessIssue]
            try:
                query_schema = fqn.unquote_name(schema)
                query_view = fqn.unquote_name(view)
                dimension_rows = self._semantic_rows(SEMANTIC_DIMENSIONS, query_schema, query_view)
                fact_rows = self._semantic_rows(SEMANTIC_FACTS, query_schema, query_view)
                metric_rows = self._semantic_rows(SEMANTIC_METRICS, query_schema, query_view)
                logger.info(
                    f"Semantic view [{schema}.{view}]: emitting {len(metric_rows)} metric(s) "
                    f"with {len(dimension_rows)} dimension(s) and {len(fact_rows)} measure(s)"
                )
                if not metric_rows:
                    return
                # This view's own CreateTableRequest is still in the sink's bulk buffer
                # (Metric requests are written immediately, Table requests batch), so
                # without a flush the lookup below 404s on every first run and the
                # metrics lose their assets[] back-reference. Gated on metric_rows: the
                # stage runs for every table, and flushing per table would negate the
                # bulk sink for every connector.
                yield Either(right=Barrier(reason=f"semantic_view_metrics:{schema}.{view}"))  # pyright: ignore[reportCallIssue]
                view_ref = self._semantic_view_reference(database, schema, view)
                for metric_row in metric_rows:
                    yield Either(  # pyright: ignore[reportCallIssue]
                        right=build_metric_request(
                            service,
                            database,
                            schema,
                            view,
                            metric_row,
                            dimension_rows,
                            fact_rows,
                            view_ref,
                        )
                    )
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning(f"Failed to build metrics for semantic view [{schema}.{view}]: {exc}")
                logger.debug(traceback.format_exc())

    def _get_columns_internal(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ):
        """
        Get columns of table/view/stream/stage
        """
        # Stages do not expose columns in Snowflake
        if table_type == TableType.Stage:
            return []

        # Semantic views expose logical objects (dimensions/facts/metrics) as columns
        if table_type == TableType.SemanticView:
            return self._get_semantic_view_columns(schema_name, table_name)

        # For streams, we will use source table/view's columns
        # since stream does not define columns separately in Snowflake
        if table_type == TableType.Stream:
            cursor = self.connection.execute(
                text(SNOWFLAKE_GET_STREAM.format(stream_name=table_name, schema=schema_name))
            )
            try:
                result = cursor.fetchone()
                if result:
                    table_name = result[6].split(".")[-1]
                    # Can't fetch source of stream is source is dropped or no priviledge
                    if table_name == "No privilege or table dropped":
                        logger.warning(
                            f"Couldn't fetch columns of stream [{result and result[1]}] "
                            f"(schema: '{schema_name}', db: '{db_name}') due to error on"
                            f" source: [{table_name}]. Result: {result}"
                        )
                        return []
            except Exception:
                pass

        try:
            # Do NOT forward `table_type` here. SQLAlchemy's @reflection.cache
            # decorator on the underlying get_columns / _get_schema_columns
            # builds its cache key from **kw, so a varying `table_type`
            # (Regular for base tables, View for views) produces distinct
            # cache keys for the SAME schema. For a huge schema (e.g. ~13k
            # wide tables), the table→view transition then cache-misses on
            # _get_schema_columns and re-materializes the whole schema's
            # column metadata (~1.6 GB) — which is what OOM-killed the pod
            # in the COM_US_IMDNA_ADL.AWB_INTERM incident. The Snowflake
            # dialect's get_columns ignores `table_type`; the Stage/Stream
            # branches above already consumed it.
            columns = inspector.get_columns(table_name, schema_name, db_name=db_name)
        except sa_exc.NoSuchTableError:
            logger.warning(
                f"Table [{table_name}] (schema: '{schema_name}', db: '{db_name}') not found."
                " Unable to fetch columns. Please check if the configured Snowflake user has"
                " necessary grants on this table."
            )
            return []

        if table_type == TableType.Stream:
            columns = [*columns, *DEFAULT_STREAM_COLUMNS]

        return columns

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        """
        Get the DDL statement, View Definition or Stream Definition for a table

        To fetch the view definition, we have followed an optimised approach
        i.e. fetching view definition of all the views in schema storing it
        in cache and using the same cache to fetch the view definition.

        To fetch definition for other types of tables, we have used the
        get_ddl method, since this method only accepts string literal as arguments
        it is not possible to do something like this:

        select table_name, schema, get_ddl('table', table_name) from information_schema.tables
        so we have to fetch the ddl for each table individually.

        Alternatives are executing an stored procedure to automate this but
        it requires additional permissions like execute which users may not be comfortable doing.
        Or reconstruct the ddl from column types, which we can explore in the future.
        """
        try:
            schema_definition = None
            if table_type in (TableType.View, TableType.MaterializedView):
                schema_definition = inspector.get_view_definition(table_name, schema_name)
            elif table_type == TableType.Stream:
                schema_definition = inspector.get_stream_definition(self.connection, table_name, schema_name)
            elif table_type == TableType.SemanticView:
                schema_definition = inspector.get_semantic_view_definition(self.connection, table_name, schema_name)  # pyright: ignore[reportAttributeAccessIssue]
            elif table_type == TableType.Stage:
                # Snowflake Stage does not have a DDL or definition,
                # so we will return None for stage type
                pass
            elif self.source_config.includeDDL or table_type == TableType.Dynamic:
                schema_definition = inspector.get_table_ddl(self.connection, table_name, schema_name)
            schema_definition = str(schema_definition).strip() if schema_definition is not None else None
            return schema_definition  # noqa: RET504, TRY300

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

    def get_owner_ref(self, table_name: str) -> EntityReferenceList | None:
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
        logger.debug(f"Processing ownership is not supported for {self.service_connection.type.name}")

    def _get_classification_name(self, tag_label: TagLabel) -> str:
        """Extract classification name from tag FQN (e.g., 'ENV.staging' -> 'ENV')"""
        tag_fqn = tag_label.tagFQN.root if tag_label.tagFQN else ""
        parts = fqn.split(tag_fqn) if tag_fqn else []
        return parts[0] if parts else tag_fqn

    def _has_classification(self, classification_name: str, tag_list: list[TagLabel]) -> bool:
        """Check if a tag with the given classification name already exists"""
        for tag in tag_list:  # noqa: SIM110
            if self._get_classification_name(tag) == classification_name:
                return True
        return False

    def get_database_tag_labels(self, database_name: str) -> list[TagLabel] | None:
        """Return tags for the database entity from registry."""
        database_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=database_name,
            ),
        )
        return self.tags_registry.labels_for(database_fqn) or None

    def get_column_tag_labels(self, table_name: str, column: dict) -> list[TagLabel] | None:
        """Return tags for a column entity from the registry.

        Column tags don't inherit from parent entities (table/schema/database)
        — those have separate semantic meaning at their own level. Direct
        lookup is sufficient.
        """
        col_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Column,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
                schema_name=self.context.get().database_schema,  # pyright: ignore[reportAttributeAccessIssue]
                table_name=table_name,
                column_name=column["name"],
            ),
        )
        return self.tags_registry.labels_for(col_fqn) or None

    def get_schema_tag_labels(self, schema_name: str) -> list[TagLabel] | None:
        """
        Return tags for schema entity including:
        1. Snowflake schema-level tags
        2. Inherited database-level tags (only if no tag with same classification exists)
        """
        schema_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
                schema_name=schema_name,
            ),
        )
        database_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
            ),
        )

        schema_tags = self.tags_registry.labels_for(schema_fqn)

        # Add inherited database tags (only if classification doesn't already exist)
        for label in self.tags_registry.labels_for(database_fqn):
            if not self._has_classification(self._get_classification_name(label), schema_tags):
                schema_tags.append(label)

        return schema_tags if schema_tags else None

    def get_tag_labels(self, table_name: str) -> list[TagLabel] | None:
        """
        Override to include inherited tags from both schema and database levels.
        This method combines:
        1. Tags directly assigned to the table (from parent implementation)
        2. Tags inherited from the schema level (only if no tag with same classification)
        3. Tags inherited from the database level (only if no tag with same classification)

        Tag values at lower levels take precedence over inherited values.
        """
        table_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
                schema_name=self.context.get().database_schema,  # pyright: ignore[reportAttributeAccessIssue]
                table_name=table_name,
                skip_es_search=True,
            ),
        )
        schema_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
                schema_name=self.context.get().database_schema,  # pyright: ignore[reportAttributeAccessIssue]
            ),
        )
        database_fqn = cast(
            "str",
            fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,  # pyright: ignore[reportAttributeAccessIssue]
                database_name=self.context.get().database,  # pyright: ignore[reportAttributeAccessIssue]
            ),
        )

        table_tags = self.tags_registry.labels_for(table_fqn)

        # Add inherited schema tags (only if classification doesn't already exist)
        for label in self.tags_registry.labels_for(schema_fqn):
            if not self._has_classification(self._get_classification_name(label), table_tags):
                table_tags.append(label)

        # Add inherited database tags (only if classification doesn't already exist)
        for label in self.tags_registry.labels_for(database_fqn):
            if not self._has_classification(self._get_classification_name(label), table_tags):
                table_tags.append(label)

        return table_tags if table_tags else None
