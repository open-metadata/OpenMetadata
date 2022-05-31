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
Generic source to build database connectors.
"""
import traceback
import uuid
from abc import ABC, abstractmethod
from typing import Iterable, List, Optional, Tuple, Union

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline

from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    Table,
    TableData,
    TableProfile,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiler.default import DefaultProfiler
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SqlAlchemySource(Source, ABC):

    source_config: DatabaseServiceMetadataPipeline

    @abstractmethod
    def get_databases(self) -> Iterable[Inspector]:
        """
        Method Yields Inspector objects for each aviable database
        """

    @abstractmethod
    def get_schemas(self, inspector: Inspector) -> str:
        """
        Method Yields schemas aviable in database
        """

    @abstractmethod
    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        """
        Method formats Table & Schema names if required
        """

    @abstractmethod
    def get_table_description(
        self, schema: str, table_name: str, table_type: str, inspector: Inspector
    ) -> str:
        """
        Method returns the table level comment
        """

    @abstractmethod
    def is_partition(self, table_name: str, schema: str, inspector: Inspector) -> bool:
        """
        Method to check if the table is partitioned table
        """

    @abstractmethod
    def get_data_model(self, database: str, schema: str, table_name: str) -> DataModel:
        """
        Method to fetch data modles
        """

    @abstractmethod
    def fetch_sample_data(self, schema: str, table_name: str) -> Optional[TableData]:
        """
        Method to fetch sample data form table
        """

    @abstractmethod
    def get_table_names(
        self, schema: str, inspector: Inspector
    ) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Method to fetch table & view names
        """

    @abstractmethod
    def get_columns(
        self, schema: str, table_name: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Method to fetch table columns data
        """

    @abstractmethod
    def get_view_definition(
        table_type, table_name: str, schema: str, inspector: Inspector
    ) -> Optional[str]:
        """
        Method to fetch view definition
        """

    @abstractmethod
    def fetch_column_tags(self, column: dict, col_obj: Column) -> None:
        """
        Method to fetch tags associated with column
        """

    @abstractmethod
    def fetch_table_tags(
        self, table_name: str, schema: str, inspector: Inspector
    ) -> None:
        """
        Method to fetch tags associated with table
        """

    def _get_database_name(self) -> str:
        if hasattr(self.service_connection, "database"):
            return self.service_connection.database or "default"
        return "default"

    def get_database_entity(self) -> Database:
        """
        Method to get database enetity from db name
        """
        return Database(
            name=self._get_database_name(),
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def get_schema_entity(self, schema: str, database: Database) -> DatabaseSchema:
        """
        Method to get DatabaseSchema enetity from schema name and database entity
        """
        return DatabaseSchema(
            name=schema,
            database=database.service,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def next_record(self) -> Iterable[Entity]:
        """
        Method to fetch all tables, views & mark deleet tables
        """
        for inspector in self.get_databases():
            for schema in self.get_schemas(inspector):
                try:
                    # clear any previous source database state
                    self.database_source_state.clear()
                    if filter_by_schema(
                        self.source_config.schemaFilterPattern, schema_name=schema
                    ):
                        self.status.filter(schema, "Schema pattern not allowed")
                        continue

                    if self.source_config.includeTables:
                        yield from self.fetch_tables(inspector, schema)

                    if self.source_config.markDeletedTables:
                        schema_fqn = fqn.build(
                            self.metadata,
                            entity_type=DatabaseSchema,
                            service_name=self.config.serviceName,
                            database_name=self._get_database_name(),
                            schema_name=schema,
                        )
                        yield from self.delete_tables(schema_fqn)

                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

    def _get_table_entity(
        self, schema: str, table_name: str, table_type: str, inspector: Inspector
    ) -> Table:
        """
        Method to get table entity
        """
        description = self.get_table_description(schema, table_name, inspector)
        self.table_constraints = None
        table_columns = self.get_columns(schema, table_name, inspector)
        table_entity = Table(
            id=uuid.uuid4(),
            name=table_name,
            tableType=table_type,
            description=description,
            columns=table_columns,
            viewDefinition=self.get_view_definition(
                table_type, table_name, schema, inspector
            ),
        )
        if self.table_constraints:
            table_entity.tableConstraints = self.table_constraints

        return table_entity

    def fetch_tables(
        self, inspector: Inspector, schema: str
    ) -> Iterable[Union[OMetaDatabaseAndTable, OMetaTagAndCategory]]:
        """
        Scrape an SQL schema and prepare Database and Table
        OpenMetadata Entities
        """
        for table_name, table_type in self.get_table_names(schema, inspector):
            try:
                schema, table_name = self.standardize_schema_table_names(
                    schema, table_name
                )
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue
                if self.is_partition(table_name, schema, inspector):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table is partition",
                    )
                    continue

                table_entity = self._get_table_entity(
                    schema, table_name, table_type, inspector
                )

                database = self.get_database_entity()
                # check if we have any model to associate with
                table_entity.dataModel = self.get_data_model(
                    database.name.__root__, schema, table_name
                )

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
                self.status.failures.append(
                    "{}.{}".format(self.config.serviceName, table_name)
                )

    def run_profiler(self, table: Table, schema: str) -> Optional[TableProfile]:
        """
        Convert the table to an ORM object and run the ORM
        profiler.

        :param table: Table Entity to be ingested
        :param schema: Table schema
        :return: TableProfile
        """
        try:
            orm = ometa_to_orm(table=table, schema=schema)
            profiler = DefaultProfiler(
                session=self.session, table=orm, profile_date=self.profile_date
            )
            profiler.execute()
            return profiler.get_profile()

        # Catch any errors during profiling init and continue ingestion
        except ModuleNotFoundError as err:
            logger.error(
                f"Profiling not available for this databaseService: {str(err)}"
            )
            self.source_config.enableDataProfiler = False

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.debug(f"Error running ingestion profiler {repr(exc)}")

        return None

    def register_record(self, table_schema_and_db: OMetaDatabaseAndTable) -> None:
        """
        Mark the record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.config.serviceName,
            database_name=str(table_schema_and_db.database.name.__root__),
            schema_name=str(table_schema_and_db.database_schema.name.__root__),
            table_name=str(table_schema_and_db.table.name.__root__),
        )

        self.database_source_state.add(table_fqn)
        self.status.scanned(table_fqn)

    def _build_database_state(self, schema_fqn: str) -> List[EntityReference]:
        after = None
        tables = []
        while True:
            table_entities = self.metadata.list_entities(
                entity=Table, after=after, limit=100, params={"database": schema_fqn}
            )
            tables.extend(table_entities.entities)
            if table_entities.after is None:
                break
            after = table_entities.after
        return tables

    def delete_tables(self, schema_fqn: str) -> DeleteTable:
        """
        Returns Deleted tables
        """
        database_state = self._build_database_state(schema_fqn)
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)
