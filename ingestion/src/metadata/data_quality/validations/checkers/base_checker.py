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
from typing import Any, Callable


class BaseValidationChecker(ABC):
    """Base Checker Abstract Class"""

    @abstractmethod
    def check_pandas(self, value: Any) -> bool:
        """Check if value violates condition. Used for Pandas Data Quality"""

    @abstractmethod
    def get_sqa_failed_rows_builder(
        self, metric_col_name: str, total_count_col_name: str
    ) -> Callable:
        """Build SQLAlchemy Failed Rows expression"""
