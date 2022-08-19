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
from metadata.generated.schema.entity.data.table import ColumnProfilerConfig
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Markdown


class TablePartitionConfig(ConfigModel):
    """table partition config"""

    partitionField: Optional[str] = None
    partitionQueryDuration: Optional[int] = 1
    partitionValues: Optional[List] = None


class ColumnConfig(ConfigModel):
    """Column config for profiler"""

    excludeColumns: Optional[List[str]]
    includeColumns: Optional[List[ColumnProfilerConfig]]


class TableConfig(ConfigModel):
    """table profile config"""

    fullyQualifiedName: FullyQualifiedEntityName
    profileSample: Optional[float] = None
    profileQuery: Optional[str] = None
    partitionConfig: Optional[TablePartitionConfig]
    columnConfig: Optional[ColumnConfig]


class TestCase(ConfigModel):
    """
    cli testcases
    """

    name: str
    description: Optional[Markdown] = "Test suite description"
    testDefinitionName: str
    fullyQualifiedName: FullyQualifiedEntityName
    parameterValues: List[TestCaseParameterValue]
    tableProfileConfig: Optional[TableConfig] = None


class TestSuite(ConfigModel):
    """
    Config test definition
    """

    name: str  # Test Suite name
    description: Optional[str] = "Test suite description"
    scheduleInterval: Optional[str]
    testCases: List[TestCase]
