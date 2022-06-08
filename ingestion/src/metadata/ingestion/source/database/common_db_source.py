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
Generic source to build SQL connectors.
"""

import traceback
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Optional, Tuple

from sqlalchemy.engine import Connection
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dbt_source import DBTSource
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandler
from metadata.ingestion.source.database.sqlalchemy_source import SqlAlchemySource
from metadata.utils.connections import (
    create_and_bind_session,
    get_connection,
    test_connection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class SQLSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Table Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered Table {record} due to {err}")


class CommonDbSourceService(DBTSource, SqlColumnHandler, SqlAlchemySource):
    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        # It will be one of the Unions. We don't know the specific type here.
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()

        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)

        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )
        self.engine: Engine = get_connection(self.service_connection)
        self.test_connection()

        self._session = None  # We will instantiate this just if needed
        self._connection = None  # Lazy init as well
        self.data_profiler = None
        self.data_models = {}
        self.table_constraints = None
        self.database_source_state = set()
        self.profile_date = datetime.now()
        super().__init__()

    def prepare(self):
        self._parse_data_model()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        pass

    def standardize_schema_table_names(
        self, schema: str, table: str
    ) -> Tuple[str, str]:
        return schema, table

    def fetch_sample_data(self, schema: str, table: str) -> Optional[TableData]:
        """
        Get some sample data from the source to be added
        to the Table Entities
        """
        try:
            query = self.source_config.sampleDataQuery.format(schema, table)
            logger.info(query)
            results = self.connection.execute(query)
            cols = [col for col in results.keys()]
            rows = [list(res) for res in results]
            return TableData(columns=cols, rows=rows)
        # Catch any errors and continue the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to generate sample data for {table} - {err}")
        return None

    def get_databases(self) -> Iterable[Inspector]:
        yield inspect(self.engine)

    def get_schemas(self, inspector: Inspector) -> str:
        for schema in inspector.get_schema_names():
            yield schema

    def get_table_description(
        self, schema: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema)
        # Catch any exception without breaking the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.warning(f"Table Description Error : {str(err)}")
        else:
            description = table_info["text"]
        return description

    def is_partition(self, table_name: str, schema: str, inspector: Inspector) -> bool:
        self.inspector = inspector
        return False

    def get_table_names(
        self, schema: str, inspector: Inspector
    ) -> Optional[Iterable[Tuple[str, str]]]:
        if self.source_config.includeTables:
            for table in inspector.get_table_names(schema):
                yield table, "Regular"
        if self.source_config.includeViews:
            for view in inspector.get_view_names(schema):
                yield view, "View"

    def get_view_definition(
        self, table_type: str, table_name: str, schema: str, inspector: Inspector
    ) -> Optional[str]:

        if table_type == "View":
            try:
                view_definition = inspector.get_view_definition(table_name, schema)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                return view_definition
            except NotImplementedError:
                return ""

    def test_connection(self) -> None:
        """
        Used a timed-bound function to test that the engine
        can properly reach the source
        """
        test_connection(self.engine)

    @property
    def session(self) -> Session:
        """
        Return the SQLAlchemy session from the engine
        """
        if not self._session:
            self._session = create_and_bind_session(self.engine)

        return self._session

    @property
    def connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        if not self._connection:
            self._connection = self.engine.connect()

        return self._connection

    def close(self):
        self._create_dbt_lineage()
        if self.connection is not None:
            self.connection.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def fetch_table_tags(
        self, table_name: str, schema: str, inspector: Inspector
    ) -> None:
        """
        Method to fetch tags associated with table
        """
        pass
