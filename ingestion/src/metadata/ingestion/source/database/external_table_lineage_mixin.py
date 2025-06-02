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
        Yield external table lineage
        """
        for table_qualified_tuple, location in self.external_location_map.items() or []:
            try:
                location_entity = self.metadata.es_search_container_by_path(
                    full_path=location, fields="dataModel"
                )
                database_name, schema_name, table_name = table_qualified_tuple

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

                if (
                    location_entity
                    and location_entity[0]
                    and table_entity
                    and table_entity[0]
                ):
                    columns_list = [
                        column.name.root for column in table_entity[0].columns
                    ]
                    columns_lineage = self._get_column_lineage(
                        location_entity[0].dataModel, table_entity[0], columns_list
                    )
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=location_entity[0].id,
                                    type="container",
                                ),
                                toEntity=EntityReference(
                                    id=table_entity[0].id,
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
                logger.warning(f"Failed to yield external table lineage due to - {exc}")
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
