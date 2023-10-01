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
Processor class used to compute refined report data
"""

from __future__ import annotations

import traceback
from collections import defaultdict
from typing import Iterable

from metadata.data_insight.processor.cost_analysis_base import (
    BaseCostAnalysisReportDataProcessor,
)
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.aggregatedCostAnalysisReportData import (
    AggregatedCostAnalysisReportData,
)
from metadata.generated.schema.analytics.reportDataType.rawCostAnalysisReportData import (
    RawCostAnalysisReportData,
)
from metadata.generated.schema.type.lifeCycle import LifeCycle
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import get_end_of_day_timestamp_mill

logger = data_insight_logger()


UNUSED_DATA_ASSETS = "unusedDataAssets"
FREQUENTLY_USED_DATA_ASSETS = "frequentlyUsedDataAssets"
TOTAL_SIZE = "totalSize"

THREE_DAYS = "threeDays"
SEVEN_DAYS = "sevenDays"
FOURTEEN_DAYS = "fourteenDays"
THIRTY_DAYS = "thirtyDays"
SIXTY_DAYS = "sixtyDays"

DAYS = [
    (3, THREE_DAYS),
    (7, SEVEN_DAYS),
    (14, FOURTEEN_DAYS),
    (30, THIRTY_DAYS),
    (60, SIXTY_DAYS),
]


class RawCostAnalysisReportDataProcessor(BaseCostAnalysisReportDataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "RawCostAnalysisReportData"

    def refine(self) -> Iterable[ReportData]:
        """Aggregate data
        Returns:
            list:
        """

        for entity in self.fetch_data():
            try:
                cost_analysis_data = RawCostAnalysisReportData(
                    entity=self.metadata.get_entity_reference(
                        entity=type(entity), fqn=entity.fullyQualifiedName
                    )
                )
                if entity.lifeCycle:
                    cost_analysis_data.lifeCycle = entity.lifeCycle

                table_profile = self.metadata.get_latest_table_profile(
                    fqn=entity.fullyQualifiedName
                )
                if table_profile.profile:
                    cost_analysis_data.sizeInByte = table_profile.profile.sizeInByte

                if cost_analysis_data.lifeCycle or cost_analysis_data.sizeInByte:
                    yield ReportData(
                        timestamp=self.timestamp,
                        reportDataType=ReportDataType.RawCostAnalysisReportData.value,
                        data=cost_analysis_data,
                    )

                self.processor_status.scanned(entity.name.__root__)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error trying fetch cost analysis data -- {err}")


class AggregatedCostAnalysisReportDataProcessor(BaseCostAnalysisReportDataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "AggregatedCostAnalysisReportData"

    def refine(self) -> Iterable[ReportData]:
        """Aggregate data
        Returns:
            list:
        """
        refined_data = defaultdict(lambda: defaultdict(dict))

        for entity in self.fetch_data():
            try:
                life_cycle = None
                if entity.lifeCycle:
                    life_cycle = entity.lifeCycle

                size = None
                table_profile = self.metadata.get_latest_table_profile(
                    fqn=entity.fullyQualifiedName
                )
                if table_profile.profile:
                    size = table_profile.profile.sizeInByte

                if life_cycle or size:
                    entity_type = str(entity.__class__.__name__)
                    service_type = str(entity.serviceType.name)
                    service_name = str(entity.service.name)
                    if not refined_data[str(entity_type)][service_type].get(
                        service_name
                    ):
                        refined_data[entity_type][service_type][service_name] = {
                            TOTAL_SIZE: size or 0,
                            UNUSED_DATA_ASSETS: {
                                THREE_DAYS: 0,
                                SEVEN_DAYS: 0,
                                FOURTEEN_DAYS: 0,
                                THIRTY_DAYS: 0,
                                SIXTY_DAYS: 0,
                            },
                            FREQUENTLY_USED_DATA_ASSETS: {
                                THREE_DAYS: 0,
                                SEVEN_DAYS: 0,
                                FOURTEEN_DAYS: 0,
                                THIRTY_DAYS: 0,
                                SIXTY_DAYS: 0,
                            },
                        }
                    else:
                        refined_data[entity_type][service_type][service_name][
                            TOTAL_SIZE
                        ] += (size or 0)

                    self._get_data_assets_dict(
                        life_cycle=life_cycle,
                        data=refined_data[entity_type][service_type][service_name],
                    )

                self.processor_status.scanned(entity.name.__root__)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(f"Error trying fetch cost analysis data -- {err}")

        yield from self._flatten_results(refined_data)

    def _flatten_results(self, refined_data):
        """
        Method to format the structure of data
        """
        try:
            for entity_type, entity_item in refined_data.items():
                for service_type, service_item in entity_item.items():
                    for service_name, service_data in service_item.items():
                        aggregated_data = AggregatedCostAnalysisReportData(
                            entityType=str(entity_type),
                            serviceType=str(service_type),
                            serviceName=str(service_name),
                            **service_data,
                        )
                        yield ReportData(
                            timestamp=self.timestamp,
                            reportDataType=ReportDataType.AggregatedCostAnalysisReportData.value,
                            data=aggregated_data,
                        )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to yield report data -- {err}")

    @staticmethod
    def _get_data_assets_dict(life_cycle: LifeCycle, data: dict):
        """
        Helper method to calculate number of data assets within time period
        """
        try:
            if not life_cycle:
                return

            # Iterate over the different time periods and update the data
            for days, key in DAYS:
                days_before_timestamp = get_end_of_day_timestamp_mill(days=days)
                if life_cycle.accessed.timestamp.__root__ <= days_before_timestamp:
                    data[UNUSED_DATA_ASSETS][key] += 1
                else:
                    data[FREQUENTLY_USED_DATA_ASSETS][key] += 1

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error calculating data -- {err}")
