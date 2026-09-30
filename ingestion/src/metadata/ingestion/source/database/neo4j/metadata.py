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
Neo4j source methods.

The graph schema maps onto the database topology as:

    database  -> the Neo4j database
    schemas   -> ``nodes`` and, unless disabled, ``relationships``
    tables    -> node labels / relationship types
    columns   -> their properties, typed from db.schema.*TypeProperties()
"""

import traceback
from collections.abc import Iterable
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.connections.database.neo4jConnection import (
    Neo4jConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import (
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.ingestion.source.database.neo4j.connection import (
    resolve_database,
    run_read,
)
from metadata.ingestion.source.database.neo4j.queries import (
    NEO4J_NODE_TYPE_PROPERTIES,
    NEO4J_REL_TYPE_PROPERTIES,
)
from metadata.ingestion.source.database.neo4j.utils import (
    aggregate_element_types,
    property_to_column,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_column
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from typing_extensions import LiteralString

    from metadata.ingestion.source.database.neo4j.models import GraphElementSpec

logger = ingestion_logger()

NODES_SCHEMA = "nodes"
RELATIONSHIPS_SCHEMA = "relationships"


class Neo4jSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from Neo4j
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.driver = self.connection_obj
        self._database: str | None = None
        # The graph schema of the database being processed, read once: the
        # post-process deletion hooks list the schemas again, and a re-read could
        # disagree with what the walk ingested. Replaced per database.
        self._elements: dict[str, dict[str, GraphElementSpec]] | None = None
        self._failed_schemas: set[str] = set()

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config if config.serviceConnection else None
        if not isinstance(connection, Neo4jConnection):
            raise InvalidSourceException(f"Expected Neo4jConnection, but got {connection}")
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        self._database = resolve_database(self.driver, self.service_connection)
        self._elements = None
        self._failed_schemas = set()
        yield self._database

    def get_schema_name_list(self) -> list[str]:
        if self._elements is None:
            self._elements = self._read_graph_schema()
        return list(self._elements)

    def _read_graph_schema(self) -> "dict[str, dict[str, GraphElementSpec]]":
        database = self._database
        sources: dict[str, tuple[LiteralString, str]] = {NODES_SCHEMA: (NEO4J_NODE_TYPE_PROPERTIES, "nodeType")}
        if self.service_connection.includeRelationships:
            sources[RELATIONSHIPS_SCHEMA] = (NEO4J_REL_TYPE_PROPERTIES, "relType")
        elements = {}
        for schema_name, (query, type_key) in sources.items():
            try:
                rows = [record.data() for record in run_read(self.driver, query, database)]
            except Exception as exc:
                # Skip the schema rather than yield it empty, and remember it so
                # mark_schemas_as_deleted keeps it: a failed read proves nothing
                # about whether its labels or relationship types still exist.
                self._failed_schemas.add(schema_name)
                self.status.failed(
                    StackTraceError(
                        name=f"{database}.{schema_name}",
                        error=f"Failed to read the {schema_name} schema of database [{database}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
                continue
            elements[schema_name] = {element.name: element for element in aggregate_element_types(rows, type_key)}
        return elements

    def mark_schemas_as_deleted(self):
        for schema_name in self._failed_schemas:
            self.schema_entity_source_state.add(
                fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.config.serviceName,
                    database_name=self._database,
                    schema_name=schema_name,
                )
            )
        yield from super().mark_schemas_as_deleted()

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        return [TableNameAndType(name=name) for name in (self._elements or {}).get(schema_name, {})]

    def get_table_columns(self, schema_name: str, table_name: str) -> list[Column]:
        element = (self._elements or {}).get(schema_name, {}).get(table_name)
        if element is None:
            return []
        columns = []
        for prop in element.properties:
            if filter_by_column(self.service_connection.propertyFilterPattern, prop.name):
                logger.debug(f"Property [{schema_name}.{table_name}.{prop.name}] filtered out")
                continue
            columns.append(property_to_column(prop))
        return columns
