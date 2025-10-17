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
Processor wrapper that captures test case results without modifying the processor.
"""

from typing import Any, List, Optional

from metadata.data_quality.api.models import TestCaseResultResponse, TestCaseResults
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.ingestion.api.models import Entity
from metadata.ingestion.api.steps import Processor


class ResultCapturingProcessor:
    """
    Wraps a processor to capture TestCaseResults without modifying it.

    This processor wrapper intercepts the run() method to extract and store
    TestCaseResultResponse objects while passing through all results unchanged.
    All other attributes are delegated to the wrapped processor.
    """

    _processor: Processor
    _collected_results: List[TestCaseResultResponse]

    def __init__(self, processor: Processor):
        self._processor = processor
        self._collected_results = []

    def __getattr__(self, name: str) -> Any:
        """Delegate all attributes to wrapped processor."""
        return getattr(self._processor, name)

    def run(self, record: Entity) -> Optional[Entity]:
        """
        Intercept run to capture TestCaseResults.

        Extracts TestCaseResultResponse objects from TestCaseResults
        and stores them in the internal collection. The result is
        returned unchanged to preserve the workflow behavior.
        """
        result = self._processor.run(record)

        if result is not None and isinstance(
            result, (TestCaseResults, CreateTestSuiteRequest)
        ):
            if isinstance(result, TestCaseResults) and result.test_results:
                self._collected_results.extend(result.test_results)

        return result

    def get_results(self) -> List[TestCaseResultResponse]:
        """Return all captured test case results."""
        return self._collected_results
