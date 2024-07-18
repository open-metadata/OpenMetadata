#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Builder interface defining the structure of builders for validators.
Validators are test classes (e.g. columnValuesToBeBetween, etc.)
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING, Optional, Type, Union

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.importer import import_test_case_class

if TYPE_CHECKING:
    from pandas import DataFrame


class IValidatorBuilder(ABC):
    """Interface for validator builders"""

    @property
    def test_case(self):
        """Return the test case object"""
        return self._test_case

    @property
    def validator(self):
        """Return the validator object"""
        return self._validator

    def __init__(
        self,
        runner: Union[QueryRunner, "DataFrame"],
        test_case: TestCase,
        entity_type: str,
    ) -> None:
        """Builder object for SQA validators. This builder is used to create a validator object

        Args:
            runner (QueryRunner): The runner object
            test_case (TestCase): The test case object
            entity_type (str): one of COLUMN or TABLE -- fetched from the test definition
        """
        self._test_case = test_case
        self.runner = runner
        self.validator_cls: Type[BaseTestValidator] = import_test_case_class(
            entity_type,
            self._get_source_type(),
            self.test_case.testDefinition.fullyQualifiedName,  # type: ignore
        )
        self.reset()

    def set_runtime_params(
        self, runtime_params_setter: Optional[RuntimeParameterSetter]
    ):
        """Set the runtime parameters for the validator object

        # TODO: We should support setting n runtime parameters

        Args:
            runtime_params_setter (Optional[RuntimeParameterSetter]): The runtime parameter setter
        """
        if runtime_params_setter:
            params = runtime_params_setter.get_parameters(self.test_case)
            if not self.test_case.parameterValues:
                # If there are no parameters, create a new list
                self.test_case.parameterValues = []
            self.test_case.parameterValues.append(
                TestCaseParameterValue(
                    name="runtimeParams", value=params.model_dump_json()
                )
            )

    def reset(self):
        """Reset the builder"""
        self._validator = self.validator_cls(
            self.runner,
            test_case=self.test_case,
            execution_date=int(datetime.now().timestamp() * 1000),
        )

    @abstractmethod
    def _get_source_type(self):
        """Get the source type"""
        raise NotImplementedError
