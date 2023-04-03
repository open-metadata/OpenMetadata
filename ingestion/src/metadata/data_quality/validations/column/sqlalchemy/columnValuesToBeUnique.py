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
Validator for column values to be unique test case
"""

from typing import Optional

from sqlalchemy import Column, inspect
from sqlalchemy.orm.util import AliasedClass

from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Validator for column values to be unique test case"""

    def _get_column_name(self) -> Column:
        """Get column name from the test case entity link

        Returns:
            Column: column
        """
        return self.get_column_name(
            self.test_case.entityLink.__root__,
            inspect(self.runner.table).c,
        )

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column)

    def _get_unique_count(self, metric: Metrics, column: Column) -> Optional[int]:
        """Get unique count of values"""
        unique_count = dict(
            self.runner.select_all_from_query(
                metric.value(column).query(
                    sample=self.runner._sample  # pylint: disable=protected-access
                    if isinstance(
                        self.runner._sample,  # pylint: disable=protected-access
                        AliasedClass,
                    )
                    else self.runner.table,
                    session=self.runner._session,  # pylint: disable=protected-access
                )  # type: ignore
            )[
                0
            ]  # query result is a list of tuples
        )

        return unique_count.get(metric.name)
