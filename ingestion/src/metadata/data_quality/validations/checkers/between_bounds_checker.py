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
BetweenBoundsChecker implements the checker for any metric that should be between two bounds
"""
import math
from typing import Any, Callable

from metadata.data_quality.validations.checkers.base_checker import (
    BaseValidationChecker,
)


class BetweenBoundsChecker(BaseValidationChecker):
    """Checks if value is outside [min_bound, max_bound]"""

    def __init__(self, min_bound: float, max_bound: float):
        self.min_bound = min_bound
        self.max_bound = max_bound

    def check_pandas(self, value: Any) -> bool:
        """Check if value is outside [min_bound, max_bound]. Used on Pandas Data Quality."""
        import pandas as pd

        if value is None or pd.isna(value):
            return False

        return not (self.min_bound <= value <= self.max_bound)

    def get_sqa_failed_rows_builder(
        self, metric_col_name: str, total_count_col_name: str
    ) -> Callable:
        """Builds SQA Failed Rows Expression. If metric is outside bounds, failed rows count = total rows count. Else, failed rows count = 0."""
        from sqlalchemy import case, literal, or_

        def build_sqa_failed_rows_expression(cte):
            conditions = []
            metric_col = getattr(cte.c, metric_col_name)
            total_count_col = getattr(cte.c, total_count_col_name)

            if not math.isinf(self.min_bound):
                conditions.append(metric_col < self.min_bound)
            if not math.isinf(self.max_bound):
                conditions.append(metric_col > self.max_bound)

            if not conditions:
                return literal(0)

            violation = or_(*conditions) if len(conditions) > 1 else conditions[0]

            return case(
                (metric_col.is_(None), literal(0)),
                (violation, total_count_col),
                else_=literal(0),
            )

        return build_sqa_failed_rows_expression
