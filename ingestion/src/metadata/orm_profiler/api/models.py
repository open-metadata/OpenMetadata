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
Return types for Profiler workflow execution
"""
from typing import List

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.orm_profiler.profiles.core import Profiler
from metadata.orm_profiler.validations.core import Validation


class WorkflowResult(BaseModel):
    class Config:
        arbitrary_types_allowed = True


class ColumnProfiler(WorkflowResult):
    column: str
    profiler: Profiler


class ProfilerResult(WorkflowResult):
    table: Table  # Table Entity
    table_profiler: Profiler  # Profiler with table results
    column_profilers: List[ColumnProfiler]  # Profiler with col results


class ColumnTest(WorkflowResult):
    column: str
    name: str  # Test Name
    validations: List[Validation]


class ColumnResult(WorkflowResult):
    name: str
    tests: List[ColumnTest]


class TableResult(WorkflowResult):
    name: str  # Test name
    validations: List[Validation]


class TestResult(WorkflowResult):
    name: str  # Test suite name
    table: Table  # Table Entity
    table_results: List[TableResult] = None
    column_results: List[ColumnResult] = None
