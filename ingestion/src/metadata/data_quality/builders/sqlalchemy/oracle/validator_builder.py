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

from typing import Type

from metadata.data_quality.builders.validator_builder import (
    SourceType,
    ValidatorBuilder,
)
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.column.sqlalchemy.oracle.columnValuesToBeUnique import (
    OracleColumnValuesToBeUniqueValidator,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.profiler.processor.runner import QueryRunner


class OracleValidatorBuilder(ValidatorBuilder):
    """Interface for validator builders"""

    ORACLE_TEST_BUILDERS = {
        "columnValuesToBeUnique": OracleColumnValuesToBeUniqueValidator
    }

    def __init__(
        self,
        entity_type: str,
        source_type: SourceType,
        test_case: TestCase,
        runner: QueryRunner,
    ) -> None:
        super().__init__(runner, test_case, source_type, entity_type)

        self.validator_cls: Type[BaseTestValidator] = self.ORACLE_TEST_BUILDERS.get(
            self.test_case.testDefinition.fullyQualifiedName,
            super().import_test_case_validator(
                entity_type,
                source_type.value,
                self.test_case.testDefinition.fullyQualifiedName,
            ),
        )
        self.reset()
