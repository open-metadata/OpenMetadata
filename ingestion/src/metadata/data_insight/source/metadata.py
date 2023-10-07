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
OpenMetadata source for the data insight workflow
"""

import traceback
from datetime import datetime
from types import MappingProxyType
from typing import Dict, Iterable, Optional, Union, cast

from pydantic import BaseModel

from metadata.data_insight.processor.reports.cost_analysis_report_data_processor import (
    AggregatedCostAnalysisReportDataProcessor,
    RawCostAnalysisReportDataProcessor,
)
from metadata.data_insight.processor.reports.data_processor import DataProcessor
from metadata.data_insight.processor.reports.entity_report_data_processor import (
    EntityReportDataProcessor,
)
from metadata.data_insight.processor.reports.web_analytic_report_data_processor import (
    WebAnalyticEntityViewReportDataProcessor,
    WebAnalyticUserActivityReportDataProcessor,
)
from metadata.data_insight.producer.producer_factory import producer_factory
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class DataInsightRecord(BaseModel):
    """Return class for the OpenMetadata Profiler Source"""

    class Config:
        arbitrary_types_allowed = True
        extra = "forbid"

    data: ReportData

    def __str__(self):
        """Return the string representation of the entity produced"""
        return f"Entities: {list(self.data)}"


class DataInsightSource(Source):
    """
    This source lists and filters the entities that need
    to be processed by the profiler workflow.

    Note that in order to manage the following steps we need
    to test the connection against the Database Service Source.
    We do this here as well.
    """

    def __init__(self, metadata: OpenMetadata):
        """Instantiate source object"""
        super().__init__()
        self.metadata = metadata
        self.date = datetime.utcnow().strftime("%Y-%m-%d")

        _processors = self._instantiate_processors()
        self._processors: Dict[
            str,
            Union[
                DataProcessor,
                EntityReportDataProcessor,
                WebAnalyticEntityViewReportDataProcessor,
                WebAnalyticUserActivityReportDataProcessor,
                AggregatedCostAnalysisReportDataProcessor,
                RawCostAnalysisReportDataProcessor,
            ],
        ] = MappingProxyType(
            _processors
        )  # make an immutable copy of the dict

    @property
    def processors(self) -> Dict[str, Optional[DataProcessor]]:
        """dictionnaray of processors"""
        return self._processors

    def _instantiate_processors(self) -> Dict[str, DataProcessor]:
        """Instantiate the data processors"""
        return {
            report_data_type.value: DataProcessor.create(
                _data_processor_type=report_data_type.value,
                metadata=self.metadata,
            )
            for report_data_type in ReportDataType
        }

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """Nothing to test as we'll be connecting to OM"""

    def _iter(self, *_, **__) -> Iterable[Either[DataInsightRecord]]:
        """Produces the data that need to be processed"""

        for report_data_type in ReportDataType:
            logger.info(f"Processing data for report type {report_data_type}")
            try:
                self.metadata.delete_report_data_at_date(report_data_type, self.date)
                producer = producer_factory.create(
                    report_data_type.value, self.metadata
                )

                processor = self.processors[report_data_type.value]
                processor = cast(DataProcessor, processor)
                processor.pre_hook() if processor.pre_hook else None  # pylint: disable=expression-not-assigned

                for data in producer.fetch_data():
                    processor.refine(data)

                processor.post_hook() if processor.post_hook else None  # pylint: disable=expression-not-assigned

                for data in processor.yield_refined_data():
                    yield Either(left=None, right=DataInsightRecord(data=data))
            except KeyError as key_error:
                yield Either(
                    left=StackTraceError(
                        name=report_data_type.value,
                        error=f"Error retrieving processor with exception [{key_error}]."
                        "Available processors are {self.processors}",
                        stack_trace=traceback.format_exc(),
                    ),
                    right=None,
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=report_data_type.value,
                        error=f"Error listing data for report with exception [{exc}]",
                        stack_trace=traceback.format_exc(),
                    ),
                    right=None,
                )

    # pylint: disable=arguments-differ
    @classmethod
    def create(cls, metadata: OpenMetadata) -> "Step":
        return cls(metadata)

    def close(self) -> None:
        """Nothing to close"""
