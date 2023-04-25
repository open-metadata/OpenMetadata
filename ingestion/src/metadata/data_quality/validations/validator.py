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
Test case validator object
"""

from metadata.generated.schema.tests.basic import TestCaseResult


class Validator:
    """Test case validator object. it take test handler obkect and run validation"""

    def __init__(self, validator_obj):
        self.validator_obj = validator_obj

    def validate(self) -> TestCaseResult:
        return self.validator_obj.run_validation()
