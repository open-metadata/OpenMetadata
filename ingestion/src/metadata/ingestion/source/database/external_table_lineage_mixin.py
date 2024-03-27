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
External Table Lineage Mixin
"""

import traceback
from abc import ABC
from typing import Iterable

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
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
                    full_path=location
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
                            )
                        )
                    )
            except Exception as exc:
                logger.warning(f"Failed to yield external table lineage due to - {exc}")
                logger.debug(traceback.format_exc())
