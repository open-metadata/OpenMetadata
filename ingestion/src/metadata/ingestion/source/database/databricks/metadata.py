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
"""Databricks legacy source module"""

import re
import traceback
from copy import deepcopy
from typing import Iterable, Optional, Tuple, Union

from pydantic import EmailStr
from pydantic_core import PydanticCustomError
from pyhive.sqlalchemy_hive import _type_map
from sqlalchemy import exc, types, util
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.exc import DatabaseError
from sqlalchemy.sql.sqltypes import String
from sqlalchemy_databricks._dialect import DatabricksDialect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_DDL,
    DATABRICKS_GET_CATALOGS,
    DATABRICKS_GET_CATALOGS_TAGS,
    DATABRICKS_GET_COLUMN_TAGS,
    DATABRICKS_GET_SCHEMA_TAGS,
    DATABRICKS_GET_TABLE_COMMENTS,
    DATABRICKS_GET_TABLE_TAGS,
    DATABRICKS_VIEW_DEFINITIONS,
)
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_view_definitions,
    get_table_comment_result_wrapper,
    get_table_comment_results,
    get_view_definition_wrapper,
)
from metadata.utils.tag_utils import get_ometa_tag_and_classification

logger = ingestion_logger()

DATABRICKS_TAG = "DATABRICKS TAG"
DATABRICKS_TAG_CLASSIFICATION = "DATABRICKS TAG CLASSIFICATION"
DEFAULT_TAG_VALUE = "NONE"


class STRUCT(String):
    #  This class is added to support STRUCT datatype
    """The SQL STRUCT type."""

    __visit_name__ = "STRUCT"


class ARRAY(String):
    #  This class is added to support ARRAY datatype
    """The SQL ARRAY type."""

    __visit_name__ = "ARRAY"


class MAP(String):
    #  This class is added to support MAP datatype
    """The SQL MAP type."""

    __visit_name__ = "MAP"


# overriding pyhive.sqlalchemy_hive._type_map
# mapping struct, array & map to custom classed instead of sqltypes.String
_type_map.update(
    {
        "struct": STRUCT,
        "array": ARRAY,
        "map": MAP,
        "void": create_sqlalchemy_type("VOID"),
        "interval": create_sqlalchemy_type("INTERVAL"),
        "binary": create_sqlalchemy_type("BINARY"),
    }
)


# This method is from hive dialect originally but
# is overridden to optimize DESCRIBE query execution
def _get_table_columns(self, connection, table_name, schema, db_name):
    full_table = table_name
    if schema:
        full_table = schema + "." + table_name
    # TODO using TGetColumnsReq hangs after sending TFetchResultsReq.
    # Using DESCRIBE works but is uglier.
    try:
        # This needs the table name to be unescaped (no backticks).
        query = DATABRICKS_GET_TABLE_COMMENTS.format(
            database_name=db_name, schema_name=schema, table_name=table_name
        )
        rows = get_table_comment_result(
            self,
            connection=connection,
            query=query,
            database=db_name,
            table_name=table_name,
            schema=schema,
        )

    except exc.OperationalError as e:
        # Does the table exist?
        regex_fmt = r"TExecuteStatementResp.*SemanticException.*Table not found {}"
        regex = regex_fmt.format(re.escape(full_table))
        if re.search(regex, e.args[0]):
            raise exc.NoSuchTableError(full_table)
        else:
            raise
    else:
        # Hive is stupid: this is what I get from DESCRIBE some_schema.does_not_exist
        regex = r"Table .* does not exist"
        if len(rows) == 1 and re.match(regex, rows[0].col_name):
            raise exc.NoSuchTableError(full_table)
        return rows


def _get_column_rows(self, connection, table_name, schema, db_name):
    # get columns and strip whitespace
    table_columns = _get_table_columns(  # pylint: disable=protected-access
        self, connection, table_name, schema, db_name
    )
    column_rows = [
        [col.strip() if col else None for col in row] for row in table_columns
    ]
    # Filter out empty rows and comment
    return [row for row in column_rows if row[0] and row[0] != "# col_name"]


