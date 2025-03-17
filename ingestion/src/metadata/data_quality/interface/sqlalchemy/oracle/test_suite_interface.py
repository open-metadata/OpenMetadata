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
Oracle specific test suite interface
"""

from metadata.data_quality.builders.sqlalchemy.oracle.validator_builder import (
    OracleValidatorBuilder,
)
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)


class OracleTestSuiteInterface(SQATestSuiteInterface):
    """Oracle specific test suite interface"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.validator_builder_class = OracleValidatorBuilder
