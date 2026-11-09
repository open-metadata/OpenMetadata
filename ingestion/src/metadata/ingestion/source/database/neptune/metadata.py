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
Neptune (openCypher property graph) source methods.

The graph schema maps onto the database topology as:

    database  -> the configured name, or ``default``
    schemas   -> ``nodes`` and, unless disabled, ``relationships``
    tables    -> node labels / edge labels
    columns   -> their properties, typed from neptune.graph.pg_schema()
"""

import traceback
from collections.abc import Iterable

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.connections.database.neptuneConnection import (
    NeptuneConnection as NeptuneConnectionConfig,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import (
    CommonNoSQLSource,
    TableNameAndType,
)
from metadata.ingestion.source.database.neptune.connection import run_query
from metadata.ingestion.source.database.neptune.schema import (
    GraphElementSpec,
    SchemaReader,
    property_to_column,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_column
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

NODES_SCHEMA = "nodes"
RELATIONSHIPS_SCHEMA = "relationships"
DEFAULT_DATABASE_NAME = "default"


class NeptuneSource(CommonNoSQLSource):
    """
    Implements the necessary methods to extract
    Database metadata from Amazon Neptune property graphs
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client = self.connection_obj
        self._database: str | None = None
        # Read once per run: the deletion hooks list the schemas again, and a re-read
        # could disagree with what the walk ingested.
        self._elements: dict[str, dict[str, GraphElementSpec]] | None = None
        self._failed_schemas: set[str] = set()

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config if config.serviceConnection else None
        if not isinstance(connection, NeptuneConnectionConfig):
            raise InvalidSourceException(f"Expected NeptuneConnection, but got {connection}")
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        self._database = self.service_connection.databaseName or DEFAULT_DATABASE_NAME
        self._elements = None
        self._failed_schemas = set()
        yield self._database

    def get_schema_name_list(self) -> list[str]:
        if self._elements is None:
            self._elements = self._read_graph_schema()
        return list(self._elements)

    def _read_graph_schema(self) -> dict[str, dict[str, GraphElementSpec]]:
        connection = self.service_connection
        reader = SchemaReader(
            lambda query: run_query(self.client, query),
            compute_if_missing=connection.computeSchemaIfMissing,
            timeout_seconds=connection.schemaComputeTimeoutSeconds,
        )
        include_relationships = connection.includeRelationships
        try:
            graph = reader.read()
        except Exception as exc:
            # Skip the schemas rather than yield them empty, and keep them out of the
            # deletion sweep: a failed read proves nothing about what still exists.
            self._failed_schemas.update(
                {NODES_SCHEMA, RELATIONSHIPS_SCHEMA} if include_relationships else {NODES_SCHEMA}
            )
            self.status.failed(
                StackTraceError(
                    name=f"{self._database}",
                    error=f"Failed to read the property graph schema of [{self._database}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            return {}
        elements = {NODES_SCHEMA: {element.name: element for element in graph.nodes}}
        if include_relationships:
            elements[RELATIONSHIPS_SCHEMA] = {element.name: element for element in graph.edges}
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
                logger.debug("Property [%s.%s.%s] filtered out", schema_name, table_name, prop.name)
                continue
            columns.append(property_to_column(prop))
        return columns

    def yield_table(self, table_name_and_type) -> Iterable[Either[CreateTableRequest]]:
        schema_name = self.context.get().database_schema
        element = (self._elements or {}).get(schema_name, {}).get(table_name_and_type[0])
        for either in super().yield_table(table_name_and_type):
            if either.right is not None and element is not None and element.endpoints:
                either.right.description = Markdown(
                    "Edge label connecting:\n"
                    + "\n".join(f"- `({source})-[{element.name}]->({target})`" for source, target in element.endpoints)
                )
            yield either
