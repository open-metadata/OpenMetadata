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

from pydantic import BaseModel


class TableTest(BaseModel):
    """
    Incoming table test definition from the workflow
    """

    name: str
    table: str  # fullyQualifiedName
    expression: str
    enabled: bool = True


class ColumnTestExpression(BaseModel):
    """
    Column test expression definition
    """

    name: str
    column: str
    expression: str
    enabled: bool = True


class ColumnTest(BaseModel):
    """
    Incoming column test definition from the workflow
    """

    table: str  # fullyQualifiedName
    name: str  # Set of col tests
    columns: List[ColumnTestExpression]


class TestDef(BaseModel):
    """
    Base Test definition
    """

    name: str
    table_tests: List[TableTest] = None
    column_tests: List[ColumnTest] = None
