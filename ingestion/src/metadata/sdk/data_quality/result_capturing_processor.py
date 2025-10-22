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
# pylint: disable=W0212
from typing import Any, List, Optional, cast

from metadata.data_quality.api.models import TestCaseResultResponse, TestCaseResults
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class ResultCapturingProcessor(Processor):
    """
    Wraps a processor to capture TestCaseResults without modifying it.

    This processor wrapper intercepts the _run() method to extract and store
    TestCaseResultResponse objects while delegating all processing to the wrapped
    processor. All other attributes are delegated to the wrapped processor.
    """

    def __init__(self, processor: Processor):
        super().__init__()
        self._processor: Processor = processor
        self._collected_results: List[TestCaseResultResponse] = []

    def __getattr__(self, name: str) -> Any:
        """Delegate all attributes to wrapped processor."""
        return getattr(self._processor, name)

    def _run(self, record: Entity) -> Either[Any]:
        """
        Intercept _run to capture TestCaseResults.

        Delegates to the wrapped processor's _run method and extracts
        TestCaseResultResponse objects from TestCaseResults for storage.
        """
        result = cast(
            Either[Any],
            self._processor._run(record),  # pyright: ignore[reportUnknownMemberType]
        )

        if result and result.right is not None:
            data = result.right
            if isinstance(data, TestCaseResults) and data.test_results:
                self._collected_results.extend(data.test_results)

        return result

    @classmethod
    def create(
        cls,
        config_dict: dict[str, Any],
        metadata: OpenMetadata[Any, Any],
        pipeline_name: Optional[str] = None,
    ) -> "ResultCapturingProcessor":
        """Not used - ResultCapturingProcessor wraps existing processors."""
        raise NotImplementedError(
            "ResultCapturingProcessor.create() is not supported. "
            + "Use ResultCapturingProcessor(processor) to wrap an existing processor."
        )

    def close(self) -> None:
        """Delegate close to wrapped processor."""
        self._processor.close()

    def get_results(self) -> List[TestCaseResultResponse]:
        """Return all captured test case results."""
        return self._collected_results
