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
from typing import TYPE_CHECKING, Any, Mapping

from metadata.data_quality.validations.checkers.base_checker import (
    BaseValidationChecker,
)

if TYPE_CHECKING:
    from sqlalchemy.sql.elements import ClauseElement


class BetweenBoundsChecker(BaseValidationChecker):
    """Checks if value is outside [min_bound, max_bound]"""

    def __init__(self, min_bound: float, max_bound: float):
        self.min_bound = min_bound
        self.max_bound = max_bound

    def _value_violates(self, value: Any) -> bool:
        """Check violation of one value"""
        import pandas as pd

        if value is None or pd.isna(value):
            return False
        return not (self.min_bound <= value <= self.max_bound)

    def violates_pandas(self, metrics: Mapping[str, Any]) -> bool:
        """Check if any value is outside [min_bound, max_bound]. Used on Pandas Data Quality."""
        return any(self._value_violates(value) for value in metrics.values())

    def build_violation_sqa(
        self, metrics: Mapping[str, "ClauseElement"]
    ) -> "ClauseElement":
        """Build SQA Violation Expression"""
        from sqlalchemy import and_, literal, or_

        conditions = []
        for expr in metrics.values():
            expr_conditions = []

            if not math.isinf(self.min_bound):
                expr_conditions.append(and_(expr.isnot(None), expr < self.min_bound))
            if not math.isinf(self.max_bound):
                expr_conditions.append(and_(expr.isnot(None), expr > self.max_bound))

            if expr_conditions:
                conditions.append(
                    or_(*expr_conditions)
                    if len(expr_conditions) > 1
                    else expr_conditions[0]
                )
        if not conditions:
            return literal(False)
        return or_(*conditions) if len(conditions) > 1 else conditions[0]
