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

"""Pandas validator for rule library SQL expression tests"""

from metadata.data_quality.validations.column.base.ruleLibrarySqlExpressionValidator import (
    RuleLibrarySqlExpressionValidator as BaseValidator,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class RuleLibrarySqlExpressionValidator(BaseValidator, PandasValidatorMixin):
    """Pandas implementation of Rule Library SQL Expression validator.

    For Pandas sources, the 'sqlExpression' field contains a pandas query()
    expression (e.g., 'column >= 100'), not actual SQL. Parameters are
    directly substituted via Jinja2.
    """

    def _run_results(self, sql_expression: str) -> int:
        """Execute the pandas query expression and return matching row count.

        Iterates over DataFrame chunks to avoid loading all data into memory.
        Each chunk is queried independently and counts are summed.

        Args:
            expression: Compiled pandas query expression with all params substituted

        Returns:
            Total count of matching rows across all dataframe chunks
        """
        total_count = 0
        for df in self.runner:
            try:
                matching_rows = df.query(sql_expression)
                total_count += len(matching_rows)
            except Exception as exc:
                logger.exception(
                    f"Error executing pandas query expression on chunk: {exc}"
                )
                raise exc
        return total_count
