#  Copyright 2024 Collate
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
Module that defines the RuntimeParameterFactory class.
This class is responsible for creating instances of the RuntimeParameterSetter 
based on the test case.
"""
import sys
from typing import Dict, Set, Type

from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    TableDiffValidator,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_interface import SamplerInterface


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
        self._setter_map: Dict[str, Set[Type[RuntimeParameterSetter]]] = {
            validator_name(TableDiffValidator): {TableDiffParamsSetter},
        }

    def get_runtime_param_setters(
        self,
        name: str,
        ometa: OpenMetadata,
        service_connection_config,
        table_entity: Table,
        sampler: SamplerInterface,
    ) -> Set[RuntimeParameterSetter]:
        """Get the runtime parameter setter"""
        return {
            setter(
                ometa,
                service_connection_config,
                table_entity,
                sampler,
            )
            for setter in self._setter_map.get(name, set())
        }
