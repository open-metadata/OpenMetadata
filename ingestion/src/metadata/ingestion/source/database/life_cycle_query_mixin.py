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
from typing import Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.topology import TopologyContext
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

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
