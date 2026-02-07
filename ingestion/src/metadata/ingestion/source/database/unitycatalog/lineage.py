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
Databricks Unity Catalog Lineage Source Module
"""
import traceback
from collections import defaultdict
from typing import Iterable, Optional

from sqlalchemy import text

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import ContainerDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_connection,
    get_sqlalchemy_connection,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_COLUMN_LINEAGE,
    UNITY_CATALOG_EXTERNAL_TABLES,
    UNITY_CATALOG_TABLE_LINEAGE,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UnitycatalogLineageSource(Source):
    """
    Lineage Unity Catalog Source
    """

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config = self.config.sourceConfig.config
        self.connection_obj = get_connection(self.service_connection)
        self.engine = get_sqlalchemy_connection(self.service_connection)
        self.table_lineage_map: dict[str, set[str]] = defaultdict(set)
        self.column_lineage_map: dict[
            tuple[str, str], list[tuple[str, str]]
        ] = defaultdict(list)
        self.external_location_map: dict[str, str] = {}
        self.test_connection()

    def close(self):
        """
        By default, there is nothing to close
        """

    def prepare(self):
        """
        By default, there's nothing to prepare
        """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: UnityCatalogConnection = config.serviceConnection.root.config
        if not isinstance(connection, UnityCatalogConnection):
            raise InvalidSourceException(
                f"Expected UnityCatalogConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _cache_lineage(self):
        """
        Bulk-fetch all table and column lineage from system tables into memory.
        """
        query_log_duration = self.source_config.queryLogDuration or 1
        logger.info(
            f"Caching lineage from system tables (lookback: {query_log_duration} days)"
        )

        try:
            with self.engine.connect() as conn:
                rows = conn.execute(
                    text(
                        UNITY_CATALOG_TABLE_LINEAGE.format(
                            query_log_duration=query_log_duration
                        )
                    )
                )
                for row in rows:
                    self.table_lineage_map[row.target_table_full_name].add(
                        row.source_table_full_name
                    )
            logger.info(
                f"Cached table lineage: {sum(len(v) for v in self.table_lineage_map.values())} edges "
                f"for {len(self.table_lineage_map)} target tables"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to cache table lineage: {exc}")

        try:
            with self.engine.connect() as conn:
                rows = conn.execute(
                    text(
                        UNITY_CATALOG_COLUMN_LINEAGE.format(
                            query_log_duration=query_log_duration
                        )
                    )
                )
                for row in rows:
                    table_key = (
                        row.source_table_full_name,
                        row.target_table_full_name,
                    )
                    self.column_lineage_map[table_key].append(
                        (row.source_column_name, row.target_column_name)
                    )
            logger.info(
                f"Cached column lineage: {sum(len(v) for v in self.column_lineage_map.values())} "
                f"column mappings for {len(self.column_lineage_map)} table pairs"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to cache column lineage: {exc}")

    def _cache_external_locations(self):
        """
        Bulk-fetch all external table storage locations from system.information_schema.tables.
        """
        logger.info("Caching external table locations from system tables")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(text(UNITY_CATALOG_EXTERNAL_TABLES))
                for row in rows:
                    table_fqn = (
                        f"{row.table_catalog}.{row.table_schema}.{row.table_name}"
                    )
                    self.external_location_map[table_fqn] = row.storage_path
            logger.info(
                f"Cached {len(self.external_location_map)} external table locations"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to cache external table locations: {exc}")

    def _get_data_model_column_fqn(
        self, data_model_entity: ContainerDataModel, column: str
    ) -> Optional[str]:
        if not data_model_entity:
            logger.debug(f"No data model entity provided for column: {column}")
            return None
        for entity_column in data_model_entity.columns:
            if entity_column.displayName.lower() == column.lower():
                return entity_column.fullyQualifiedName.root
        logger.debug(
            f"Column '{column}' not found in data model with {len(data_model_entity.columns)} columns"
        )
        return None

    def _get_container_column_lineage(
        self, data_model_entity: ContainerDataModel, table_entity: Table
    ) -> Optional[LineageDetails]:
        try:
            column_lineage = []
            for column in table_entity.columns:
                from_column = self._get_data_model_column_fqn(
                    data_model_entity=data_model_entity, column=column.name.root
                )
                to_column = column.fullyQualifiedName.root
                if from_column and to_column:
                    column_lineage.append(
                        ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                    )
            if column_lineage:
                return LineageDetails(
                    columnsLineage=column_lineage,
                    source=LineageSource.ExternalTableLineage,
                )
            return None
        except Exception as exc:
            logger.debug(
                f"Error computing container column lineage for "
                f"{table_entity.fullyQualifiedName.root}: {exc}"
            )
            logger.debug(traceback.format_exc())
            return None

    def _get_column_lineage_details(
        self,
        from_table: Table,
        to_table: Table,
        source_table_fqn: str,
        target_table_fqn: str,
    ) -> Optional[LineageDetails]:
        try:
            table_key = (source_table_fqn, target_table_fqn)
            column_pairs = self.column_lineage_map.get(table_key, [])
            if not column_pairs:
                return None

            col_lineage = []
            for source_col, target_col in column_pairs:
                from_col_fqn = get_column_fqn(from_table, source_col)
                to_col_fqn = get_column_fqn(to_table, target_col)
                if from_col_fqn and to_col_fqn and from_col_fqn != to_col_fqn:
                    col_lineage.append(
                        ColumnLineage(fromColumns=[from_col_fqn], toColumn=to_col_fqn)
                    )

            if col_lineage:
                return LineageDetails(
                    columnsLineage=col_lineage, source=LineageSource.QueryLineage
                )
            return None
        except Exception as exc:
            logger.debug(f"Error computing column lineage: {exc}")
            logger.debug(traceback.format_exc())
            return None

    def _process_external_location_lineage(
        self, table: Table, databricks_table_fqn: str
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Look up external table storage location from cache and create
        container lineage if a matching container is found.
        """
        storage_location = self.external_location_map.get(databricks_table_fqn)
        if not storage_location:
            return

        try:
            storage_location = storage_location.rstrip("/")
            location_entity = self.metadata.es_search_container_by_path(
                full_path=storage_location, fields="dataModel"
            )

            if location_entity and location_entity[0]:
                lineage_details = None
                if location_entity[0].dataModel:
                    lineage_details = self._get_container_column_lineage(
                        location_entity[0].dataModel, table
                    )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=location_entity[0].id,
                                type="container",
                            ),
                            toEntity=EntityReference(
                                id=table.id,
                                type="table",
                            ),
                            lineageDetails=lineage_details,
                        )
                    ),
                )
        except Exception as exc:
            logger.debug(
                f"Error processing external location lineage for "
                f"{databricks_table_fqn}: {exc}"
            )
            logger.debug(traceback.format_exc())

    def _process_table_lineage(
        self, table: Table, databricks_table_fqn: str
    ) -> Iterable[Either[AddLineageRequest]]:
        upstream_tables = self.table_lineage_map.get(databricks_table_fqn, set())

        for source_table_full_name in upstream_tables:
            try:
                parts = source_table_full_name.split(".")
                if len(parts) != 3:
                    logger.debug(
                        f"Skipping malformed source table name: {source_table_full_name}"
                    )
                    continue
                catalog_name, schema_name, table_name = parts

                from_entity_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    database_name=catalog_name,
                    schema_name=schema_name,
                    table_name=table_name,
                    service_name=self.config.serviceName,
                )

                from_entity = self.metadata.get_by_name(
                    entity=Table, fqn=from_entity_fqn
                )
                if not from_entity:
                    logger.debug(
                        f"Unable to find upstream entity: {source_table_full_name} "
                        f"-> {databricks_table_fqn}"
                    )
                    continue

                lineage_details = self._get_column_lineage_details(
                    from_table=from_entity,
                    to_table=table,
                    source_table_fqn=source_table_full_name,
                    target_table_fqn=databricks_table_fqn,
                )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            toEntity=EntityReference(id=table.id, type="table"),
                            fromEntity=EntityReference(id=from_entity.id, type="table"),
                            lineageDetails=lineage_details,
                        )
                    ),
                )
            except Exception as exc:
                logger.debug(
                    f"Error processing lineage {source_table_full_name} "
                    f"-> {databricks_table_fqn}: {exc}"
                )
                logger.debug(traceback.format_exc())

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest]]:
        """
        Fetch lineage from system tables for both table-to-table
        and external location lineage.
        """
        self._cache_lineage()
        self._cache_external_locations()

        for database in self.metadata.list_all_entities(
            entity=Database, params={"service": self.config.serviceName}
        ):
            if filter_by_database(
                self.source_config.databaseFilterPattern, database.name.root
            ):
                self.status.filter(
                    database.fullyQualifiedName.root,
                    "Catalog Filtered Out",
                )
                continue
            for schema in self.metadata.list_all_entities(
                entity=DatabaseSchema,
                params={"database": database.fullyQualifiedName.root},
            ):
                if filter_by_schema(
                    self.source_config.schemaFilterPattern, schema.name.root
                ):
                    self.status.filter(
                        schema.fullyQualifiedName.root,
                        "Schema Filtered Out",
                    )
                    continue
                for table in self.metadata.list_all_entities(
                    entity=Table,
                    params={"databaseSchema": schema.fullyQualifiedName.root},
                ):
                    if filter_by_table(
                        self.source_config.tableFilterPattern, table.name.root
                    ):
                        self.status.filter(
                            table.fullyQualifiedName.root,
                            "Table Filtered Out",
                        )
                        continue

                    databricks_table_fqn = f"{table.database.name}.{table.databaseSchema.name}.{table.name.root}"

                    yield from self._process_table_lineage(table, databricks_table_fqn)

                    yield from self._process_external_location_lineage(
                        table, databricks_table_fqn
                    )

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )
