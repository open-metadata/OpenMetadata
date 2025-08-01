#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Mixin class containing data specific methods

To be used by OpenMetadata class
"""

from __future__ import annotations

from typing import List, Optional

from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.api.dataInsight.kpi.createKpiRequest import (
    CreateKpiRequest,
)
from metadata.generated.schema.dataInsight.dataInsightChartResult import (
    DataInsightChartResult,
)
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult
from metadata.generated.schema.dataInsight.kpi.kpi import Kpi
from metadata.ingestion.ometa.utils import quote


class DataInsightMixin:
    """data insight mixin used to write results"""

    def add_data_insight_report_data(self, record: ReportData) -> ReportData:
        """Given a ReportData object convert it to a json payload
        and send a POST request to the report data endpoint

        Args:
            record (ReportData): report data
        """

        resp = self.client.post(
            "/analytics/dataInsights/data", record.model_dump_json()
        )

        return resp

    def add_kpi_result(self, fqn: str, record: KpiResult) -> KpiResult:
        """Given a ReportData object convert it to a json payload
        and send a POST request to the report data endpoint

        Args:
            record (ReportData): report data
        """

        resp = self.client.put(f"/kpi/{quote(fqn)}/kpiResult", record.model_dump_json())

        return resp

    def add_web_analytic_events(
        self,
        event_data: WebAnalyticEventData,
    ) -> List[WebAnalyticEventData]:
        """Get web analytic event"""

        resp = self.client.put(
            "/analytics/web/events/collect", event_data.model_dump_json()
        )

        return resp

    def get_data_insight_report_data(
        self, start_ts: int, end_ts: int, report_data_type: str
    ) -> dict[str, list[ReportData]]:
        """Return dict with a list of report data given a start and end date

        Args:
            start_ts (_type_): start_timestamp
            end_ts (_type_): end timestampe
            report_data_type (ReportDataType): report data type

        Returns:
            List[ReportData]:
        """

        resp = self.client.get(
            "/analytics/dataInsights/data",
            {"startTs": start_ts, "endTs": end_ts, "reportDataType": report_data_type},
        )

        return resp

    def get_aggregated_data_insight_results(
        self,
        start_ts: int,
        end_ts: int,
        data_insight_chart_nane: str,
        data_report_index: str,
        params: Optional[dict] = None,
    ) -> DataInsightChartResult:
        """_summary_

        Args:
            start_ts (int): _description_
            end_ts (int): _description_
            data_insight_chart_nane (str): _description_
            data_report_index (str): _description_
            params (Optional[dict], optional): _description_. Defaults to None.

        Returns:
            DataInsightChartResult: _description_
        """

        request_params = {
            "startTs": start_ts,
            "endTs": end_ts,
            "dataInsightChartName": data_insight_chart_nane,
            "dataReportIndex": data_report_index,
        }

        if params:
            request_params = {**request_params, **params}

        resp = self.client.get(
            "/analytics/dataInsights/charts/aggregate",
            request_params,
        )

        return DataInsightChartResult.model_validate(resp)

    def get_kpi_result(self, fqn: str, start_ts, end_ts) -> list[KpiResult]:
        """Given FQN return KPI results

        Args:
            fqn (str): fullyQualifiedName
        """

        params = {"startTs": start_ts, "endTs": end_ts}

        resp = self.client.get(
            f"/kpi/{quote(fqn)}/kpiResult",
            params,
        )

        return [KpiResult(**data) for data in resp["data"]]

    def create_kpi(self, create: CreateKpiRequest) -> Kpi:
        resp = self.client.post("/kpi", create.model_dump_json())

        return Kpi.model_validate(resp)

    def get_web_analytic_events(
        self, event_type: WebAnalyticEventType, start_ts: int, end_ts: int
    ) -> List[WebAnalyticEventData]:
        """Get web analytic event"""

        event_type_value = event_type.value

        params = {"eventType": event_type_value, "startTs": start_ts, "endTs": end_ts}

        resp = self.client.get("/analytics/web/events/collect", params)

        return [WebAnalyticEventData(**data) for data in resp["data"]]

    def delete_web_analytic_event_before_ts_exclusive(
        self, event_type: WebAnalyticEventType, tmsp: int
    ):
        """Deletes web analytics events before a timestamp

        Args:
            event_type (WebAnalyticEventData): web analytic event type
            tmsp (int): timestamp
        """
        event_type_value = event_type.value
        self.client.delete(f"/analytics/web/events/{event_type_value}/{tmsp}/collect")

    def delete_report_data_at_date(
        self, report_data_type: ReportDataType, date: str
    ) -> None:
        """Delete report data at a specific date for a specific report data type

        Args:
            report_data_type (ReportDataType): report date type to delete
            date (str): date for which to delete the report data
        """
        self.client.delete(
            f"/analytics/dataInsights/data/{report_data_type.value}/{date}"
        )

    def delete_report_data(self, report_data_type: ReportDataType) -> None:
        """Delete report data for a specific report data type

        Args:
            report_data_type (ReportDataType): report date type to delete
        """
        self.client.delete(f"/analytics/dataInsights/data/{report_data_type.value}")
