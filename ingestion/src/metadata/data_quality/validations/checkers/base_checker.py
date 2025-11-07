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
from typing import TYPE_CHECKING, Any, Callable, Mapping

if TYPE_CHECKING:
    from sqlalchemy.sql.elements import ClauseElement


class BaseValidationChecker(ABC):
    """Base Checker Abstract Class"""

    @abstractmethod
    def violates_pandas(self, metrics: Mapping[str, Any]) -> bool:
        """Return True if the provided Pandas metric values violate the condition."""

    @abstractmethod
    def build_violation_sqa(
        self, metrics: Mapping[str, "ClauseElement"]
    ) -> "ClauseElement":
        """Build SQLAlchemy Failed Rows expression"""

    def get_sqa_failed_rows_builder(
        self, metric_col_names: Mapping[str, str], total_count_col_name: str
    ) -> Callable[[Any], "ClauseElement"]:

        """
        Default builder: map CTE columns to metric keys, use violation predicate, and
        return a CASE that yields total_count on violation, else 0.
        """
        from sqlalchemy import case, literal

        def build(cte):
            cols = {
                k: getattr(cte.c, col_name) for k, col_name in metric_col_names.items()
            }
            total_count = getattr(cte.c, total_count_col_name)
            violation = self.build_violation_sqa(cols)
            return case((violation, total_count), else_=literal(0))

        return build
