#  Copyright 2022 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Generic test case builder"""


class GenericTestCaseBuilder:
    """Generic TestCase builder to create test case entity

    Attributes:
        test_case_builder: Specific builder for the GE expectation
    """

    def __init__(self, *, test_case_builder):
        self.test_case_builder = test_case_builder

    def build_test_from_builder(self):
        """Main method to build the test case entity
        and send the results to OMeta
        """
        self.test_case_builder.add_test()
