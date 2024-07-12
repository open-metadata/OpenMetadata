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
from typing import Optional

from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


class IValidatorBuilder(ABC):
    """Interface for validator builders"""

    @property
    @abstractmethod
    def test_case(self):
        """Return the test case object"""
        raise NotImplementedError

    @property
    @abstractmethod
    def validator(self):
        """Return the validator object"""
        raise NotImplementedError

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
            self.test_case.parameterValues.append(
                TestCaseParameterValue(
                    name="runtimeParams", value=params.model_dump_json()
                )
            )

    @abstractmethod
    def reset(self):
        """Reset the builder"""
        raise NotImplementedError
