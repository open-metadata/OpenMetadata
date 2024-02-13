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
from typing import Dict, Iterable, Optional

from pydantic import BaseModel

from metadata.data_insight.producer.producer_interface import ProducerInterface
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.lifeCycle import LifeCycle
from metadata.ingestion.api.models import Entity
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()


class CostAnalysisReportData(BaseModel):
    """
    Query executed get life cycle
    """

    entity: Entity
    life_cycle: Optional[LifeCycle]
    size: Optional[float]


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

    def _check_life_cycle_and_size_data(
        self, table: Table
    ) -> Optional[CostAnalysisReportData]:
        """
        Method to check if the valid life cycle and table size data is present for the table
        """
        cost_analysis_report_data = CostAnalysisReportData(entity=table)
        if table.lifeCycle and table.lifeCycle.accessed:
            cost_analysis_report_data.life_cycle = table.lifeCycle

        table_profile = self.metadata.get_latest_table_profile(
            fqn=table.fullyQualifiedName
        )
        if table_profile.profile:
            cost_analysis_report_data.size = table_profile.profile.sizeInByte

        if cost_analysis_report_data.life_cycle or cost_analysis_report_data.size:
            return cost_analysis_report_data
        return None

    def life_cycle_data_dict(
        self, entities_cache: Optional[Dict], database_service_fqn: str
    ) -> Iterable[Dict]:
        """
        Cache the required lifecycle data to be used by the processors and return the dict
        """
        if entities_cache.get(database_service_fqn):
            yield entities_cache[database_service_fqn]
        else:
            tables = self.metadata.list_all_entities(
                Table,
                limit=100,
                skip_on_failure=True,
                params={"database": database_service_fqn},
            )
            entities_cache[database_service_fqn] = {}

            for table in tables:
                try:
                    cost_analysis_data = self._check_life_cycle_and_size_data(
                        table=table
                    )
                    if cost_analysis_data:
                        entities_cache[database_service_fqn][
                            model_str(table.fullyQualifiedName)
                        ] = cost_analysis_data
                except Exception as err:
                    logger.error(
                        f"Error trying to fetch cost analysis data for [{model_str(table.fullyQualifiedName)}] -- {err}"
                    )
                    logger.debug(traceback.format_exc())

            yield entities_cache[database_service_fqn]

    # pylint: disable=dangerous-default-value
    def fetch_data(
        self, limit=100, fields=["*"], entities_cache=None
    ) -> Optional[Iterable[Dict]]:
        database_services = self.metadata.list_all_entities(
            DatabaseService, limit=limit, fields=fields, skip_on_failure=True
        )
        for database_service in database_services or []:
            try:
                if self._check_profiler_and_usage_support(database_service):
                    yield from self.life_cycle_data_dict(
                        entities_cache=entities_cache,
                        database_service_fqn=model_str(
                            database_service.fullyQualifiedName
                        ),
                    )
            except Exception as err:
                logger.error(f"Error trying to fetch entities -- {err}")
                logger.debug(traceback.format_exc())
