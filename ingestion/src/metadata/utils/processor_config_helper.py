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
Helper for the procoessor.config yaml/json config file
"""

from typing import List, Optional

from metadata.generated.schema.entity.data.table import Table
from metadata.orm_profiler.validations.models import TestCase


def get_record_test_def(table: Table) -> List[Optional[TestCase]]:
    """
    Fetch a record from the Workflow JSON config
    if the processed table is informed there.

    :param table: Processed table
    :return: Test definition
    """
    my_record_tests = [
        test_case
        for test_suite in self.config.testSuites
        for test_case in test_suite.testCases
        if test_case.fullyQualifiedName == table.fullyQualifiedName.__root__
    ]
    return my_record_tests
