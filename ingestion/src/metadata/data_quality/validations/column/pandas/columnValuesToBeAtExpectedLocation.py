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
Pandas validator for column value to be at expected location test case
"""

from typing import List, cast

from metadata.data_quality.validations.column.base.columnValuesToBeAtExpectedLocation import (
    BaseColumnValuesToBeAtExpectedLocationValidator,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeAtExpectedLocationValidator(
    BaseColumnValuesToBeAtExpectedLocationValidator, PandasValidatorMixin
):
    """Validator for column value to be at expected location test case"""

    def _fetch_data(self, columns: List[str]):
        from pandas import DataFrame  # pylint: disable=import-outside-toplevel

        self.runner = cast(List[DataFrame], self.runner)
        for df in self.runner:
            for idx in df.index:
                yield df.loc[idx, columns]
