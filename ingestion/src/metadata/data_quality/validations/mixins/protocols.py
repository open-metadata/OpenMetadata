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
Protocols used byt he Mixins
"""
from typing import TYPE_CHECKING, List, Protocol, Union, runtime_checkable

if TYPE_CHECKING:
    from pandas import DataFrame

    from metadata.generated.schema.tests.testCase import TestCase
    from metadata.profiler.processor.runner import QueryRunner


@runtime_checkable
class HasValidatorContext(Protocol):
    """Contract: Classes using validaotr Mixings must provide context"""

    runner: "Union[QueryRunner, List[DataFrame]]"
    test_case: "TestCase"
