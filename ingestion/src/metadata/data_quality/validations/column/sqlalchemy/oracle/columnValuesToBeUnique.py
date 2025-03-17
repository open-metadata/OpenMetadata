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
Oracle-specific validator for column values to be unique test case
"""

from typing import Optional

from sqlalchemy import Column, func, inspect, select
from sqlalchemy.exc import SQLAlchemyError

from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.metrics.registry import Metrics


class OracleColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Oracle-specific validator for column values to be unique test case"""

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
        """Compute result of the test case with Oracle-specific implementation

        Args:
            metric: metric
            column: column

        Returns:
            Optional[int]: The count result
        """
        try:
            # Oracle-specific implementation for counting values
            # 1. Total count subquery (valuesCount)
            total_count = select(func.count(column)).scalar_subquery()

            # 2. Unique count subquery (uniqueCount)
            unique_subq = (
                select(column)
                .group_by(column)
                .having(func.count() == 1)
                .alias("unique_subquery")
            )

            unique_count = (
                select(func.count()).select_from(unique_subq).scalar_subquery()
            )

            # 3. Final query combining both counts
            final_query = select(
                total_count.label("valuesCount"), unique_count.label("uniqueCount")
            ).subquery()

            self.value = dict(self.runner.dispatch_query_select_first(final_query))  # type: ignore
            res = self.value.get(Metrics.COUNT.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        if res is None:
            raise ValueError(
                f"\nOracle query on table/column {column.name if column is not None else ''} returned None."
                "Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: "
                "https://docs.open-metadata.org/latest/how-to-guides/data-quality-observability/quality \n"
                "\t2. reach out to the Collate team for support"
            )

        return res

    def _get_unique_count(self, metric: Metrics, column: Column) -> Optional[int]:
        """Get unique count of values"""
        return self.value.get("uniqueCount")
