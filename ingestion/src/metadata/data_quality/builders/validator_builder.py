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
Builder interface defining the structure of builders for validators.
Validators are test classes (e.g. columnValuesToBeBetween, etc.)
"""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Set, Type, Union

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.importer import import_test_case_class

if TYPE_CHECKING:
    from pandas import DataFrame


class TestCaseImporter:
    def import_test_case_validator(
        self,
        test_type: str,
        runner_type: str,
        test_definition: str,
    ) -> Type[BaseTestValidator]:
        return import_test_case_class(test_type, runner_type, test_definition)


class SourceType(Enum):
    PANDAS = "pandas"
    SQL = "sqlalchemy"


class ValidatorBuilder(TestCaseImporter):
    """Interface for validator builders"""

    def __init__(
        self,
        runner: Union[QueryRunner, "DataFrame"],
        test_case: TestCase,
        source_type: SourceType,
        entity_type: str,
    ) -> None:
        """Builder object for SQA validators. This builder is used to create a validator object

        Args:
            runner (QueryRunner): The runner object
            test_case (TestCase): The test case object
            source_type (SourceType): The source type
            entity_type (str): one of COLUMN or TABLE -- fetched from the test definition
        """
        super().__init__()
        self._test_case = test_case
        self.runner = runner
        self.validator_cls: Type[
            BaseTestValidator
        ] = super().import_test_case_validator(
            entity_type,
            source_type.value,
            self.test_case.testDefinition.fullyQualifiedName,
        )
        self.reset()

    @property
    def test_case(self):
        """Return the test case object"""
        return self._test_case

    @property
    def validator(self):
        """Return the validator object"""
        return self._validator

    def set_runtime_params(self, runtime_params_setters: Set[RuntimeParameterSetter]):
        """Set the runtime parameters for the validator object

        Args:
            runtime_params_setters (Optional[RuntimeParameterSetter]): The runtime parameter setter
        """
        for setter in runtime_params_setters:
            params = setter.get_parameters(self.test_case)
            if not self.test_case.parameterValues:
                # If there are no parameters, create a new list
                self.test_case.parameterValues = []
            self.test_case.parameterValues.append(
                TestCaseParameterValue(
                    name=type(params).__name__, value=params.model_dump_json()
                )
            )

    def reset(self):
        """Reset the builder"""
        self._validator = self.validator_cls(
            self.runner,
            test_case=self.test_case,
            execution_date=Timestamp(
                int(datetime.now(tz=timezone.utc).timestamp() * 1000)
            ),
        )
