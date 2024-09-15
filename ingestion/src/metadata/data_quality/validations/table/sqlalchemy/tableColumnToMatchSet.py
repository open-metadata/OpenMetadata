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
Validator for table column name to match set test case
"""


from typing import List, cast

from sqlalchemy import inspect
from sqlalchemy.sql.base import ColumnCollection

from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableColumnToMatchSet import (
    BaseTableColumnToMatchSetValidator,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TableColumnToMatchSetValidator(
    BaseTableColumnToMatchSetValidator, SQAValidatorMixin
):
    """Validator for table column name to match set test case"""

    def _run_results(self) -> List[str]:
        """compute result of the test case"""
        names = inspect(self.runner.table).c
        if not names:
            raise ValueError(
                f"Column names for test case {self.test_case.name} returned None"
            )
        names = cast(
            ColumnCollection, names
        )  # satisfy type checker for names.keys() access
        names = list(names.keys())
        return names
