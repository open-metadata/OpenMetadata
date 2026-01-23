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

"""SQLAlchemy validator for rule library SQL expression tests"""

from typing import Dict, Tuple

from jinja2 import Template
from sqlalchemy import text

from metadata.data_quality.validations.column.base.ruleLibrarySqlExpressionValidator import (
    RuleLibrarySqlExpressionValidator as BaseValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class RuleLibrarySqlExpressionValidator(BaseValidator, SQAValidatorMixin):
    """SQLAlchemy implementation of Rule Library SQL Expression validator."""

    def compile_sql_expression(
        self, column_name: str, table_name: str
    ) -> Tuple[str, Dict[str, str]]:
        """Compile SQL expression with SQLAlchemy bind parameters using Jinja2.

        For SQLAlchemy, user parameters are converted to bind parameters (:paramName)
        while reserved parameters (column_name, table_name) are directly substituted.

        Args:
            column_name: Column name from entity link
            table_name: Table path for SQL execution

        Returns:
            Tuple of (compiled SQL with bind params, dict of bind param values)
        """
        sql_template = self.runtime_params.test_definition.sqlExpression
        if not sql_template:
            raise ValueError("Test definition does not have sqlExpression defined")

        user_params = self._get_user_params()

        bind_params_template = {
            "column_name": column_name,
            "table_name": table_name,
        }
        for param_name in user_params:
            bind_params_template[param_name] = f":{param_name}"

        template = Template(sql_template.root)
        compiled_sql = template.render(**bind_params_template)

        return compiled_sql, user_params

    def _run_results(self, sql_expression: Tuple[str, Dict[str, str]]) -> int:
        """Execute the compiled SQL and return the row count.

        Wraps the user query in COUNT(*) to prevent OOM issues from
        loading all matching rows into memory.

        Args:
            sql_expression: Tuple of (SQL string, bind params dict)

        Returns:
            Number of rows returned by the query
        """
        compiled_sql, bind_params = sql_expression

        if not is_safe_sql_query(compiled_sql):
            raise RuntimeError(f"SQL expression is not safe\n\n{compiled_sql}")

        count_query = f"SELECT COUNT(*) FROM ({compiled_sql}) AS subquery"

        try:
            result = self.runner._session.execute(
                text(count_query), bind_params
            ).scalar()
            return result or 0
        except Exception as exc:
            self.runner._session.rollback()
            logger.exception(f"Error executing SQL expression: {exc}")
            raise exc
