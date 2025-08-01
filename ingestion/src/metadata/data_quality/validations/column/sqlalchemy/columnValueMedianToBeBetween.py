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
Validator for column value median to be between test case
"""

from typing import Optional

from sqlalchemy import Column, inspect

from metadata.data_quality.validations.column.base.columnValueMedianToBeBetween import (
    BaseColumnValueMedianToBeBetweenValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics


class ColumnValueMedianToBeBetweenValidator(
    BaseColumnValueMedianToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value median to be between test case"""

    def _get_column_name(self) -> Column:
        """Get column name from the test case entity link

        Returns:
            Column: column
        """
        return self.get_column_name(
            self.test_case.entityLink.root,
            inspect(self.runner.dataset).c,
        )

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column)
