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
Elasticsearch indexes for data insight data
"""

import enum


class DataInsightEsIndex(enum.Enum):
    """Data Insight ES Indexes"""

    EntityReportData = "entity_report_data_index"
    WebAnalyticUserActivityReportData = "web_analytic_user_activity_report_data_index"
    WebAnalyticEntityViewReportData = "web_analytic_entity_view_report_data_index"
