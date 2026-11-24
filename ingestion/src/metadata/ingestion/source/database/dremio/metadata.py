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
Dremio source, read through the REST API: a source or a space is a database,
the folder path below it a schema.
"""

import traceback
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from requests.exceptions import RequestException

from metadata.domain.tags.models import TagDefinition
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, Table, TableType
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import close_on_failure, create_connection
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.dremio.connection import (
    NAMESPACE_TYPES,
    get_catalog,
    get_children,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Datasets at the root of a source or space, outside any folder.
# ADR:2026-11-18-dremio-schema-name-is-the-folder-path-without-its-space
ROOT_SCHEMA = "default"

# Dremio Cloud re-exposes the catalog of the project as sources of these types,
# which would duplicate the real sources and spaces.
INTERNAL_SOURCE_TYPE_PREFIX = "DCS_CORE"

# Dremio does not always report the length of a string or binary column
DEFAULT_LENGTH = 65535
LENGTH_TYPES = {DataType.VARCHAR.value, DataType.CHAR.value, DataType.BINARY.value, DataType.VARBINARY.value}
DREMIO_TYPES = {"LIST": DataType.ARRAY.value}


@dataclass(frozen=True)
class DremioDataset:
    name: str
    table_type: TableType
    resource_id: str | None


def to_column(field: dict, ordinal_position: int | None = None) -> Column:
    """
    A field of the catalog API. STRUCT and LIST carry their fields or element
    in `subSchema`, which keeps the names as they are in Dremio.
    """
    field_type = field.get("type") or {}
    type_name = field_type.get("name", "VARCHAR")
    sub_fields = field_type.get("subSchema") or []
    data_type = DREMIO_TYPES.get(type_name) or ColumnTypeParser.get_column_type(type_name)
    column: dict[str, Any] = {
        "name": field.get("name"),
        "dataType": data_type,
        "dataTypeDisplay": type_name,
        "ordinalPosition": ordinal_position,
    }
    if data_type in LENGTH_TYPES:
        column["dataLength"] = field_type.get("precision", DEFAULT_LENGTH)
    if data_type in (DataType.DECIMAL.value, DataType.NUMERIC.value):
        column["precision"] = field_type.get("precision")
        column["scale"] = field_type.get("scale")
    if data_type == DataType.STRUCT.value:
        column["children"] = [to_column(sub_field) for sub_field in sub_fields]
    if data_type == DataType.ARRAY.value and sub_fields:
        element = to_column({**sub_fields[0], "name": "element"})
        column["arrayDataType"] = element.dataType
        column["children"] = element.children
    return Column(**column)


def quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


class DremioSource(DatabaseServiceSource):
    """
    Extracts the sources, spaces, folders, tables and views of Dremio, with
    their wiki descriptions and collaboration tags.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config
        self.source_config = self.config.sourceConfig.config
        self._connection = create_connection(self.service_connection)
        self.client = self._connection.client

        self._namespace_ids: dict[str, str] = {}
        # The folders and datasets of the database being ingested, read once by
        # get_database_schema_names and dropped when the next database starts.
        self._folder_ids: dict[str, str] = {}
        self._datasets: dict[str, list[DremioDataset]] = {}
        # The folders of the current database that could not be listed
        self._unread_folders: list[str] = []

        with close_on_failure(self._connection):
            self.test_connection()

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None) -> "DremioSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DremioConnection = config.serviceConnection.root.config
        if not isinstance(connection, DremioConnection):
            raise InvalidSourceException(f"Expected DremioConnection, but got {connection}")
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        if self.service_connection.database:
            yield self.service_connection.database
            return

        for item in get_catalog(self.client):
            path = item.get("path") or []
            if item.get("containerType") not in NAMESPACE_TYPES or not path or self._is_internal_source(item):
                continue
            namespace = path[0]
            if self._is_database_filtered(namespace):
                self.status.filter(namespace, "Database Filtered Out")
                continue
            if item.get("id"):
                self._namespace_ids[namespace] = item["id"]
            yield namespace

    def _is_internal_source(self, item: dict) -> bool:
        """Only Dremio Cloud has these sources, and only the detail of a source tells its type"""
        if not self.client.is_cloud or item.get("containerType") != "SOURCE" or not item.get("id"):
            return False
        try:
            response = self.client.get(f"/catalog/{item['id']}")
            source_type = response.json().get("type", "") if response.status_code == 200 else ""
        except (RequestException, ValueError) as exc:
            logger.debug(f"Could not read the type of the Dremio source {item.get('path')}: {exc}")
            return False
        if source_type.startswith(INTERNAL_SOURCE_TYPE_PREFIX):
            logger.info(f"Skipping the internal Dremio source {item['path'][0]} of type {source_type}")
            return True
        return False

    def _get_wiki(self, resource_id: str | None) -> Markdown | None:
        """A catalog object without a wiki answers 404"""
        if not resource_id:
            return None
        try:
            response = self.client.get(f"/catalog/{resource_id}/collaboration/wiki")
            text = response.json().get("text") if response.status_code == 200 else None
        except (RequestException, ValueError) as exc:
            logger.debug(f"Could not read the Dremio wiki of {resource_id}: {exc}")
            return None
        return Markdown(text) if text else None

    def yield_database(self, database_name: str) -> Iterable[Either[CreateDatabaseRequest]]:
        database_request = CreateDatabaseRequest(
            name=EntityName(database_name),
            service=FullyQualifiedEntityName(self.context.get().database_service),
            description=self._get_wiki(self._namespace_ids.get(database_name)),
        )
        yield Either(right=database_request)
        self.register_record_database_request(database_request=database_request)

    def _read_namespace(self, namespace: str) -> None:
        """
        Walk every folder of the namespace. A folder path is flattened into one
        schema name: `namespace/a/b` is the schema `a.b`.
        """
        self._folder_ids = {}
        self._datasets = defaultdict(list)
        self._unread_folders = []
        folders: list[list[str]] = [[]]
        while folders:
            folder = folders.pop()
            try:
                children = get_children(self.client, [namespace, *folder])
            except (RequestException, ValueError) as exc:
                self._unread_folders.append("/".join([namespace, *folder]))
                self.status.failed(
                    StackTraceError(
                        name="/".join([namespace, *folder]),
                        error=f"Failed to list the Dremio folder, its datasets are skipped: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
                continue
            for child in children:
                path = child.get("path") or []
                if child.get("type") == "DATASET" and len(path) >= 2:
                    table_type = TableType.View if child.get("datasetType") == "VIRTUAL" else TableType.Regular
                    schema_name = ".".join(path[1:-1]) or ROOT_SCHEMA
                    self._datasets[schema_name].append(DremioDataset(path[-1], table_type, child.get("id")))
                elif child.get("type") == "CONTAINER" and child.get("containerType") == "FOLDER" and path:
                    subfolder = [*folder, path[-1]]
                    self._folder_ids[".".join(subfolder)] = child.get("id")
                    folders.append(subfolder)

    def get_raw_database_schema_names(self) -> Iterable[str]:
        """The folders that hold datasets, from the walk of the current database"""
        return sorted(self._datasets)

    def get_database_schema_names(self) -> Iterable[str]:
        self._read_namespace(self.context.get().database)
        yield from self._get_filtered_schema_names()

    def mark_schemas_as_deleted(self) -> Iterable[Either]:
        """
        The schemas below a folder that could not be listed are missing from the
        walk, but not from Dremio: do not mark them as deleted.
        """
        if self._unread_folders:
            logger.warning(
                f"Not marking the schemas of the Dremio database {self.context.get().database} as deleted:"
                f" these folders could not be listed: {', '.join(self._unread_folders)}"
            )
            return
        yield from super().mark_schemas_as_deleted()

    def yield_database_schema(self, schema_name: str) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        schema_request = CreateDatabaseSchemaRequest(
            name=EntityName(schema_name),
            database=FullyQualifiedEntityName(
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                )
            ),
            description=self._get_wiki(self._folder_ids.get(schema_name)),
        )
        yield Either(right=schema_request)
        self.register_record_schema_request(schema_request=schema_request)

    def _get_schema_datasets(self) -> list[DremioDataset]:
        return self._datasets.get(self.context.get().database_schema, [])

    def _is_included(self, dataset: DremioDataset) -> bool:
        if dataset.table_type == TableType.View:
            return self.source_config.includeViews
        return self.source_config.includeTables

    def get_tables_name_and_type(self) -> Iterable[TableNameAndType]:
        for dataset in self._get_schema_datasets():
            if not self._is_included(dataset):
                continue
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.get().database_service,
                database_name=self.context.get().database,
                schema_name=self.context.get().database_schema,
                table_name=dataset.name,
                skip_es_search=True,
            )
            if filter_by_table(
                self.source_config.tableFilterPattern,
                table_fqn if self.source_config.useFqnForFiltering else dataset.name,
            ):
                self.status.filter(table_fqn, "Table Filtered Out")
                continue
            yield TableNameAndType(name=dataset.name, type_=dataset.table_type)

    def _get_dataset(self, table_name: str) -> dict:
        """Dremio Cloud rejects by-path for datasets: read them by id"""
        dataset = next((item for item in self._get_schema_datasets() if item.name == table_name), None)
        response = self.client.get(f"/catalog/{dataset.resource_id}") if dataset and dataset.resource_id else None
        if response is None:
            schema_name = self.context.get().database_schema
            folders = [] if schema_name == ROOT_SCHEMA else schema_name.split(".")
            path = [self.context.get().database, *folders, table_name]
            response = self.client.get(f"/catalog/by-path/{'/'.join(quote(part, safe='') for part in path)}")
        response.raise_for_status()
        return response.json()

    def yield_table(self, table_name_and_type: TableNameAndType) -> Iterable[Either[CreateTableRequest]]:
        table_name, table_type = table_name_and_type.name, table_name_and_type.type_
        try:
            table_data = self._get_dataset(table_name)
            view_sql = table_data.get("sql") if table_type == TableType.View else None
            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                columns=[to_column(field, position) for position, field in enumerate(table_data.get("fields", []), 1)],
                # As the other connectors do, so that the lineage parser has the view as target
                schemaDefinition=f"CREATE VIEW {quote_identifier(table_name)} AS {view_sql}" if view_sql else None,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                ),
                description=self._get_wiki(table_data.get("id")),
                tags=self.get_tag_labels(table_name) if self.source_config.includeTags else None,
            )
            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Error processing table {table_name}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_tag(self, schema_name: str) -> Iterable[Either]:
        """Register the collaboration tags of the datasets of the schema"""
        if not self.source_config.includeTags:
            return
        for dataset in self._datasets.get(schema_name, []):
            for tag_name in self._get_tags(dataset.resource_id):
                table_fqn = fqn.build(
                    self.metadata,
                    Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=dataset.name,
                    skip_es_search=True,
                )
                yield from self.register_tag(
                    entity_fqn=table_fqn,
                    definition=TagDefinition(
                        classification_name="DremioTags",
                        tag_name=tag_name,
                        classification_description="Tags synchronized from Dremio Cloud collaboration tags",
                        tag_description="Tag from Dremio Cloud collaboration tags",
                    ),
                )

    def _get_tags(self, resource_id: str | None) -> list[str]:
        if not resource_id:
            return []
        try:
            response = self.client.get(f"/catalog/{resource_id}/collaboration/tag")
            tags = response.json().get("tags", []) if response.status_code == 200 else []
        except (RequestException, ValueError, AttributeError) as exc:
            logger.debug(f"Could not read the Dremio tags of {resource_id}: {exc}")
            return []
        return list(dict.fromkeys(tag for tag in tags if isinstance(tag, str))) if isinstance(tags, list) else []

    def get_stored_procedures(self) -> Iterable[Any]:
        """Dremio has no stored procedures"""
        return []

    def yield_stored_procedure(self, stored_procedure: Any) -> Iterable[Either[CreateStoredProcedureRequest]]:
        yield from ()

    def standardize_schema_table_names(self, schema: str, table: str) -> tuple:
        """Dremio is case-sensitive"""
        return schema, table
