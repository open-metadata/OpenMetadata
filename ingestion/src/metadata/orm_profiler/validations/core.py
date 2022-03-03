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
Core Validation definitions.

In this module we define how to check specific test case
behavior based on the computed metrics of the profiler.

These functions should not raise an error, but rather
mark the test as Failure/Aborted and pass a proper
result string. The ORM Processor will be the one in charge
of logging these issues.
"""
from functools import singledispatch

from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.orm_profiler.utils import logger
from metadata.orm_profiler.validations.column.column_values_not_in_set import (
    column_values_not_in_set,
)
from metadata.orm_profiler.validations.column.column_values_to_be_between import (
    column_values_to_be_between,
)
from metadata.orm_profiler.validations.column.column_values_to_be_not_null import (
    column_values_to_be_not_null,
)
from metadata.orm_profiler.validations.column.column_values_to_be_unique import (
    column_values_to_be_unique,
)
from metadata.orm_profiler.validations.table.table_column_count_to_equal import (
    table_column_count_to_equal,
)
from metadata.orm_profiler.validations.table.table_row_count_to_be_between import (
    table_row_count_to_be_between,
)
from metadata.orm_profiler.validations.table.table_row_count_to_equal import (
    table_row_count_to_equal,
)

logger = logger()


@singledispatch
def validate(test_case, **kwargs) -> TestCaseResult:
    """
    Default function to validate test cases.

    Note that the first argument should be a positional argument.
    """
    raise NotImplementedError(
        f"Missing test case validation implementation for {type(test_case)}."
    )


# Table Tests
validate.register(table_row_count_to_equal)
validate.register(table_row_count_to_be_between)
validate.register(table_column_count_to_equal)

# Column Tests
validate.register(column_values_to_be_between)
validate.register(column_values_to_be_unique)
validate.register(column_values_to_be_not_null)

# Column Session Tests
validate.register(column_values_not_in_set)
