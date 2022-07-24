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
from typing import Iterable

from snowflake.sqlalchemy.custom_types import VARIANT
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine import reflection

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import (
    SNOWFLAKE_FETCH_ALL_TAGS,
    SNOWFLAKE_GET_COMMENTS,
    SNOWFLAKE_GET_TABLE_NAMES,
    SNOWFLAKE_GET_VIEW_NAMES,
    SNOWFLAKE_SESSION_TAG_QUERY,
)

GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = GEOGRAPHY

logger = ingestion_logger()


def get_table_names(self, connection, schema, **kw):
    cursor = connection.execute(SNOWFLAKE_GET_TABLE_NAMES.format(schema))
    result = [self.normalize_name(row[0]) for row in cursor]
    return result


def get_view_names(self, connection, schema, **kw):
    cursor = connection.execute(SNOWFLAKE_GET_VIEW_NAMES.format(schema))
    result = [self.normalize_name(row[0]) for row in cursor]
    return result


@reflection.cache
def get_view_definition(self, connection, view_name, schema=None, **kw):
    """
    Gets the view definition
    """
    schema = schema or self.default_schema_name
    if schema:
        cursor = connection.execute(
            "SHOW /* sqlalchemy:get_view_definition */ VIEWS "
            "LIKE '{0}' IN {1}".format(view_name, schema)
        )
    else:
        cursor = connection.execute(
            "SHOW /* sqlalchemy:get_view_definition */ VIEWS "
            "LIKE '{0}'".format(view_name)
        )
    n2i = self.__class__._map_name_to_idx(cursor)
    try:
        ret = cursor.fetchone()
        if ret:
            return ret[n2i["text"]]
    except Exception:
        pass
    return None


@reflection.cache
def get_table_comment(self, connection, table_name, schema_name, **kw):
    """
    Returns comment of table.
    """
    cursor = connection.execute(
        SNOWFLAKE_GET_COMMENTS.format(schema_name=schema_name, table_name=table_name)
    )

    result = cursor.fetchone()
    return {"text": result[0] if result and result[0] else None}


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    return []


def normalize_names(self, name):
    return name


SnowflakeDialect.get_table_names = get_table_names
SnowflakeDialect.get_view_names = get_view_names
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect.get_table_comment = get_table_comment
SnowflakeDialect.get_view_definition = get_view_definition
SnowflakeDialect.get_unique_constraints = get_unique_constraints


class SnowflakeSource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

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

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.__root__.config.database
        if configured_db:
            self.set_inspector(configured_db)
            self.set_session_query_tag()
            yield configured_db
        else:
            results = self.connection.execute("SHOW DATABASES")
            for res in results:
                row = list(res)
                new_database = row[1]

                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=new_database
                ):
                    self.status.filter(new_database, "Database pattern not allowed")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    self.set_session_query_tag()
                    yield new_database
                except Exception as err:
                    logger.error(
                        f"Error trying to connect to database {new_database} - {err}"
                    )

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:

        try:
            result = self.connection.execute(
                SNOWFLAKE_FETCH_ALL_TAGS.format(
                    database_name=self.context.database.name.__root__,
                    schema_name=schema_name,
                )
            )

        except Exception as err:
            logger.error(f"Error fetching tags {err}. Trying with quoted names")
            result = self.connection.execute(
                SNOWFLAKE_FETCH_ALL_TAGS.format(
                    database_name=f'"{self.context.database.name.__root__}"',
                    schema_name=f'"{self.context.database_schema.name.__root__}"',
                )
            )

        for res in result:
            row = list(res)
            fqn_elements = [name for name in row[2:] if name]
            yield OMetaTagAndCategory(
                fqn=fqn._build(
                    self.context.database_service.name.__root__, *fqn_elements
                ),
                category_name=CreateTagCategoryRequest(
                    name=row[0],
                    description="SNOWFLAKE TAG NAME",
                    categoryType="Descriptive",
                ),
                category_details=CreateTagRequest(
                    name=row[1], description="SNOWFLAKE TAG VALUE"
                ),
            )
