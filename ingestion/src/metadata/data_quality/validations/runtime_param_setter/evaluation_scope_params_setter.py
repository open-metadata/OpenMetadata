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
"""Module that defines the EvaluationScopeParamsSetter class."""

from metadata.data_quality.validations.models import EvaluationScopeRuntimeParameters
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class EvaluationScopeParamsSetter(RuntimeParameterSetter):
    """Resolve physical execution provenance from the run's sampler."""

    def get_parameters(self, test_case) -> EvaluationScopeRuntimeParameters:
        return EvaluationScopeRuntimeParameters(
            execution_source=getattr(self.sampler, "execution_source", None),
            sample_query=getattr(self.sampler, "sample_query", None),
        )
