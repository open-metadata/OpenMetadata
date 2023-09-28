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

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.aggregatedCostAnalysisReportData import (
    AggregatedCostAnalysisReportData,
)
from metadata.generated.schema.analytics.reportDataType.rawCostAnalysisReportData import (
    RawCostAnalysisReportData,
)
from metadata.generated.schema.entity.data import table
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import get_end_of_day_timestamp_mill

logger = data_insight_logger()


class RawCostAnalysisReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "RawCostAnalysisReportData"

    def fetch_data(self) -> Iterable[table.Table]:
        try:
            yield from self.metadata.list_all_entities(
                table.Table, limit=1000, fields=["*"]
            )
        except Exception as err:
            logger.error(f"Error trying to fetch entity -- {err}")
            logger.debug(traceback.format_exc())

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

    def process(self) -> Iterable[ReportData]:
        yield from self.refine()

    def get_status(self):
        return self.processor_status


class AggregatedCostAnalysisReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "AggregatedCostAnalysisReportData"

    def fetch_data(self) -> Iterable[table.Table]:
        try:
            yield from self.metadata.list_all_entities(
                table.Table, limit=1000, fields=["*"]
            )
        except Exception as err:
            logger.error(f"Error trying to fetch entity -- {err}")
            logger.debug(traceback.format_exc())

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
                            "totalSize": size or 0,
                            "unUsedDataAssets": {
                                "threeDays": 0,
                                "sevenDays": 0,
                                "fourteenDays": 0,
                                "thirtyDays": 0,
                                "sixtyDays": 0,
                            },
                            "frequentlyUsedDataAssets": {
                                "threeDays": 0,
                                "sevenDays": 0,
                                "fourteenDays": 0,
                                "thirtyDays": 0,
                                "sixtyDays": 0,
                            },
                        }
                    else:
                        refined_data[entity_type][service_type][service_name][
                            "totalSize"
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

    def _get_data_assets_dict(self, life_cycle, data: dict):
        """
        Helper method to calculate number of data assets within time period
        """
        try:
            if not life_cycle:
                return
            three_days_before_timestamp = get_end_of_day_timestamp_mill(days=3)
            if life_cycle.accessed.timestamp.__root__ <= three_days_before_timestamp:
                data["unUsedDataAssets"]["threeDays"] += 1
            else:
                data["frequentlyUsedDataAssets"]["threeDays"] += 1

            seven_days_ago_timestamp = get_end_of_day_timestamp_mill(days=7)
            if life_cycle.accessed.timestamp.__root__ <= seven_days_ago_timestamp:
                data["unUsedDataAssets"]["sevenDays"] += 1
            else:
                data["frequentlyUsedDataAssets"]["sevenDays"] += 1

            fourteen_days_ago_timestamp = get_end_of_day_timestamp_mill(days=14)
            if life_cycle.accessed.timestamp.__root__ <= fourteen_days_ago_timestamp:
                data["unUsedDataAssets"]["fourteenDays"] += 1
            else:
                data["frequentlyUsedDataAssets"]["fourteenDays"] += 1

            thirty_days_ago_timestamp = get_end_of_day_timestamp_mill(days=30)
            if life_cycle.accessed.timestamp.__root__ <= thirty_days_ago_timestamp:
                data["unUsedDataAssets"]["thirtyDays"] += 1
            else:
                data["frequentlyUsedDataAssets"]["thirtyDays"] += 1

            sixty_days_ago_timestamp = get_end_of_day_timestamp_mill(days=60)
            if life_cycle.accessed.timestamp.__root__ <= sixty_days_ago_timestamp:
                data["unUsedDataAssets"]["sixtyDays"] += 1
            else:
                data["frequentlyUsedDataAssets"]["sixtyDays"] += 1
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error calculating data -- {err}")

    def process(self) -> Iterable[ReportData]:
        yield from self.refine()

    def get_status(self):
        return self.processor_status
