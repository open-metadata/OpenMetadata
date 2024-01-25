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
from copy import deepcopy
from typing import Iterable, Optional

from metadata.data_insight.processor.reports.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.aggregatedCostAnalysisReportData import (
    AggregatedCostAnalysisReportData,
)
from metadata.generated.schema.analytics.reportDataType.rawCostAnalysisReportData import (
    RawCostAnalysisReportData,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.lifeCycle import LifeCycle
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import get_end_of_day_timestamp_mill

logger = data_insight_logger()


UNUSED_DATA_ASSETS = "unusedDataAssets"
FREQUENTLY_USED_DATA_ASSETS = "frequentlyUsedDataAssets"
COUNT = "count"
SIZE = "size"
TOTAL_SIZE = "totalSize"
TOTAL_COUNT = "totalCount"

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

DAYS_WISE_METRIC_DICT = {
    THREE_DAYS: 0,
    SEVEN_DAYS: 0,
    FOURTEEN_DAYS: 0,
    THIRTY_DAYS: 0,
    SIXTY_DAYS: 0,
}

ASSET_METRIC_DICT = {
    COUNT: deepcopy(DAYS_WISE_METRIC_DICT),
    SIZE: deepcopy(DAYS_WISE_METRIC_DICT),
    TOTAL_SIZE: 0,
    TOTAL_COUNT: 0,
}


class RawCostAnalysisReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = ReportDataType.rawCostAnalysisReportData.value

    def __init__(self, metadata: OpenMetadata):
        super().__init__(metadata)
        self.pre_hook = self._pre_hook_fn

    def _pre_hook_fn(self):
        """
        Method to delete the previous rows of the RawCostAnalysisReportData type report
        """
        self.metadata.delete_report_data(ReportDataType.rawCostAnalysisReportData)

    def yield_refined_data(self) -> Iterable[ReportData]:
        """yield refined data"""
        for _, value in self._refined_data.items():
            yield ReportData(
                timestamp=self.timestamp,
                reportDataType=ReportDataType.rawCostAnalysisReportData.value,
                data=value,
            )  # type: ignore

    def refine(self, entity: Table) -> None:
        """Aggregate data
        Returns:
            list:
        """

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
                self._refined_data[
                    entity.fullyQualifiedName.__root__
                ] = cost_analysis_data

            self.processor_status.scanned(entity.name.__root__)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error trying fetch cost analysis data -- {err}")

    def get_status(self):
        return self.processor_status


class AggregatedCostAnalysisReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = ReportDataType.aggregatedCostAnalysisReportData.value

    def __init__(self, metadata: OpenMetadata):
        super().__init__(metadata)
        self._refined_data = defaultdict(lambda: defaultdict(dict))
        self.post_hook = self._post_hook_fn

    def yield_refined_data(self) -> Iterable[ReportData]:
        """Yield refined data"""
        for data in self._refined_data:
            yield ReportData(
                timestamp=self.timestamp,
                reportDataType=ReportDataType.aggregatedCostAnalysisReportData.value,
                data=data,
            )  # type: ignore

    def refine(self, entity: Table) -> None:
        """Aggregate data
        Returns:
            list:
        """
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
                if not self._refined_data[str(entity_type)][service_type].get(
                    service_name
                ):
                    self._refined_data[entity_type][service_type][service_name] = {
                        TOTAL_SIZE: 0,
                        TOTAL_COUNT: 0,
                        UNUSED_DATA_ASSETS: deepcopy(ASSET_METRIC_DICT),
                        FREQUENTLY_USED_DATA_ASSETS: deepcopy(ASSET_METRIC_DICT),
                    }
                else:
                    self._refined_data[entity_type][service_type][service_name][
                        TOTAL_SIZE
                    ] += (size or 0)
                    self._refined_data[entity_type][service_type][service_name][
                        TOTAL_COUNT
                    ] += 1

                self._get_data_assets_dict(
                    life_cycle=life_cycle,
                    size=size,
                    data=self._refined_data[entity_type][service_type][service_name],
                )

            self.processor_status.scanned(entity.name.__root__)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error trying fetch cost analysis data -- {err}")

    def _post_hook_fn(self):
        """
        Method to format the structure of data
        """
        flattened_results = []
        for entity_type, entity_item in self._refined_data.items():
            for service_type, service_item in entity_item.items():
                for service_name, service_data in service_item.items():
                    try:
                        aggregated_data = AggregatedCostAnalysisReportData(
                            entityType=str(entity_type),
                            serviceType=str(service_type),
                            serviceName=str(service_name),
                            **service_data,
                        )
                        aggregated_data.unusedDataAssets.totalCount = (
                            aggregated_data.unusedDataAssets.count.threeDays
                        )
                        aggregated_data.unusedDataAssets.totalSize = (
                            aggregated_data.unusedDataAssets.size.threeDays
                        )
                        aggregated_data.frequentlyUsedDataAssets.totalCount = (
                            aggregated_data.frequentlyUsedDataAssets.count.threeDays
                        )
                        aggregated_data.frequentlyUsedDataAssets.totalSize = (
                            aggregated_data.frequentlyUsedDataAssets.size.threeDays
                        )
                        flattened_results.append(aggregated_data)
                    except Exception as err:
                        logger.debug(traceback.format_exc())
                        logger.error(f"Unable to yield report data -- {err}")

        self._refined_data = flattened_results

    @staticmethod
    def _get_data_assets_dict(life_cycle: LifeCycle, size: Optional[float], data: dict):
        """
        Helper method to calculate number of data assets within time period
        """
        try:
            if not life_cycle or not life_cycle.accessed:
                return

            # Iterate over the different time periods and update the data
            for days, key in DAYS:
                days_before_timestamp = get_end_of_day_timestamp_mill(days=days)
                if life_cycle.accessed.timestamp.__root__ <= days_before_timestamp:
                    data[UNUSED_DATA_ASSETS][COUNT][key] += 1
                    data[UNUSED_DATA_ASSETS][SIZE][key] += size or 0
                else:
                    data[FREQUENTLY_USED_DATA_ASSETS][COUNT][key] += 1
                    data[FREQUENTLY_USED_DATA_ASSETS][SIZE][key] += size or 0

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error calculating data -- {err}")

    def get_status(self):
        return self.processor_status
