#  Copyright 2024 Collate
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
Module that defines the RuntimeParameterFactory class.
This class is responsible for creating instances of the RuntimeParameterSetter 
based on the test case.
"""
import sys
from typing import Dict, Set, Type

from metadata.data_quality.validations.column.base.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.data_quality.validations.runtime_param_setter.rule_library_sql_expression_params_setter import (
    RuleLibrarySqlExpressionParamsSetter,
)
from metadata.data_quality.validations.runtime_param_setter.table_custom_sql_query_params_setter import (
    TableCustomSQLQueryParamsSetter,
)
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
from metadata.data_quality.validations.table.base.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    TableDiffValidator,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def removesuffix(s: str, suffix: str) -> str:
    """A custom implementation of removesuffix for python versions < 3.9

    Args:
        s (str): The string to remove the suffix from
        suffix (str): The suffix to remove

    Returns:
        str: The string with the suffix removed
    """
    if sys.version_info >= (3, 9):
        return s.removesuffix(suffix)
    if s.endswith(suffix):
        return s[: -len(suffix)]
    return s


def validator_name(test_case_class: Type) -> str:
    return removesuffix(
        test_case_class.__name__[0].lower() + test_case_class.__name__[1:], "Validator"
    )


class RuntimeParameterSetterFactory:
    """runtime parameter setter factory class"""

    def __init__(self) -> None:
        """Set"""
        # Map test definition FQN to param setters (for built-in validators)
        self._setter_map: Dict[str, Set[Type[RuntimeParameterSetter]]] = {
            validator_name(TableDiffValidator): {TableDiffParamsSetter},
            validator_name(TableCustomSQLQueryValidator): {
                TableCustomSQLQueryParamsSetter
            },
        }
        # Map validatorClass names to param setters (for rule library validators)
        self._validator_class_map: Dict[str, Set[Type[RuntimeParameterSetter]]] = {
            ColumnRuleLibrarySqlExpressionValidator.__name__: {
                RuleLibrarySqlExpressionParamsSetter
            },
            TableRuleLibrarySqlExpressionValidator.__name__: {
                RuleLibrarySqlExpressionParamsSetter
            },
        }

    def get_runtime_param_setters(
        self,
        name: str,
        ometa: OpenMetadata,
        service_connection_config,
        table_entity: Table,
        sampler: SamplerInterface,
    ) -> Set[RuntimeParameterSetter]:
        """Get the runtime parameter setter.

        First checks if the test definition FQN matches a built-in validator.
        If not found, fetches the test definition and checks the validatorClass
        field for rule library validators.
        """
        # Check built-in validators by FQN
        setter_classes = self._setter_map.get(name, set())

        # If not found, check if it's a rule library validator by validatorClass
        if not setter_classes:
            try:
                test_definition = ometa.get_by_name(
                    entity=TestDefinition,
                    fqn=name,
                )
                if test_definition and test_definition.validatorClass:
                    setter_classes = self._validator_class_map.get(
                        test_definition.validatorClass, set()
                    )
            except Exception as exc:
                logger.debug(f"Could not fetch test definition {name}: {exc}")

        return {
            setter(
                ometa,
                service_connection_config,
                table_entity,
                sampler,
            )
            for setter in setter_classes
        }
