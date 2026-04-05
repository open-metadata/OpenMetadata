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
Mixin that orchestrates failed row sampling for test case validators.

When a test case has computePassedFailedRowCount=True and the result is Failed,
this mixin fetches a sample of failed rows and the inspection query (for SQL
sources), attaching them directly to the TestCaseResult instance.

BaseTestValidator.run_validation() calls self.result_with_failed_samples()
which is a no-op by default. This mixin overrides it to do the actual work.
"""

import traceback
from abc import ABC, abstractmethod
from typing import Optional

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class FailedSampleValidatorMixin(ABC):
    """ABC mixin providing failed row sampling orchestration.

    Concrete validators must implement:
      - fetch_failed_rows_sample() -> TableData
      - filter() -> filter expression (dict for SQA, string for Pandas)
    """

    def get_inspection_query(self) -> Optional[str]:
        return getattr(self, "_inspection_query", None)

    @abstractmethod
    def fetch_failed_rows_sample(self) -> TableData:
        raise NotImplementedError

    def result_with_failed_samples(self, result: TestCaseResultResponse) -> None:
        """Fetch failed row samples and attach them to the result.

        Called by BaseTestValidator.run_validation() at the end of validation.
        Only fetches samples when:
          - test_case.computePassedFailedRowCount is True
          - result.testCaseResult.testCaseStatus is Failed

        Attaches failedRowsSample and inspectionQuery directly on the
        TestCaseResult instance for the runner/sink to pick up.
        """
        if not (
            getattr(result.testCase, "computePassedFailedRowCount", False)
            and result.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        ):
            return

        try:
            result.failedRowsSample = self.fetch_failed_rows_sample()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.error("Failed to fetch failed rows sample")

        try:
            result.inspectionQuery = self.get_inspection_query()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.error("Failed to get inspection query")
