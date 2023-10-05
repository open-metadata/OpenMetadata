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
Producer class for data insight entity reports
"""

import traceback
from typing import Iterable

from metadata.data_insight.producer.producer_interface import ProducerInterface
from metadata.generated.schema.entity.data import (
    chart,
    container,
    dashboard,
    database,
    databaseSchema,
    mlmodel,
    pipeline,
    searchIndex,
    storedProcedure,
    table,
    topic,
)
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()


class EntityProducer(ProducerInterface):
    """entity producer class"""

    entities = [
        chart.Chart,
        dashboard.Dashboard,
        database.Database,
        databaseSchema.DatabaseSchema,
        mlmodel.MlModel,
        pipeline.Pipeline,
        table.Table,
        topic.Topic,
        container.Container,
        storedProcedure.StoredProcedure,
        searchIndex.SearchIndex,
    ]

    # pylint: disable=dangerous-default-value
    def fetch_data(self, limit=100, fields=["*"]) -> Iterable:
        for entity in self.entities:
            try:
                yield from self.metadata.list_all_entities(
                    entity, limit=limit, fields=fields, skip_on_failure=True
                )
            except Exception as err:
                logger.error(f"Error trying to fetch entity -- {err}")
                logger.debug(traceback.format_exc())


class EntityProducerTable(EntityProducer):
    """entity producer class for table"""

    entities = [table.Table]
