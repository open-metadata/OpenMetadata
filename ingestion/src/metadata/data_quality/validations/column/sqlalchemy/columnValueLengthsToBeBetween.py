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
Validator for column value length to be between test case
"""
import math
from typing import Optional

from sqlalchemy import Column, inspect

from metadata.data_quality.validations.column.base.columnValueLengthsToBeBetween import (
    BaseColumnValueLengthsToBeBetweenValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.length import LenFn


class ColumnValueLengthsToBeBetweenValidator(
    BaseColumnValueLengthsToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for column value length to be between test case"""

    def _get_column_name(self) -> Column:
        """get column name from the test case entity link

        Returns:
            Column: column
        """
        return self.get_column_name(
            self.test_case.entityLink.root,
            inspect(self.runner.table).c,
        )

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric for computation
            column: column
        """
        return self.run_query_results(self.runner, metric, column)

    def compute_row_count(self, column: Column, min_bound: int, max_bound: int):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        row_count = self._compute_row_count(self.runner, column)
        filters = []
        if min_bound > -math.inf:
            filters.append((LenFn(column), "lt", min_bound))
        if max_bound < math.inf:
            filters.append((LenFn(column), "gt", max_bound))
        failed_rows = self._compute_row_count_between(
            self.runner,
            column,
            {
                "filters": filters,
                "or_filter": True,
            },
        )

        return row_count, failed_rows
