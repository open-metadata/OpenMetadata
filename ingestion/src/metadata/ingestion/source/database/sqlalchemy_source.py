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
from abc import ABC, abstractmethod
from typing import Iterable, List, Optional, Tuple

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from sqlalchemy.engine import Engine
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SqlAlchemySource(DatabaseServiceSource, ABC):

    engine: Engine

    @abstractmethod
    def standardize_schema_table_names(
        self, schema_name: str, table: str
    ) -> Tuple[str, str]:
        """
        Method formats Table & Schema names if required
        """

    @abstractmethod
    def get_schema_names(self) -> List[str]:
        """
        Method Yields schemas available in database
        """

    @abstractmethod
    def get_table_description(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        """
        Method returns the table level comment
        """

    @abstractmethod
    def is_partition(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> bool:
        """
        Method to check if the table is partitioned table
        """

    @abstractmethod
    def get_data_model(
        self, database: str, schema_name: str, table_name: str
    ) -> DataModel:
        """
        Method to fetch data models
        """

    @abstractmethod
    def get_table_names(
        self, schema_name: str, inspector: Inspector
    ) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Method to fetch table & view names
        """

    @abstractmethod
    def get_columns_and_constraints(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Method to fetch table columns data
        """

    @abstractmethod
    def get_view_definition(
        self, table_type, table_name: str, schema_name: str, inspector: Inspector
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
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> None:
        """
        Method to fetch tags associated with table
        """

    def register_record(self, table_request: CreateTableRequest) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_request.name.__root__,
        )

        self.database_source_state.add(table_fqn)
        self.status.scanned(table_fqn)

    def _build_database_state(self, schema_fqn: str) -> List[Table]:
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

    def delete_schema_tables(self, schema_fqn: str) -> Iterable[DeleteTable]:
        """
        Returns Deleted tables
        """
        database_state = self._build_database_state(schema_fqn)
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        # TODO: GET THIS RIGHT
        if self.source_config.markDeletedTables:
            logger.info("Mark Deleted Tables set to True. Processing...")
            for schema_name in self.get_schema_names():

                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.config.serviceName,
                    database_name=self.context.database.name.__root__,
                    schema_name=schema_name,
                )

                yield from self.delete_schema_tables(schema_fqn)
