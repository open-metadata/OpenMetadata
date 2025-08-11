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
Generic source to build database connectors.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Set, Tuple

from sqlalchemy.engine import Engine
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SqlAlchemySource(ABC):
    """
    Sqlalchemy Source Abstract Class
    """

    engine: Engine
    metadata: OpenMetadata
    context: TopologyContextManager
    database_source_state: Set
    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource

    @abstractmethod
    def standardize_table_name(self, schema_name: str, table: str) -> Tuple[str, str]:
        """
        Method formats Table names if required
        """

    @abstractmethod
    def set_inspector(self, database_name: str) -> None:
        """
        Sets the inspector in the Source that will be
        used to process metadata
        """

    @staticmethod
    @abstractmethod
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        """
        Method returns the table level comment
        """

    @abstractmethod
    def get_columns_and_constraints(
        self, schema_name: str, table_name: str, inspector: Inspector
    ) -> Optional[List[Column]]:
        """
        Method to fetch table columns data
        """

    @abstractmethod
    def get_schema_definition(
        self, table_type, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        """
        Method to fetch schema definition
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
