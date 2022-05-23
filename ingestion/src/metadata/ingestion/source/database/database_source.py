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
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple, Union

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
from metadata.ingestion.ometa.utils import ometa_logger
from metadata.orm_profiler.orm.converter import ometa_to_orm
from metadata.orm_profiler.profiler.default import DefaultProfiler
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.fqdn_generator import get_fqdn

logger = ometa_logger()


@dataclass  # type: ignore[misc]
class DatabaseSourceService(Source, metaclass=ABCMeta):
    @abstractmethod
    def get_databases(self) -> Iterable[Inspector]:
        """
        Method Yields Inspector objects for each aviable database
        """
        pass

    @abstractmethod
    def get_schemas(self, inspector: Inspector) -> str:
        """
        Method Yields schemas aviable in database
        """
        pass

    @abstractmethod
    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        """
        Method formats Table & Schema names if required
        """
        pass

    @abstractmethod
    def _get_table_description(
        self, schema: str, table_name: str, table_type: str, inspector: Inspector
    ) -> str:
        """
        Method returns the table level comment
        """
        pass

    @abstractmethod
    def _is_partition(self, table_name: str, schema: str, inspector: Inspector) -> bool:
        """
        Method to check if the table is partitioned table
        """
        pass

    @abstractmethod
    def _get_data_model(self, database: str, schema: str, table_name: str) -> DataModel:
        pass

    @abstractmethod
    def fetch_sample_data(self, schema: str, table_name: str) -> Optional[TableData]:
        """
        Method to fetch sample data form table
        """
        pass

    @abstractmethod
    def get_table_names(self, schema: str, inspector: Inspector) -> Optional[List[str]]:
        """
        Method to fetch table & view names
        """
        pass

    @abstractmethod
    def _get_columns(
        self, schema: str, table_name: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Method to fetch table columns data
        """
        pass

    @abstractmethod
    def get_view_definition(table_type, table_name, schema, inspector) -> Optional[str]:
        """
        Method to fetch view definition
        """
        pass

    def _get_database(self, database: Optional[str]) -> Database:
        if not database:
            database = "default"
        return Database(
            name=database,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def _get_schema(self, schema: str, database: Database) -> DatabaseSchema:
        return DatabaseSchema(
            name=schema,
            database=database.service,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )

    def next_record(self) -> Iterable[Entity]:
        for inspector in self.get_databases():
            for schema in self.get_schemas(inspector):
                # clear any previous source database state
                try:
                    self.database_source_state.clear()
                    if filter_by_schema(
                        self.source_config.schemaFilterPattern, schema_name=schema
                    ):
                        self.status.filter(schema, "Schema pattern not allowed")
                        continue

                    if self.source_config.includeTables:
                        yield from self.fetch_tables(inspector, schema)

                    # Comment TO-REMOVE
                    # Removed fetch view in order to unify

                    if self.source_config.markDeletedTables:
                        schema_fqdn = f"{self.config.serviceName}.{self.service_connection.database}.{schema}"
                        yield from self.delete_tables(schema_fqdn)

                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

    def _get_table_entity(
        self, schema: str, table_name: str, table_type: str, inspector: Inspector
    ) -> Table:
        description = self._get_table_description(schema, table_name, inspector)
        self.table_constraints = None
        table_columns = self._get_columns(schema, table_name, inspector)
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
        try:
            if self.source_config.generateSampleData:
                table_data = self.fetch_sample_data(schema, table_name)
                if table_data:
                    table_entity.sampleData = table_data
        # Catch any errors during the ingestion and continue
        except Exception as err:  # pylint: disable=broad-except
            logger.error(repr(err))
            logger.error(err)

        try:
            if self.source_config.enableDataProfiler:
                profile = self.run_profiler(table=table_entity, schema=schema)
                table_entity.tableProfile = [profile] if profile else None
        # Catch any errors during the profile runner and continue
        except Exception as err:
            logger.error(err)
        return table_entity

    # TODO
    # include views logic
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

                if self._is_partition(table_name, schema, inspector):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table is partition",
                    )
                    continue

                table_entity = self._get_table_entity(
                    schema, table_name, table_type, inspector
                )

                database = self._get_database(self.service_connection.database)
                # check if we have any model to associate with
                table_entity.dataModel = self._get_data_model(
                    database.name.__root__, schema, table_name
                )

                table_schema_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database,
                    database_schema=self._get_schema(schema, database),
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
        fqn = get_fqdn(
            Table,
            self.config.serviceName,
            str(table_schema_and_db.database.name.__root__),
            str(table_schema_and_db.database_schema.name.__root__),
            str(table_schema_and_db.table.name.__root__),
        )

        self.database_source_state.add(fqn)
        self.status.scanned(fqn)

    def _build_database_state(self, schema_fqdn: str) -> List[EntityReference]:
        after = None
        tables = []
        while True:
            table_entities = self.metadata.list_entities(
                entity=Table, after=after, limit=100, params={"database": schema_fqdn}
            )
            tables.extend(table_entities.entities)
            if table_entities.after is None:
                break
            after = table_entities.after
        return tables

    def delete_tables(self, schema_fqdn: str) -> DeleteTable:
        database_state = self._build_database_state(schema_fqdn)
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)
