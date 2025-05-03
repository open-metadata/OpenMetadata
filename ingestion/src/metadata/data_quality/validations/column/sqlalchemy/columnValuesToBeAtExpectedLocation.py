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
SQA validator for column value to be at expected location test case
"""

from typing import Iterator, List, cast

from sqlalchemy import Column, inspect

from metadata.data_quality.validations.column.base.columnValuesToBeAtExpectedLocation import (
    BaseColumnValuesToBeAtExpectedLocationValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeAtExpectedLocationValidator(
    BaseColumnValuesToBeAtExpectedLocationValidator, SQAValidatorMixin
):
    """Validator for column value to be at expected location test case"""

    def _fetch_data(self, columns: List[str]) -> Iterator:
        """Fetch data from the runner object"""
        self.runner = cast(QueryRunner, self.runner)
        inspection = inspect(self.runner.dataset)
        table_columns: List[Column] = inspection.c if inspection is not None else []
        cols = [col for col in table_columns if col.name in columns]
        for col in cols:
            col.key = col.name

        yield from self.runner.yield_from_sample(*cols)
