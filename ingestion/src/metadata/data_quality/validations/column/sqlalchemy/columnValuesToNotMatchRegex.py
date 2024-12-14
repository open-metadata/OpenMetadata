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
Validator for column values to not match regex test case
"""

from typing import Optional

from sqlalchemy import Column, inspect
from sqlalchemy.exc import CompileError, SQLAlchemyError

from metadata.data_quality.validations.column.base.columnValuesToNotMatchRegex import (
    BaseColumnValuesToNotMatchRegexValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToNotMatchRegexValidator(
    BaseColumnValuesToNotMatchRegexValidator, SQAValidatorMixin
):
    """Validator for column values to not match regex test case"""

    def _get_column_name(self) -> Column:
        """Get column name from the test case entity link

        Returns:
            SQALikeColumn: column
        """
        return self.get_column_name(
            self.test_case.entityLink.root,
            inspect(self.runner.dataset).c,
        )

    def _run_results(self, metric: Metrics, column: Column, **kwargs) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        try:
            return self.run_query_results(self.runner, metric, column, **kwargs)
        except (CompileError, SQLAlchemyError) as err:
            logger.warning(
                f"Could not use `REGEXP` due to - {err}. Falling back to `LIKE`"
            )
            return self.run_query_results(
                self.runner, Metrics.NOT_LIKE_COUNT, column, **kwargs
            )

    def compute_row_count(self, column: Column):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)
