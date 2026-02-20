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
from typing import TYPE_CHECKING, Any, List, Mapping

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

    def _check_violations(self, values):
        """Core violation check logic - works for both scalar and Series.

        Checks if values are outside [min_bound, max_bound].
        This method is polymorphic: works identically for scalar values and pandas Series.

        Args:
            values: Single value or pandas Series

        Returns:
            Boolean or Series of booleans indicating violations (True = violates)
        """
        import pandas as pd

        return ~pd.isna(values) & (
            (values < self.min_bound) | (values > self.max_bound)
        )

    def _value_violates(self, value: Any) -> bool:
        """Check violation of one value (scalar).

        Args:
            value: Single value to check

        Returns:
            bool: True if value violates bounds
        """
        return bool(self._check_violations(value))

    def get_violations_mask(self, series):
        """Get boolean mask of violations for pandas Series (vectorized).

        Returns a boolean Series where True indicates a violation.
        Implements the same logic as _value_violates() but vectorized for performance.

        Args:
            series: pandas Series of values to check

        Returns:
            pandas Series of booleans indicating violations
        """
        return self._check_violations(series)

    def violates_pandas(self, metrics: Mapping[str, Any]) -> bool:
        """Check if any value is outside [min_bound, max_bound]. Used on Pandas Data Quality."""
        return any(self._value_violates(value) for value in metrics.values())

    def build_violation_sqa(self, metrics: List["ClauseElement"]) -> "ClauseElement":
        """Build SQA Violation Expression"""
        from sqlalchemy import and_, literal, or_

        conditions = []
        for expr in metrics:
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

    def build_row_level_violations_sqa(
        self, column: "ClauseElement"
    ) -> "ClauseElement":
        """Build SQL expression to count row-level violations.

        Returns a SUM(CASE...) expression that counts individual rows where
        the column value is outside [min_bound, max_bound].

        This is the SQL equivalent of get_violations_mask() for pandas.

        Args:
            column: SQLAlchemy column expression to check

        Returns:
            SQLAlchemy expression that sums up row-level violations
        """
        from sqlalchemy import and_, case, func, literal, or_

        # Build condition: value NOT NULL AND (value < min OR value > max)
        conditions = []

        if not math.isinf(self.min_bound):
            conditions.append(and_(column.isnot(None), column < self.min_bound))
        if not math.isinf(self.max_bound):
            conditions.append(and_(column.isnot(None), column > self.max_bound))

        if not conditions:
            return literal(0)

        violation_condition = or_(*conditions) if len(conditions) > 1 else conditions[0]

        # Return SUM(CASE WHEN violation THEN 1 ELSE 0 END)
        return func.sum(case((violation_condition, literal(1)), else_=literal(0)))
