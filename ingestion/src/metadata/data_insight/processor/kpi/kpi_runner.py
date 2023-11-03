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
Runner class used to check KPI status
"""

from __future__ import annotations

import time as tme
from datetime import datetime
from typing import Iterator, Optional

from metadata.data_insight.processor.kpi.run_result_registry import run_result_registry
from metadata.generated.schema.dataInsight.dataInsightChart import DataInsightChart
from metadata.generated.schema.dataInsight.dataInsightChartResult import (
    DataInsightChartResult,
)
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult, KpiTarget
from metadata.generated.schema.dataInsight.kpi.kpi import Kpi
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.models import EntityList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

logger = data_insight_logger()

TIMEOUT = 30


class KpiRunner:
    """KPI runner class

    Attrs:
        kpis: list[Kpi]
        metadata: OpenMetadata
        processor_status: SourceStatus
    """

    def __init__(self, metadata: OpenMetadata) -> None:
        self.metadata = metadata
        self.datetime = int(datetime.utcnow().timestamp() * 1000)
        self.processor_status = Status()
        self.kpis = self.get_active_kpis()

    def _is_kpi_active(self, entity: Kpi) -> bool:
        """Check if a KPI is active

        Args:
            entity (Kpi): KPI entity

        Returns:
            Kpi:
        """

        start_date = entity.startDate.__root__
        end_date = entity.endDate.__root__

        if not start_date or not end_date:
            logger.warning(
                f"Start date or End date was not defined.\n\t-startDate: {start_date}\n\t-end_date: {end_date}\n"
                "We won't be running the KPI validation"
            )
            return False

        if start_date <= self.datetime <= end_date:
            return True

        return False

    # pylint: disable=dangerous-default-value
    def get_kpis(self, limit=100, fields=["*"]) -> EntityList[Kpi]:
        """Get the list of all the KPIs

        Args:
            limit (int, optional): limit of result to return. Defaults to 100.
            fields (list, optional): Fields to include. Defaults to ["*"].

        Returns:
            EntityList[Kpi]: List of KPIs
        """
        return self.metadata.list_entities(
            entity=Kpi, limit=limit, fields=fields  # type: ignore
        )

    def get_active_kpis(self):
        """Get the list of active KPIs"""
        kpis = self.get_kpis()
        return [kpi for kpi in kpis.entities if self._is_kpi_active(kpi)]

    def _get_data_insight_chart_result(
        self, data_insight_chart: EntityReference
    ) -> DataInsightChartResult:
        """get data insight result for a specific chart

        Args:
            data_insight_chart (EntityReference): _description_
        """
        results = None
        data_insight_chart_entity: Optional[
            DataInsightChart
        ] = self.metadata.get_by_name(
            entity=DataInsightChart,
            fqn=data_insight_chart.fullyQualifiedName,
            fields=["*"],
        )

        if not data_insight_chart_entity:
            logger.warning(
                f"No entity returned for dataInsightChart {data_insight_chart.name}"
            )
            return None

        timeout = tme.time() + TIMEOUT
        while True:
            results = self.metadata.get_aggregated_data_insight_results(
                start_ts=get_beginning_of_day_timestamp_mill(),
                end_ts=get_end_of_day_timestamp_mill(),
                data_insight_chart_nane=data_insight_chart_entity.name.__root__,
                data_report_index=data_insight_chart_entity.dataIndexType.value,
            )
            if results.data or tme.time() > timeout:
                break

        return results

    def run(self) -> Iterator[KpiResult]:
        """Method to run the KPI status check"""
        for kpi in self.kpis:
            kpi_target: list[KpiTarget] = kpi.targetDefinition
            data_insight_chart_result: DataInsightChartResult = (
                self._get_data_insight_chart_result(kpi.dataInsightChart)
            )
            kpi_result = run_result_registry.registry[kpi.dataInsightChart.name](
                kpi_target,
                data_insight_chart_result.data,
                kpi.fullyQualifiedName,
                self.datetime,
            )

            yield kpi_result

    def get_status(self):
        return self.processor_status
