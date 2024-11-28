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
Validator for table column count to be equal test case
"""

from typing import Optional

from sqlalchemy import inspect

from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableColumnCountToEqual import (
    BaseTableColumnCountToEqualValidator,
)


class TableColumnCountToEqualValidator(
    BaseTableColumnCountToEqualValidator, SQAValidatorMixin
):
    """Validator for table column count to be equal test case"""

    def _run_results(self) -> Optional[int]:
        """compute result of the test case"""
        count = len(inspect(self.runner.table).c)
        if not count:
            raise ValueError(
                f"Column Count for test case {self.test_case.name} returned None"
            )

        return count
