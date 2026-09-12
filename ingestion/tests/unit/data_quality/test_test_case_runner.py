#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Unit tests for TestCaseRunner.filter_incompatible_test_cases
"""

import uuid
from unittest.mock import MagicMock

from metadata.data_quality.processor.test_case_runner import TestCaseRunner
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestDefinition,
    TestPlatform,
)
from metadata.generated.schema.type.entityReference import EntityReference

TABLE_FQN = "service.database.schema.users"


def _make_table() -> Table:
    return Table(
        id=uuid.uuid4(),
        name="users",
        columns=[Column(name="age", dataType=DataType.INT)],
    )


def _make_test_definition(supported_data_types) -> TestDefinition:
    return TestDefinition(
        id=uuid.uuid4(),
        name="myGenericTest",
        entityType=EntityType.COLUMN,
        testPlatforms=[TestPlatform.OpenMetadata],
        supportedDataTypes=supported_data_types,
    )


def _make_test_case(test_definition: TestDefinition) -> MagicMock:
    test_case = MagicMock()
    test_case.name.root = "myTestCase"
    test_case.entityLink.root = f"<#E::table::{TABLE_FQN}::columns::age>"
    test_case.testDefinition = EntityReference(id=test_definition.id.root, type="testDefinition")

    return test_case


def _filter(test_definition: TestDefinition):
    """Run the filter with a runner stubbed down to the two members it touches."""
    runner = TestCaseRunner.__new__(TestCaseRunner)
    runner.metadata = MagicMock()
    runner.metadata.get_by_id.return_value = test_definition
    runner.status = MagicMock()

    test_case = _make_test_case(test_definition)
    kept = runner.filter_incompatible_test_cases(_make_table(), [test_case])

    return kept, test_case, runner.status


def test_filter_keeps_test_case_with_matching_data_type():
    kept, test_case, status = _filter(_make_test_definition([DataType.INT]))

    assert kept == [test_case]
    status.failed.assert_not_called()


def test_filter_drops_test_case_with_incompatible_data_type():
    kept, _, status = _filter(_make_test_definition([DataType.STRING]))

    assert kept == []
    status.failed.assert_called_once()


def test_filter_keeps_test_case_when_no_data_types_are_declared():
    """A test definition that declares no data types is generic — see issue #27718."""
    for supported_data_types in (None, []):
        kept, test_case, status = _filter(_make_test_definition(supported_data_types))

        assert kept == [test_case]
        status.failed.assert_not_called()
