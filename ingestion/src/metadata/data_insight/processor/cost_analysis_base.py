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
Base Cost Analysis Report
"""

import traceback
from abc import abstractmethod
from typing import Iterable

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData
from metadata.generated.schema.entity.data import table
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()


class BaseCostAnalysisReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    def fetch_data(self) -> Iterable[table.Table]:
        try:
            yield from self.metadata.list_all_entities(
                table.Table, limit=1000, fields=["*"]
            )
        except Exception as err:
            logger.error(f"Error trying to fetch entity -- {err}")
            logger.debug(traceback.format_exc())

    @abstractmethod
    def refine(self) -> Iterable[ReportData]:
        """Aggregate the data"""
        raise NotImplementedError()

    def process(self) -> Iterable[ReportData]:
        yield from self.refine()

    def get_status(self):
        return self.processor_status
