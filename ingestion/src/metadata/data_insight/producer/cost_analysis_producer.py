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
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()


class CostAnalysisProducer(ProducerInterface):
    """entity producer class"""

    def _check_profiler_and_usage_support(
        self, database_service: DatabaseService
    ) -> bool:
        return (
            hasattr(database_service.connection.config, "supportsUsageExtraction")
            and database_service.connection.config.supportsUsageExtraction.__root__
            and hasattr(database_service.connection.config, "supportsProfiler")
            and database_service.connection.config.supportsProfiler.__root__
        )

    # pylint: disable=dangerous-default-value
    def fetch_data(self, limit=100, fields=["*"]) -> Iterable:
        database_services = self.metadata.list_all_entities(
            DatabaseService, limit=limit, fields=fields, skip_on_failure=True
        )
        entities_list = []
        for database_service in database_services or []:
            try:
                if self._check_profiler_and_usage_support(database_service):
                    entities_list.extend(
                        self.metadata.list_all_entities(
                            Table,
                            limit=limit,
                            fields=fields,
                            skip_on_failure=True,
                            params={
                                "database": database_service.fullyQualifiedName.__root__
                            },
                        )
                    )
            except Exception as err:
                logger.error(f"Error trying to fetch entities -- {err}")
                logger.debug(traceback.format_exc())
        return entities_list
