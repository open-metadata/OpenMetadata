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
OpenMetadata producer factory
"""

from typing import Type

from metadata.data_insight.producer.cost_analysis_producer import CostAnalysisProducer
from metadata.data_insight.producer.entity_producer import EntityProducer
from metadata.data_insight.producer.producer_interface import ProducerInterface
from metadata.data_insight.producer.web_analytics_producer import WebAnalyticsProducer
from metadata.generated.schema.analytics.reportData import ReportDataType


class ProducerFactory:
    def __init__(self):
        self._producer_type = {}

    def register(self, producer_type: str, producer_class: Type[ProducerInterface]):
        """register a new producer"""
        self._producer_type[producer_type] = producer_class

    def create(self, producer_type: str, *args, **kwargs) -> ProducerInterface:
        """create producer object based on producer type"""
        producer_class = self._producer_type.get(producer_type)
        if not producer_class:
            raise RuntimeError(f"Producer type {producer_type} not found")
        return producer_class(*args, **kwargs)


producer_factory = ProducerFactory()
producer_factory.register(ReportDataType.entityReportData.value, EntityProducer)
producer_factory.register(
    ReportDataType.rawCostAnalysisReportData.value, CostAnalysisProducer
)
producer_factory.register(
    ReportDataType.aggregatedCostAnalysisReportData.value, CostAnalysisProducer
)
producer_factory.register(
    ReportDataType.webAnalyticEntityViewReportData.value, WebAnalyticsProducer
)
producer_factory.register(
    ReportDataType.webAnalyticUserActivityReportData.value, WebAnalyticsProducer
)
