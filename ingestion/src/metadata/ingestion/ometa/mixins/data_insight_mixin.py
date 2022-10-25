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
Mixin class containing data specific methods

To be used by OpenMetadata class
"""

from __future__ import annotations

from metadata.generated.schema.analytics.reportData import ReportData


class DataInisghtMixin:
    """data insight mixin used to write results"""

    def add_data_insight_report_data(self, record: ReportData) -> ReportData:
        """Given a ReportData object convert it to a json payload
        and send a POST request to the report data endpoint

        Args:
            record (ReportData): report data
        """

        resp = self.client.post("/analytic/reportData", record.json())

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
            "/analytic/reportData",
            {"startTs": start_ts, "endTs": end_ts, "reportDataType": report_data_type},
        )

        return resp
