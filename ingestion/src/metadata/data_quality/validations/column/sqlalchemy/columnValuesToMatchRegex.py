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
Validator for column values to match regex test case
"""

from typing import Optional, Tuple

from sqlalchemy import Column, inspect
from sqlalchemy.exc import CompileError, SQLAlchemyError

from metadata.data_quality.validations.column.base.columnValuesToMatchRegex import (
    BaseColumnValuesToMatchRegexValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToMatchRegexValidator(
    BaseColumnValuesToMatchRegexValidator, SQAValidatorMixin
):
    """Validator for column values to match regex test case"""

    def _get_column_name(self) -> Column:
        """Get column name from the test case entity link

        Returns:
            Column: column
        """
        return self.get_column_name(
            self.test_case.entityLink.root,
            inspect(self.runner.dataset).c,
        )

    def _run_results(
        self, metric: Tuple[Metrics], column: Column, **kwargs
    ) -> Tuple[Optional[int], Optional[int]]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        try:
            regex_count = Metrics.REGEX_COUNT(column)
            regex_count.expression = kwargs.get("expression")
            regex_count_fn = regex_count.fn()

            res = dict(
                self.runner.dispatch_query_select_first(
                    Metrics.COUNT(column).fn(),
                    regex_count_fn,
                )
            )
        except (CompileError, SQLAlchemyError) as err:
            logger.warning(
                f"Could not use `REGEXP` due to - {err}. Falling back to `LIKE`"
            )
            regex_count = Metrics.LIKE_COUNT(column)
            regex_count.expression = kwargs.get("expression")
            regex_count_fn = regex_count.fn()
            res = dict(
                self.runner.dispatch_query_select_first(
                    Metrics.COUNT(column).fn(),
                    regex_count_fn,
                )
            )

        if not res:
            # pylint: disable=line-too-long
            raise ValueError(
                f"\nQuery on table/column {column.name if column is not None else ''} returned None. Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/data-quality/tests\n"
                "\t2. reach out to the Collate team for support"
            )
            # pylint: enable=line-too-long

        return res.get(Metrics.COUNT.name), res.get(regex_count.name())

    def compute_row_count(self, column: Column):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)
