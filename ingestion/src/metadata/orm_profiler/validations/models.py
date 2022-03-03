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
Models to map tests and validations from
JSON workflows to the profiler
"""
from typing import List, Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.api.tests.createTableTest import CreateTableTestRequest


class TestDef(ConfigModel):
    """
    Table test definition

    We expect:
    - table name
    - List of table tests
    - List of column tests
    """

    table: str  # Table FQDN
    table_tests: Optional[List[CreateTableTestRequest]] = None
    column_tests: Optional[List[CreateColumnTestRequest]] = None


class TestSuite(ConfigModel):
    """
    Config test definition
    """

    name: str  # Test Suite name
    tests: List[TestDef]
