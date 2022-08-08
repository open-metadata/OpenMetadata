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
from typing import List, Optional, Tuple

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.table import Table, TableData, TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.orm_profiler.profiler.models import ProfilerDef
from metadata.orm_profiler.validations.models import TestSuite


class ProfilerProcessorConfig(ConfigModel):
    """
    Defines how we read the processor information
    from the workflow JSON definition
    """

    profiler: Optional[ProfilerDef] = None
    testSuites: Optional[List[TestSuite]] = None


class ProfilerResponse(ConfigModel):
    """
    ORM Profiler processor response.

    For a given table, return all profilers and
    the ran tests, if any.
    """

    table: Table
    profile: TableProfile
    test_results: Optional[Tuple] = None
    sample_data: Optional[TableData] = None
