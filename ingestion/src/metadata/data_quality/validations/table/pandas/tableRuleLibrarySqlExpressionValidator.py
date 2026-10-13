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

"""Pandas validator for table rule library SQL expression tests"""

from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator as BaseValidator,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TableRuleLibrarySqlExpressionValidator(BaseValidator, PandasValidatorMixin):
    """Pandas implementation of Table Rule Library SQL Expression validator.

    For Pandas sources, the 'sqlExpression' field contains a pandas query()
    expression. Parameters are directly substituted via Jinja2.
    """

    # The expression runs on the dataframes the sampler produced, so unlike the SQL variant
    # it is evaluated on the configured sample and partition.
    BYPASSES_SAMPLER = False

    # Rows read while evaluating the expression, so the denominator does not cost a second pass
    # over the dataset.
    _evaluated_rows: int = 0

    def _run_results(self, sql_expression: str) -> int:
        """Execute the pandas query expression and return matching row count."""
        total_count = 0
        evaluated_rows = 0
        for df in self.runner:
            evaluated_rows += len(df)
            try:
                matching_rows = df.query(sql_expression)
                total_count += len(matching_rows)
            except Exception as exc:
                logger.exception(f"Error executing pandas query expression on chunk: {exc}")  # noqa: TRY401
                raise exc  # noqa: TRY201
        self._evaluated_rows = evaluated_rows
        return total_count

    def _run_row_count(self) -> int:
        return self._evaluated_rows
