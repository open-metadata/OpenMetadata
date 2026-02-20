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
Base Checker abstract class.
Should be extended to implement different validation checkers that are used to define if a given data quality test passes or fails.
"""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, List, Mapping

if TYPE_CHECKING:
    from sqlalchemy.sql.elements import ClauseElement


class BaseValidationChecker(ABC):
    """Base Checker Abstract Class"""

    @abstractmethod
    def violates_pandas(self, metrics: Mapping[str, Any]) -> bool:
        """Return True if the provided Pandas metric values violate the condition."""

    @abstractmethod
    def build_violation_sqa(self, metrics: List["ClauseElement"]) -> "ClauseElement":
        """Build SQLAlchemy Failed Rows expression"""

    def build_agg_level_violation_sqa(
        self, metric_expressions: List["ClauseElement"], row_count_expr: str
    ) -> "ClauseElement":

        """
        Default builder: map CTE columns to metric keys, use violation predicate, and
        return a CASE that yields total_count on violation, else 0.
        """
        from sqlalchemy import case, literal

        return case(
            [(self.build_violation_sqa(metric_expressions), row_count_expr)],
            else_=literal(0),
        )
