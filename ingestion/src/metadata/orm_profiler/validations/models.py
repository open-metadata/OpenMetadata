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
from typing import List

from parsimonious import ParseError
from pydantic import BaseModel, validator

from metadata.config.common import ConfigModel
from metadata.generated.schema.tests.columnTest import ColumnTest
from metadata.generated.schema.tests.tableTest import TableTest
from metadata.orm_profiler.utils import logger
from metadata.orm_profiler.validations.core import Validation
from metadata.orm_profiler.validations.grammar import ExpVisitor, parse


class TestDef(ConfigModel):
    """
    Table test definition

    We expect:
    - table name
    - List of table tests
    - List of column tests
    """

    table: str  # Table FQDN
    table_tests: List[TableTest] = None
    column_tests: List[ColumnTest] = None


class TestSuite(ConfigModel):
    """
    Config test definition
    """

    name: str  # Test Suite name
    tests: List[TestDef]
