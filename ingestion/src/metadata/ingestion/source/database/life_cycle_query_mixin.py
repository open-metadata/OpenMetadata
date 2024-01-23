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
Mixin class with common Life Cycle logic.
"""
import traceback
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
from typing import Dict, Iterable, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.topology import TopologyContext
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

logger = ingestion_logger()


class LifeCycleQueryByTable(BaseModel):
    """
    Query executed get life cycle
    """

    table_name: str = Field(..., alias="TABLE_NAME")
    created_at: Optional[datetime] = Field(..., alias="CREATED_AT")

    class Config:
        allow_population_by_field_name = True


class LifeCycleQueryMixin:
    """
    Module stores the methods to query the sources and get life cycle information
    """

    context: TopologyContext
    status: Status
    source_config: DatabaseServiceMetadataPipeline
    engine: Engine
    metadata: OpenMetadata

    @lru_cache(
        maxsize=1
    )  # Limit the caching to 1 since we will maintain 1 dictionary for each db and schema
    def life_cycle_query_dict(
        self, query: str
    ) -> Dict[str, List[LifeCycleQueryByTable]]:
        """
        Cache the queries ran for the life cycle.
        We will run this for each different schema and db name.
        The dictionary key will be the case-insensitive table name.
        """
        results = self.engine.execute(query).all()
        queries_dict = defaultdict()

        for row in results:
            try:
                life_cycle_by_table = LifeCycleQueryByTable.parse_obj(dict(row))
                queries_dict[life_cycle_by_table.table_name] = life_cycle_by_table
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name="Life Cycle Queries",
                        error=f"Error trying to get life cycle information due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        return queries_dict

    def get_life_cycle_data(self, entity: Entity, query: str):
        """
        Get the life cycle data
        """
        if entity:
            try:
                life_cycle_data = self.life_cycle_query_dict(query=query).get(
                    entity.name.__root__
                )
                if life_cycle_data:
                    life_cycle = LifeCycle(
                        created=AccessDetails(
                            timestamp=convert_timestamp_to_milliseconds(
                                life_cycle_data.created_at.timestamp()
                            )
                        )
                    )
                    yield Either(
                        right=OMetaLifeCycleData(entity=entity, life_cycle=life_cycle)
                    )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=entity.name.__root__,
                        error=f"Unable to get the table life cycle data for table {entity.name.__root__}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the table
        """
        try:
            table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=self.context.database_service,
                database_name=self.context.database,
                schema_name=self.context.database_schema,
                table_name=self.context.table,
                skip_es_search=True,
            )
            table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
            if table:
                yield from self.get_life_cycle_data(
                    entity=table,
                    query=self.life_cycle_query.format(
                        database_name=table.database.name,
                        schema_name=table.databaseSchema.name,
                    ),
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="lifeCycle",
                    error=f"Error Processing life cycle data: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
