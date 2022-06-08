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
import traceback
import uuid
from typing import Iterable, Union

from snowflake.sqlalchemy.custom_types import VARIANT
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect, ischema_names
from sqlalchemy.engine import reflection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.sql import text

from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.table import Column, Table, TableData
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.column_type_parser import create_sqlalchemy_type
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import (
    FETCH_SNOWFLAKE_ALL_TAGS,
    FETCH_SNOWFLAKE_METADATA,
)

GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
ischema_names["VARIANT"] = VARIANT
ischema_names["GEOGRAPHY"] = GEOGRAPHY

logger = ingestion_logger()


class SnowflakeSource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    def get_all_table_tags(self):
        results = self.connection.execute(
            FETCH_SNOWFLAKE_ALL_TAGS.format(
                self.config.serviceConnection.__root__.config.database
            )
        )
        self.all_table_tags = {}
        self.all_column_tags = {}
        for result in results:
            row = list(result)
            tag_dict = {
                "tag_id": row[2],
                "tag_name": row[3],
                "tag_value": row[4],
                "tag_domain": row[10],
            }
            tag = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=tag_dict["tag_name"],
                    description="SNOWFLAKE COLUMN TAG NAME",
                    categoryType="Descriptive",
                ),
                category_details=CreateTagRequest(
                    name=tag_dict["tag_value"], description="SNOWFLAKE COLUMN TAG VALUE"
                ),
            )
            yield tag
            if tag_dict["tag_domain"] == "TABLE":
                table_name = row[8]
                if self.all_table_tags.get(table_name):
                    self.all_table_tags[table_name].append(tag_dict)
                else:
                    self.all_table_tags[table_name] = [tag_dict]
            else:
                column_name = row[12]
                if self.all_column_tags.get(column_name):
                    self.all_column_tags[column_name].append(tag_dict)
                else:
                    self.all_column_tags[column_name] = [tag_dict]

    def get_databases(self) -> Iterable[Inspector]:
        if self.config.serviceConnection.__root__.config.database:
            yield from super().get_databases()
        else:
            query = "SHOW DATABASES"
            results = self.connection.execute(query)
            for res in results:
                row = list(res)
                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=row[1]
                ):
                    self.status.filter(row[1], "Database pattern not allowed")
                    continue
                use_db_query = f"USE DATABASE {row[1]}"
                self.connection.execute(use_db_query)
                logger.info(f"Ingesting from database: {row[1]}")
                self.config.serviceConnection.__root__.config.database = row[1]
                self.engine = get_connection(self.service_connection)
                yield inspect(self.engine)

    def fetch_column_tags(self, column: dict, col_obj: Column) -> None:
        try:
            tag_category_list = self.all_column_tags.get(col_obj.name.__root__)
            if tag_category_list:
                col_obj.tags = []
                for tag in tag_category_list:
                    col_obj.tags.append(
                        TagLabel(
                            tagFQN=fqn.build(
                                self.metadata,
                                entity_type=Tag,
                                tag_category_name=tag["tag_name"],
                                tag_name=tag["tag_value"],
                            ),
                            labelType="Automated",
                            state="Suggested",
                            source="Tag",
                        )
                    )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.info(err)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[Entity]:
        for inspector in self.get_databases():
            yield from self.get_all_table_tags()
            for schema in inspector.get_schema_names():
                try:
                    if filter_by_schema(
                        self.source_config.schemaFilterPattern, schema_name=schema
                    ):
                        self.status.filter(
                            f"{self.config.serviceName}.{self.service_connection.database}.{schema}",
                            "{} pattern not allowed".format("Schema"),
                        )
                        continue
                    self.connection.execute(
                        f"USE {self.service_connection.database}.{schema}"
                    )
                    yield from self.fetch_tables(inspector=inspector, schema=schema)
                    if self.source_config.markDeletedTables:
                        schema_fqn = f"{self.config.serviceName}.{self.service_connection.database}.{schema}"
                        yield from self.delete_tables(schema_fqn)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.info(err)

    def add_tags_to_table(self, table_name: str, table_entity):
        try:
            tag_category_list = self.all_table_tags.get(table_name)
            if tag_category_list:
                table_entity.tags = []
                for tag in tag_category_list:
                    table_entity.tags.append(
                        TagLabel(
                            tagFQN=fqn.build(
                                self.metadata,
                                entity_type=Tag,
                                tag_category_name=tag["tag_name"],
                                tag_name=tag["tag_value"],
                            ),
                            labelType="Automated",
                            state="Suggested",
                            source="Tag",
                        )
                    )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.info(err)

    def fetch_tables(
        self,
        inspector: Inspector,
        schema: str,
    ) -> Iterable[Union[OMetaDatabaseAndTable, OMetaTagAndCategory]]:
        entities = inspector.get_table_names(schema)
        for table_name, entity_type, comment in entities:
            try:
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{self.service_connection.database}.{schema}.{table_name}",
                        "{} pattern not allowed".format(entity_type),
                    )
                    continue
                if entity_type == "VIEW" and not self.source_config.includeViews:
                    continue
                table_columns = self.get_columns(schema, table_name, inspector)
                view_definition = inspector.get_view_definition(table_name, schema)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                SNOWFLAKE_TABLE_TYPE = "BASE TABLE"
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table_name,
                    tableType="Regular"
                    if entity_type.lower() == SNOWFLAKE_TABLE_TYPE.lower()
                    else "View",
                    description=comment,
                    columns=table_columns,
                    viewDefinition=view_definition,
                )
                self.add_tags_to_table(table_name=table_name, table_entity=table_entity)
                database = self.get_database_entity()
                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database,
                    database_schema=self.get_schema_entity(schema, database),
                )
                self.register_record(table_schema_and_db)
                yield table_schema_and_db
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)


def get_table_names(self, connection, schema, **kw):
    result = connection.execute(FETCH_SNOWFLAKE_METADATA.format(schema))
    return result.fetchall()


@reflection.cache
def _get_table_comment(self, connection, table_name, schema=None, **kw):
    """
    Returns comment of table.
    """
    sql_command = "select * FROM information_schema.tables WHERE TABLE_SCHEMA ILIKE '{}' and TABLE_NAME ILIKE '{}'".format(
        self.normalize_name(schema),
        table_name,
    )

    cursor = connection.execute(text(sql_command))
    return cursor.fetchone()  # pylint: disable=protected-access


@reflection.cache
def get_unique_constraints(self, connection, table_name, schema=None, **kw):
    return []


def normalize_names(self, name):
    return name


SnowflakeDialect.get_table_names = get_table_names
SnowflakeDialect.normalize_name = normalize_names
SnowflakeDialect._get_table_comment = _get_table_comment
SnowflakeDialect.get_unique_constraints = get_unique_constraints
