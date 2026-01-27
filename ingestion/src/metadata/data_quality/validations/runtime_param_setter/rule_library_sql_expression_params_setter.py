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
"""Module that defines the RuleLibrarySqlExpressionParamsSetter class."""

from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.testDefinition import TestDefinition


class RuleLibrarySqlExpressionParamsSetter(RuntimeParameterSetter):
    """Set runtime parameters for the rule library sql expression test."""

    def get_parameters(self, test_case) -> RuleLibrarySqlExpressionRuntimeParameters:
        test_definition = self.ometa_client.get_by_name(
            entity=TestDefinition,
            fqn=test_case.testDefinition.fullyQualifiedName,
        )

        if not test_definition:
            raise ValueError(
                f"TestDefinition {test_case.testDefinition.fullyQualifiedName} not found"
            )

        return RuleLibrarySqlExpressionRuntimeParameters(
            conn_config=DatabaseConnection(
                config=self.service_connection_config,
            ),
            test_definition=test_definition,
        )
