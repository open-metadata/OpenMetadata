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
External Table Lineage Mixin
"""

import traceback
from abc import ABC
from typing import Iterable, List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import ContainerDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ExternalTableLineageMixin(ABC):
    """
    This mixin class is for deriving lineage between external table and container source/
    """

    def yield_external_table_lineage(self) -> Iterable[AddLineageRequest]:
        """
        Yield external table lineage from multiple sources:
        1. system.access.table_lineage (usage-based lineage)
        2. DESCRIBE TABLE EXTENDED (table metadata)
        """
        if (
            hasattr(self, "external_location_manager")
            and self.external_location_manager
        ):
            yield from self._yield_lineage_from_manager()
        else:
            yield from self._yield_lineage_from_dicts()

    def _yield_lineage_from_manager(self) -> Iterable[AddLineageRequest]:
        """Yield lineage using ExternalLocationManager (new approach)"""
        logger.info(
            f"Processing {self.external_location_manager.location_count} external table locations from manager"
        )

        for location in self.external_location_manager.iter_locations():
            try:
                database_name, schema_name, table_name = location.qualified_name
                logger.info(
                    f"Searching for container with path: {location.storage_path} for table {database_name}.{schema_name}.{table_name}"
                )

                container_entity = self._find_container_for_path(location.storage_path)
                if not container_entity:
                    logger.warning(
                        f"No container found with path '{location.storage_path}' for table {database_name}.{schema_name}.{table_name}"
                    )
                    continue

                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name,
                    skip_es_search=True,
                )
                table_entity = self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=table_fqn,
                )

                if not table_entity or len(table_entity) == 0:
                    logger.warning(f"Table entity not found in ES: {table_fqn}")
                    continue

                table_entity_obj = table_entity[0]

                logger.info(
                    f"Found container {container_entity.fullyQualifiedName.root if container_entity.fullyQualifiedName else container_entity.name.root} "
                    f"for table {table_fqn}"
                )

                ext_metadata = self.external_location_manager.get_metadata_for_path(
                    location.storage_path
                )
                if ext_metadata:
                    logger.info(
                        f"External location: {ext_metadata.name} "
                        f"(owner: {ext_metadata.owner}, credential: {ext_metadata.credential_name})"
                    )

                columns_list = [column.name.root for column in table_entity_obj.columns]
                columns_lineage = self._get_column_lineage(
                    container_entity.dataModel, table_entity_obj, columns_list
                )

                if columns_lineage:
                    if len(columns_lineage) < len(columns_list):
                        logger.warning(
                            f"Partial column match: {len(columns_lineage)}/{len(columns_list)} columns matched "
                            f"between container and table {database_name}.{schema_name}.{table_name}"
                        )
                    logger.info(
                        f"Created lineage with {len(columns_lineage)} column mappings between "
                        f"container and table {database_name}.{schema_name}.{table_name}"
                    )
                else:
                    logger.info(
                        f"Created lineage without column mappings (container has no dataModel or columns don't match) "
                        f"for table {database_name}.{schema_name}.{table_name}"
                    )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=container_entity.id,
                                type="container",
                            ),
                            toEntity=EntityReference(
                                id=table_entity_obj.id,
                                type="table",
                            ),
                            lineageDetails=LineageDetails(
                                source=LineageSource.ExternalTableLineage,
                                columnsLineage=columns_lineage,
                            ),
                        )
                    )
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to yield external table lineage for {location.qualified_name} with location {location.storage_path}: {exc}"
                )
                logger.debug(traceback.format_exc())

    def _yield_lineage_from_dicts(self) -> Iterable[AddLineageRequest]:
        """Yield lineage using dict-based approach (legacy/fallback)"""
        merged_locations = {}

        if hasattr(self, "external_location_lineage_map"):
            merged_locations.update(self.external_location_lineage_map)
            logger.info(
                f"Found {len(self.external_location_lineage_map)} external locations from system.access.table_lineage"
            )

        if hasattr(self, "external_location_map"):
            for key, value in self.external_location_map.items():
                if key not in merged_locations:
                    merged_locations[key] = value
            logger.info(
                f"Found {len(self.external_location_map)} external locations from DESCRIBE TABLE"
            )

        logger.info(
            f"Processing external table lineage for {len(merged_locations)} tables with external locations (merged from all sources)"
        )

        for table_qualified_tuple, location in merged_locations.items() or []:
            try:
                database_name, schema_name, table_name = table_qualified_tuple
                logger.info(
                    f"Searching for container with path: {location} for table {database_name}.{schema_name}.{table_name}"
                )

                location_entity = self.metadata.es_search_container_by_path(
                    full_path=location, fields="dataModel"
                )

                if (not location_entity or len(location_entity) == 0) and hasattr(
                    self, "get_base_path_from_partitioned_path"
                ):
                    base_path = self.get_base_path_from_partitioned_path(location)
                    if base_path:
                        logger.info(
                            f"No container found with full path, trying base path: {base_path}"
                        )
                        location_entity = self.metadata.es_search_container_by_path(
                            full_path=base_path, fields="dataModel"
                        )
                        if location_entity and len(location_entity) > 0:
                            logger.info(
                                f"Found container using base path for partitioned table {database_name}.{schema_name}.{table_name}"
                            )

                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=database_name,
                    schema_name=schema_name,
                    table_name=table_name,
                    skip_es_search=True,
                )
                table_entity = self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=table_fqn,
                )

                if not location_entity or len(location_entity) == 0:
                    logger.warning(
                        f"No container found with path '{location}' for table {database_name}.{schema_name}.{table_name}"
                    )
                    continue

                if not table_entity or len(table_entity) == 0:
                    logger.warning(f"Table entity not found in ES: {table_fqn}")
                    continue

                container_entity = location_entity[0]
                table_entity_obj = table_entity[0]

                logger.info(
                    f"Found container {container_entity.fullyQualifiedName.root if container_entity.fullyQualifiedName else container_entity.name.root} "
                    f"for table {table_fqn}"
                )

                if hasattr(self, "external_locations_metadata"):
                    external_loc_metadata = self.external_locations_metadata.get(
                        location
                    )
                    if external_loc_metadata:
                        logger.info(
                            f"External location metadata found: {external_loc_metadata.get('name')} "
                            f"(owner: {external_loc_metadata.get('owner')}, "
                            f"credential: {external_loc_metadata.get('credential')})"
                        )

                columns_list = [column.name.root for column in table_entity_obj.columns]
                columns_lineage = self._get_column_lineage(
                    container_entity.dataModel, table_entity_obj, columns_list
                )

                if columns_lineage:
                    if len(columns_lineage) < len(columns_list):
                        logger.warning(
                            f"Partial column match: {len(columns_lineage)}/{len(columns_list)} columns matched "
                            f"between container and table {database_name}.{schema_name}.{table_name}"
                        )
                    logger.info(
                        f"Created lineage with {len(columns_lineage)} column mappings between "
                        f"container and table {database_name}.{schema_name}.{table_name}"
                    )
                else:
                    logger.info(
                        f"Created lineage without column mappings (container has no dataModel or columns don't match) "
                        f"for table {database_name}.{schema_name}.{table_name}"
                    )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=container_entity.id,
                                type="container",
                            ),
                            toEntity=EntityReference(
                                id=table_entity_obj.id,
                                type="table",
                            ),
                            lineageDetails=LineageDetails(
                                source=LineageSource.ExternalTableLineage,
                                columnsLineage=columns_lineage,
                            ),
                        )
                    )
                )
            except Exception as exc:
                logger.warning(
                    f"Failed to yield external table lineage for {table_qualified_tuple} with location {location}: {exc}"
                )
                logger.debug(traceback.format_exc())

    def _get_data_model_column_fqn(
        self, data_model_entity: ContainerDataModel, column: str
    ) -> Optional[str]:
        """
        Get fqn of column if exist in data model entity
        """
        if not data_model_entity:
            return None
        for entity_column in data_model_entity.columns:
            if entity_column.displayName.lower() == column.lower():
                return entity_column.fullyQualifiedName.root
        return None

    def _get_column_lineage(
        self,
        data_model_entity: ContainerDataModel,
        table_entity: Table,
        columns_list: List[str],
    ) -> List[ColumnLineage]:
        """
        Get the column lineage
        """
        try:
            column_lineage = []
            for field in columns_list or []:
                from_column = self._get_data_model_column_fqn(
                    data_model_entity=data_model_entity, column=field
                )
                to_column = get_column_fqn(table_entity=table_entity, column=field)
                if from_column and to_column:
                    column_lineage.append(
                        ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                    )
            return column_lineage
        except Exception as exc:
            logger.debug(f"Error to get column lineage: {exc}")
            logger.debug(traceback.format_exc())

    def _find_container_for_path(self, path: str) -> Optional:
        """
        Find container entity for storage path with partitioned path fallback.

        Args:
            path: Storage path

        Returns:
            Container entity if found
        """
        location_entity = self.metadata.es_search_container_by_path(
            full_path=path, fields="dataModel"
        )

        if location_entity and len(location_entity) > 0:
            return location_entity[0]

        if hasattr(self, "get_base_path_from_partitioned_path"):
            base_path = self.get_base_path_from_partitioned_path(path)
            if base_path:
                logger.info(
                    f"No container found with full path, trying base path: {base_path}"
                )
                location_entity = self.metadata.es_search_container_by_path(
                    full_path=base_path, fields="dataModel"
                )
                if location_entity and len(location_entity) > 0:
                    logger.info("Found container using base path for partitioned table")
                    return location_entity[0]

        return None
