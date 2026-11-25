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
Validator for column value rule library SQL expression
"""

from collections.abc import Sequence
from typing import Any

from metadata.data_quality.validations.mixins.failed_sample_validator_mixin import (
    FailedSampleValidatorMixin,
)
from metadata.data_quality.validations.mixins.rule_library_threshold_mixin import (
    RuleLibraryThresholdMixin,
)
from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.data_quality.validations.utils import (
    extract_rule_library_raw_user_params,
    extract_rule_library_user_params,
    get_template_variables,
    get_test_definition_param_types,
    render_sql_expression,
)
from metadata.generated.schema.entity.data.table import ColumnName, TableData
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testDefinition import TestDataType
from metadata.utils.entity_link import get_column_name_or_none, get_table_fqn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

RESERVED_PARAMS = {"column_name", "table_name"}

DATABASES_WITHOUT_DATABASE_CONCEPT = {
    DatabaseServiceType.Athena.value,
    DatabaseServiceType.Mysql.value,
    DatabaseServiceType.MariaDB.value,
    DatabaseServiceType.SQLite.value,
    DatabaseServiceType.Cockroach.value,
}


class ColumnRuleLibrarySqlExpressionValidator(FailedSampleValidatorMixin, RuleLibraryThresholdMixin):
    """Validator for column-level SQL Expression based rules in the Rule Library."""

    # The rule's SQL is executed as written, so the sampler never sees it.
    BYPASSES_SAMPLER = True

    runtime_params: RuleLibrarySqlExpressionRuntimeParameters

    # Columns and first rows of what the rule returned, kept by `_run_results` so the failed rows
    # sample costs no second query. None when the rule returned nothing that can be stored.
    _failed_rows: tuple[list[str], Sequence[Any]] | None = None

    def _get_parameter_types(self) -> dict[str, TestDataType]:
        """Map declared parameter names to their TestDataType from the test definition."""
        runtime_params = getattr(self, "runtime_params", None)
        test_definition = getattr(runtime_params, "test_definition", None) if runtime_params is not None else None
        return get_test_definition_param_types(test_definition)

    def _get_raw_user_params(self) -> dict[str, str]:
        """Extract raw string user-defined parameters without type coercion."""
        return extract_rule_library_raw_user_params(self.test_case.parameterValues, RESERVED_PARAMS)

    def _get_user_params(self, only_params: set[str] | None = None) -> dict[str, Any]:
        """Extract and coerce user-defined parameters from test case parameterValues.

        Args:
            only_params: Optional subset of parameter names to extract and coerce

        Returns:
            Dict mapping parameter names to their typed values
        """
        return extract_rule_library_user_params(
            self.test_case.parameterValues,
            RESERVED_PARAMS,
            self._get_parameter_types(),
            only_params=only_params,
        )

    def compile_sql_expression(self, column_name: str, table_name: str) -> str:
        """Compile SQL expression template using Jinja2.

        Replaces:
        - {{ column_name }} with the actual column name
        - {{ table_name }} with the actual table path
        - {{ paramName }} with user-defined parameter values

        Args:
            column_name: Column name from entity link
            table_name: Table path for SQL execution

        Returns:
            Compiled SQL expression with all parameters substituted

        Raises:
            ValueError: If sqlExpression is not defined or template rendering fails
        """
        sql_template = self.runtime_params.test_definition.sqlExpression
        if not sql_template:
            raise ValueError("Test definition does not have sqlExpression defined")

        referenced_vars = get_template_variables(sql_template.root)
        params: dict[str, Any] = {
            "column_name": column_name,
            "table_name": table_name,
        }
        params.update(self._get_user_params(only_params=referenced_vars))

        return render_sql_expression(sql_template.root, params)

    def _run_results(self, sql_expression: str) -> int:
        raise NotImplementedError

    def fetch_failed_rows_sample(self) -> TableData | None:
        if self._failed_rows is None:
            return None
        columns, rows = self._failed_rows
        return TableData.model_validate({"columns": [ColumnName(column) for column in columns], "rows": rows})

    def get_column_name(self) -> str:
        """Get the column name from the test case entity link.

        Extracts the column name from the entityLink which has the format:
        <#E::table::serviceName.databaseName.schemaName.tableName::columns::columnName>

        Returns:
            str: The column name

        Raises:
            ValueError: If no column name is found in the entity link
        """
        entity_link = self.test_case.entityLink.root
        column_name = get_column_name_or_none(entity_link)
        if column_name is None:
            raise ValueError(
                f"No column name found in entity link: {entity_link}. "
                "Column-level test definitions require a column reference."
            )
        return column_name

    def get_table_name(self) -> str:
        """Get the full table path from the test case entity link for SQL execution.

        Extracts the table path from the entityLink. The FQN structure is always:
        serviceName.databaseName.schemaName.tableName (4 parts)

        However, the returned path varies by database type:
        - Databases WITH database concept (Snowflake, PostgreSQL, etc.):
          Returns: databaseName.schemaName.tableName
        - Databases WITHOUT database concept (MySQL, MariaDB, SQLite, etc.):
          Returns: schemaName.tableName (skips the placeholder database name)

        The serviceName is OpenMetadata internal and is always excluded.
        Uses runtime_params to determine the database type.

        Returns:
            str: The qualified table path for SQL execution
        """
        entity_link = self.test_case.entityLink.root
        table_fqn = get_table_fqn(entity_link)
        parts = table_fqn.split(".")

        db_type = self.runtime_params.conn_config.config.type

        if db_type.value in DATABASES_WITHOUT_DATABASE_CONCEPT:
            return ".".join(parts[2:])
        return ".".join(parts[1:])

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        self.runtime_params = self.get_runtime_parameters(RuleLibrarySqlExpressionRuntimeParameters)

        column_name = self.get_column_name()
        table_name = self.get_table_name()
        sql_expression = self.compile_sql_expression(column_name, table_name)
        count: int = self._run_results(sql_expression)

        return self.get_rule_library_result(f"Column '{column_name}' in table '{table_name}'", count)