@reflection.cache
def get_columns(self, connection, table_name, schema=None, **kw):
    """
    This function overrides the sqlalchemy_databricks._dialect.DatabricksDialect.get_columns
    to add support for struct, array & map datatype

    Extract the Database Name from the keyword arguments parameter if it is present. This
    value should match what is provided in the 'source.config.database' field in the
    Databricks ingest config file.
    """

    rows = _get_column_rows(self, connection, table_name, schema, kw.get("db_name"))
    result = []
    for col_name, col_type, _comment in rows:
        # Handle both oss hive and Databricks' hive partition header, respectively
        if col_name in (
            "# Partition Information",
            "# Partitioning",
            "# Clustering Information",
            "# Delta Statistics Columns",
            "# Detailed Table Information",
        ):
            break
        # Take out the more detailed type information
        # e.g. 'map<ixnt,int>' -> 'map'
        #      'decimal(10,1)' -> decimal
        raw_col_type = col_type
        col_type = re.search(r"^\w+", col_type).group(0)
        try:
            coltype = _type_map[col_type]
        except KeyError:
            util.warn(f"Did not recognize type '{col_type}' of column '{col_name}'")
            coltype = types.NullType

        col_info = {
            "name": col_name,
            "type": coltype,
            "nullable": True,
            "default": None,
            "comment": _comment,
            "system_data_type": raw_col_type,
        }
        if col_type in {"array", "struct", "map"}:
            try:
                rows = dict(
                    connection.execute(
                        f"DESCRIBE TABLE `{kw.get('db_name')}`.`{schema}`.`{table_name}` `{col_name}`"
                    ).fetchall()
                )
                col_info["system_data_type"] = rows["data_type"]
                col_info["is_complex"] = True
            except DatabaseError as err:
                logger.error(
                    f"Failed to fetch column details for column {col_name} in table {table_name} due to: {err}"
                )
                logger.debug(traceback.format_exc())
        result.append(col_info)
    return result


@reflection.cache
def get_schema_names(self, connection, **kw):  # pylint: disable=unused-argument
    # Equivalent to SHOW DATABASES
    if kw.get("database") and kw.get("is_old_version") is not True:
        connection.execute(f"USE CATALOG '{kw.get('database')}'")
    return [row[0] for row in connection.execute("SHOW SCHEMAS")]


def get_schema_names_reflection(self, **kw):
    """Return all schema names."""

    if hasattr(self.dialect, "get_schema_names"):
        with self._operation_context() as conn:  # pylint: disable=protected-access
            return self.dialect.get_schema_names(conn, info_cache=self.info_cache, **kw)
    return []


def get_view_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    query = "SHOW VIEWS"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    view_in_schema = connection.execute(query)
    views = []
    for row in view_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            views.append(row[1])
        else:
            views.append(row[0])
    return views


@reflection.cache
def get_table_comment(  # pylint: disable=unused-argument
    self, connection, table_name, schema_name, **kw
):
    """
    Returns comment of table
    """
    query = DATABRICKS_GET_TABLE_COMMENTS.format(
        database_name=self.context.get().database,
        schema_name=schema_name,
        table_name=table_name,
    )
    cursor = self.get_table_comment_result(
        self,
        connection=connection,
        query=query,
        database=self.context.get().database,
        table_name=table_name,
        schema=schema_name,
    )
    try:
        for result in list(cursor):
            data = result.values()
            if data[0] and data[0].strip() == "Comment":
                return {"text": data[1] if data and data[1] else None}
    except Exception:
        return {"text": None}
    return {"text": None}


@reflection.cache
def get_view_definition(
    self, connection, table_name, schema=None, **kw  # pylint: disable=unused-argument
):
    schema_name = [row[0] for row in connection.execute("SHOW SCHEMAS")]
    if "information_schema" in schema_name:
        return get_view_definition_wrapper(
            self,
            connection,
            table_name=table_name,
            schema=schema,
            query=DATABRICKS_VIEW_DEFINITIONS,
        )
    return None


@reflection.cache
def get_table_comment_result(
    self,
    connection,
    query,
    database,
    table_name,
    schema=None,
    **kw,  # pylint: disable=unused-argument
):
    return get_table_comment_result_wrapper(
        self,
        connection,
        query=query,
        database=database,
        table_name=table_name,
        schema=schema,
    )


