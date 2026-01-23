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
Validator for table rule library SQL expression
"""
from typing import Dict

from jinja2 import Template

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue
from metadata.utils.entity_link import get_table_fqn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

RESERVED_PARAMS = {"table_name"}

DATABASES_WITHOUT_DATABASE_CONCEPT = {
    DatabaseServiceType.Mysql.value,
    DatabaseServiceType.MariaDB.value,
    DatabaseServiceType.SQLite.value,
    DatabaseServiceType.Cockroach.value,
}


class TableRuleLibrarySqlExpressionValidator(BaseTestValidator):
    """Validator for table-level SQL Expression based rules in the Rule Library."""

    runtime_params: RuleLibrarySqlExpressionRuntimeParameters

    def _get_user_params(self) -> Dict[str, str]:
        """Extract user-defined parameters from test case parameterValues."""
        params = {}
        if self.test_case.parameterValues:
            for param in self.test_case.parameterValues:
                if param.name and param.value and param.name not in RESERVED_PARAMS:
                    if not param.name.endswith("RuntimeParameters"):
                        params[param.name] = param.value
        return params

    def compile_sql_expression(self, table_name: str) -> str:
        """Compile SQL expression template using Jinja2.

        Replaces:
        - {{ table_name }} with the actual table path
        - {{ paramName }} with user-defined parameter values

        Args:
            table_name: Table path for SQL execution

        Returns:
            Compiled SQL expression with all parameters substituted
        """
        sql_template = self.runtime_params.test_definition.sqlExpression
        if not sql_template:
            raise ValueError("Test definition does not have sqlExpression defined")

        params = {"table_name": table_name}
        params.update(self._get_user_params())

        template = Template(sql_template.root)
        return template.render(**params)

    def _run_results(self, sql_expression) -> int:
        raise NotImplementedError

    def get_table_name(self) -> str:
        """Get the full table path from the test case entity link for SQL execution."""
        entity_link = self.test_case.entityLink.root
        table_fqn = get_table_fqn(entity_link)
        parts = table_fqn.split(".")

        db_type = self.runtime_params.conn_config.config.type

        if db_type.value in DATABASES_WITHOUT_DATABASE_CONCEPT:
            return ".".join(parts[2:])
        return ".".join(parts[1:])

    def _run_validation(self) -> TestCaseResult:
        """Execute the table-level SQL expression validation."""
        self.runtime_params = self.get_runtime_parameters(
            RuleLibrarySqlExpressionRuntimeParameters
        )

        table_name = self.get_table_name()
        sql_expression = self.compile_sql_expression(table_name)
        count: int = self._run_results(sql_expression)

        result_message = (
            f"Table '{table_name}' has {count} rows matching the condition. Expected 0."
        )

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(count == 0),
            result_message,
            [TestResultValue(name="Row Count", value=str(count), predictedValue=None)],
        )
