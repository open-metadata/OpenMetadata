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

from metadata.orm_profiler.utils import logger
from metadata.orm_profiler.validations.core import Validation
from metadata.orm_profiler.validations.grammar import ExpVisitor, parse

logger = logger()
visitor = ExpVisitor()


class ExpressionModel(BaseModel):
    """
    We use this model to convert expression to Validations
    on the fly while we are parsing the JSON configuration.

    It is a comfortable and fast way to know if we'll be
    able to parse the tests with our grammar.
    """

    expression: List[Validation]
    enabled: bool = True

    @validator("expression", pre=True)
    def convert_expression(cls, value):  # cls as per pydantic docs
        """
        Make sure that we can parse the expression to a
        validation
        """
        try:
            raw_validation = parse(value, visitor)
        except ParseError as err:
            logger.error(f"Cannot parse expression properly: {value}")
            raise err

        return [Validation.create(val) for val in raw_validation]

    class Config:
        arbitrary_types_allowed = True


class TableTest(ExpressionModel):
    """
    Incoming table test definition from the workflow
    """

    name: str
    table: str  # fullyQualifiedName


class ColumnTestExpression(ExpressionModel):
    """
    Column test expression definition
    """

    name: str
    column: str


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