@reflection.cache
def get_table_ddl(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """
    Gets the Table DDL
    """
    schema = schema or self.default_schema_name
    table_name = f"{schema}.{table_name}" if schema else table_name
    cursor = connection.execute(DATABRICKS_DDL.format(table_name=table_name))
    try:
        result = cursor.fetchone()
        if result:
            return result[0]
    except Exception:
        pass
    return None


@reflection.cache
def get_table_names(
    self, connection, schema=None, **kw
):  # pylint: disable=unused-argument
    query = "SHOW TABLES"
    if schema:
        query += " IN " + self.identifier_preparer.quote_identifier(schema)
    tables_in_schema = connection.execute(query)
    tables = []
    for row in tables_in_schema:
        # check number of columns in result
        # if it is > 1, we use spark thrift server with 3 columns in the result (schema, table, is_temporary)
        # else it is hive with 1 column in the result
        if len(row) > 1:
            table_name = row[1]
        else:
            table_name = row[0]
        if schema:
            database = kw.get("db_name")
            table_type = get_table_type(self, connection, database, schema, table_name)
            if not table_type or table_type == "FOREIGN":
                # skip the table if it's foreign table / error in fetching table_type
                logger.debug(
                    f"Skipping metadata ingestion for unsupported foreign table {table_name}"
                )
                continue
        tables.append(table_name)

    # "SHOW TABLES" command in hive also fetches view names
    # Below code filters out view names from table names
    views = self.get_view_names(connection, schema)
    return [table for table in tables if table not in views]


def get_table_type(self, connection, database, schema, table):
    """get table type (regular/foreign)"""
    try:
        if database:
            query = DATABRICKS_GET_TABLE_COMMENTS.format(
                database_name=database, schema_name=schema, table_name=table
            )
        else:
            query = f"DESCRIBE TABLE EXTENDED `{schema}`.`{table}`"
        rows = get_table_comment_result(
            self,
            connection=connection,
            query=query,
            database=database,
            table_name=table,
            schema=schema,
        )
        for row in rows:
            row_dict = dict(row)
            if row_dict.get("col_name") == "Type":
                # get type of table
                return row_dict.get("data_type")
    except DatabaseError as err:
        logger.error(f"Failed to fetch table type for table {table} due to: {err}")
    return


DatabricksDialect.get_table_comment = get_table_comment
DatabricksDialect.get_view_names = get_view_names
DatabricksDialect.get_columns = get_columns
DatabricksDialect.get_schema_names = get_schema_names
DatabricksDialect.get_view_definition = get_view_definition
DatabricksDialect.get_table_names = get_table_names
DatabricksDialect.get_all_view_definitions = get_all_view_definitions
DatabricksDialect.get_table_comment_results = get_table_comment_results
DatabricksDialect.get_table_comment_result = get_table_comment_result
reflection.Inspector.get_schema_names = get_schema_names_reflection
reflection.Inspector.get_table_ddl = get_table_ddl


class DatabricksSource(ExternalTableLineageMixin, CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Databricks Source using
    the legacy hive metastore method
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.is_older_version = False
        self._init_version()
        self.catalog_tags = {}
        self.schema_tags = {}
        self.table_tags = {}
        self.external_location_map = {}
        self.column_tags = {}

    def _init_version(self):
        try:
            self.connection.execute(DATABRICKS_GET_CATALOGS).fetchone()
            self.is_older_version = False
        except DatabaseError as soe:
            logger.debug(f"Failed to fetch catalogs due to: {soe}")
            self.is_older_version = True

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DatabricksConnection = config.serviceConnection.root.config
        if not isinstance(connection, DatabricksConnection):
            raise InvalidSourceException(
                f"Expected DatabricksConnection, but got {connection}"
            )
        return cls(config, metadata)

    def set_inspector(self, database_name: str) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """
        logger.info(f"Ingesting from catalog: {database_name}")

        new_service_connection = deepcopy(self.service_connection)
        new_service_connection.catalog = database_name
        self.engine = get_connection(new_service_connection)

        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.catalog

    def get_database_names_raw(self) -> Iterable[str]:
        if not self.is_older_version:
            results = self.connection.execute(DATABRICKS_GET_CATALOGS)
            for res in results:
                if res:
                    row = list(res)
                    yield row[0]
        else:
            yield DEFAULT_DATABASE

    def _clear_tag_cache(self) -> None:
        """
        Method to clean any existing tags available in memory
        """
        self.catalog_tags.clear()
        self.table_tags.clear()
        self.schema_tags.clear()
        self.column_tags.clear()

    def _add_to_tag_cache(
        self, tag_dict: dict, key: Union[str, Tuple], value: Tuple[str, str]
    ):
        if tag_dict.get(key):
            tag_dict.get(key).append(value)
        else:
            tag_dict[key] = [value]

    def populate_tags_cache(self, database_name: str) -> None:
        """
        Method to fetch all the tags and populate the relevant caches
        """
        self._clear_tag_cache()
        if self.source_config.includeTags is False:
            return
        try:
            tags = self.connection.execute(
                DATABRICKS_GET_CATALOGS_TAGS.format(database_name=database_name)
            )

            for tag in tags:
                self._add_to_tag_cache(
                    self.catalog_tags,
                    tag.catalog_name,
                    # tag value is an optional field, if tag value is not available use default tag value
                    (tag.tag_name, tag.tag_value or DEFAULT_TAG_VALUE),
                )
        except Exception as exc:
            logger.debug(f"Failed to fetch catalog tags due to - {exc}")

        try:
            tags = self.connection.execute(
                DATABRICKS_GET_SCHEMA_TAGS.format(database_name=database_name)
            )
            for tag in tags:
                self._add_to_tag_cache(
                    self.schema_tags,
                    (tag.catalog_name, tag.schema_name),
                    # tag value is an optional field, if tag value is not available use default tag value
                    (tag.tag_name, tag.tag_value or DEFAULT_TAG_VALUE),
                )
        except Exception as exc:
            logger.debug(f"Failed to fetch schema tags due to - {exc}")

        try:
            tags = self.connection.execute(
                DATABRICKS_GET_TABLE_TAGS.format(database_name=database_name)
            )
            for tag in tags:
                self._add_to_tag_cache(
                    self.table_tags,
                    (tag.catalog_name, tag.schema_name, tag.table_name),
                    # tag value is an optional field, if tag value is not available use default tag value
                    (tag.tag_name, tag.tag_value or DEFAULT_TAG_VALUE),
                )
        except Exception as exc:
            logger.debug(f"Failed to fetch table tags due to - {exc}")

        try:
            tags = self.connection.execute(
                DATABRICKS_GET_COLUMN_TAGS.format(database_name=database_name)
            )
            for tag in tags:
                tag_table_id = (tag.catalog_name, tag.schema_name, tag.table_name)
                if self.column_tags.get(tag_table_id):
                    self._add_to_tag_cache(
                        self.column_tags.get(tag_table_id),
                        tag.column_name,
                        # tag value is an optional field, if tag value is not available use default tag value
                        (tag.tag_name, tag.tag_value or DEFAULT_TAG_VALUE),
                    )
                else:
                    self.column_tags[tag_table_id] = {
                        tag.column_name: [
                            (
                                tag.tag_name,
                                tag.tag_value or DEFAULT_TAG_VALUE,
                            )
                        ]
                    }
        except Exception as exc:
            logger.debug(f"Failed to fetch column tags due to - {exc}")

    def get_database_names(self) -> Iterable[str]:
        configured_catalog = self.service_connection.catalog
        if configured_catalog:
            self.set_inspector(database_name=configured_catalog)
            self.populate_tags_cache(database_name=configured_catalog)
            yield configured_catalog
        else:
            for new_catalog in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_catalog,
                )
                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    (
                        database_fqn
                        if self.source_config.useFqnForFiltering
                        else new_catalog
                    ),
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue
                try:
                    self.set_inspector(database_name=new_catalog)
                    self.populate_tags_cache(database_name=new_catalog)
                    yield new_catalog
                except Exception as exc:
                    logger.error(traceback.format_exc())
                    logger.warning(
                        f"Error trying to process database {new_catalog}: {exc}"
                    )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names(
                database=self.context.get().database,
                is_old_version=self.is_older_version,
            ):
                yield schema_name

    def yield_database_tag(
        self, database_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield database tags
        """
        try:
            catalog_tags = self.catalog_tags.get(database_name, [])
            for tag_name, tag_value in catalog_tags:
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn.build(
                        self.metadata,
                        Database,
                        service_name=self.context.get().database_service,
                        database_name=database_name,
                    ),
                    tags=[tag_value],
                    classification_name=tag_name,
                    tag_description=DATABRICKS_TAG,
                    classification_description=DATABRICKS_TAG_CLASSIFICATION,
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classifications",
                    error=f"Failed to fetch database tags due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to yield schema tags
        """
        try:
            schema_tags = self.schema_tags.get(
                (self.context.get().database, schema_name), []
            )
            for tag_name, tag_value in schema_tags:
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn.build(
                        self.metadata,
                        DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    ),
                    tags=[tag_value],
                    classification_name=tag_name,
                    tag_description=DATABRICKS_TAG,
                    classification_description=DATABRICKS_TAG_CLASSIFICATION,
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classifications",
                    error=f"Failed to fetch schema tags due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_table_tags(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        table_name, _ = table_name_and_type
        try:
            table_tags = self.table_tags.get(
                (
                    self.context.get().database,
                    self.context.get().database_schema,
                    table_name,
                ),
                [],
            )
            for tag_name, tag_value in table_tags:
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn.build(
                        self.metadata,
                        Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                    ),
                    tags=[tag_value],
                    classification_name=tag_name,
                    tag_description=DATABRICKS_TAG,
                    classification_description=DATABRICKS_TAG_CLASSIFICATION,
                )

            column_tags = self.column_tags.get(
                (
                    self.context.get().database,
                    self.context.get().database_schema,
                    table_name,
                ),
                {},
            )
            for column_name, tags in column_tags.items():
                for tag_name, tag_value in tags or []:
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=fqn.build(
                            self.metadata,
                            Column,
                            service_name=self.context.get().database_service,
                            database_name=self.context.get().database,
                            schema_name=self.context.get().database_schema,
                            table_name=table_name,
                            column_name=column_name,
                        ),
                        tags=[tag_value],
                        classification_name=tag_name,
                        tag_description=DATABRICKS_TAG,
                        classification_description=DATABRICKS_TAG_CLASSIFICATION,
                    )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classifications",
                    error=f"Failed to fetch table/column tags due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_table_description(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            query = DATABRICKS_GET_TABLE_COMMENTS.format(
                database_name=self.context.get().database,
                schema_name=schema_name,
                table_name=table_name,
            )
            cursor = inspector.dialect.get_table_comment_result(
                connection=self.connection,
                query=query,
                database=self.context.get().database,
                table_name=table_name,
                schema=schema_name,
            )
            for result in list(cursor):
                data = result.values()
                if data[0] and data[0].strip() == "Comment":
                    description = data[1] if data and data[1] else None
                elif data[0] and data[0].strip() == "Location":
                    self.external_location_map[
                        (self.context.get().database, schema_name, table_name)
                    ] = (
                        data[1]
                        if data and data[1] and not data[1].startswith("dbfs")
                        else None
                    )

        # Catch any exception without breaking the ingestion
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Table description error for table [{schema_name}.{table_name}]: {exc}"
            )
        return description

    def get_location_path(self, table_name: str, schema_name: str) -> Optional[str]:
        """
        Method to fetch the location path of the table
        """
        return self.external_location_map.get(
            (self.context.get().database, schema_name, table_name)
        )

    def _filter_owner_name(self, owner_name: str) -> str:
        """remove unnecessary keyword from name"""
        pattern = r"\(Unknown\)"
        filtered_name = re.sub(pattern, "", owner_name).strip()
        return filtered_name

    def get_owner_ref(self, table_name: str) -> Optional[EntityReferenceList]:
        """
        Method to process the table owners
        """
        try:
            query = DATABRICKS_GET_TABLE_COMMENTS.format(
                database_name=self.context.get().database,
                schema_name=self.context.get().database_schema,
                table_name=table_name,
            )
            result = self.inspector.dialect.get_table_comment_result(
                connection=self.connection,
                query=query,
                database=self.context.get().database,
                table_name=table_name,
                schema=self.context.get().database_schema,
            )
            owner = None
            for row in result:
                row_dict = dict(row)
                if row_dict.get("col_name") == "Owner":
                    owner = row_dict.get("data_type")
                    break
            if not owner:
                return

            owner = self._filter_owner_name(owner)
            owner_ref = None
            try:
                owner_email = EmailStr._validate(owner)
                owner_ref = self.metadata.get_reference_by_email(email=owner_email)
            except PydanticCustomError:
                owner_ref = self.metadata.get_reference_by_name(name=owner)
            return owner_ref
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner for table {table_name}: {exc}")
        return
