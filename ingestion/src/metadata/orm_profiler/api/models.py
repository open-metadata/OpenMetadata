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
Return types for Profiler workflow execution.

We need to define this class as we end up having
multiple profilers per table and columns.
"""
from typing import List

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.orm_profiler.profiles.core import Profiler


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
