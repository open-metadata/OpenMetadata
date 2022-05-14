#  Copyright 2022 Collate
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
Test suite for column builder
"""

from pytest import mark

from metadata.generated.schema.api.tests.createColumnTest import CreateColumnTestRequest
from metadata.generated.schema.tests.basic import TestCaseResult as _TestCaseResult
from metadata.generated.schema.tests.column import columnValuesToBeNotNull
from metadata.generated.schema.tests.columnTest import ColumnTestCase, ColumnTestType
from metadata.great_expectations.column_test_builders import (
    ColumnValuesLengthsToBeBetweenBuilder,
    ColumnValuesToBeBetweenBuilder,
    ColumnValuesToBeNotInSetBuilder,
    ColumnValuesToBeNotNullBuilder,
    ColumnValuesToBeUniqueBuilder,
    ColumnValuesToMatchRegexBuilder,
)


def test_base_column_builder_attributes_none(mocked_base_column_builder):
    """Test correct attributes are set for the base builder class"""
    assert mocked_base_column_builder.result is None
    assert mocked_base_column_builder.ometa_conn is None
    assert mocked_base_column_builder.table_entity is None
    assert mocked_base_column_builder.timestamp is None


@mark.parametrize(
    "values",
    [
        {"result": {"foo": "bar"}, "ometa_conn": "OMetaConn", "table_entity": "Table"},
        {
            "result": {"bar": "baz"},
            "ometa_conn": "DummyConn",
            "table_entity": "DummyTable",
        },
    ],
)
def test_base_column_builder_attributes_not_none(mocked_base_column_builder, values):
    """Test attributes are set correctly using __call__ method"""
    mocked_base_column_builder(
        result=values["result"],
        ometa_conn=values["ometa_conn"],
        table_entity=values["table_entity"],
    )

    assert mocked_base_column_builder.result == values["result"]
    assert mocked_base_column_builder.ometa_conn == values["ometa_conn"]
    assert mocked_base_column_builder.table_entity == values["table_entity"]
    assert mocked_base_column_builder.timestamp is not None


def test_base_column_builder_attributes_list(mocked_base_column_builder):
    """Test base column builder has the expected attributes"""
    expected_attributes = {"result", "ometa_conn", "table_entity", "timestamp"}
    assert expected_attributes.issubset(mocked_base_column_builder.__dict__.keys())


def test_base_column_builder_build_test_case(mocked_base_column_builder):
    """Test test case builder"""
    test_case = mocked_base_column_builder.build_test_case(
        config=columnValuesToBeNotNull.ColumnValuesToBeNotNull(),
        test_type=ColumnTestType.columnValuesToBeNotNull,
    )

    assert isinstance(test_case, ColumnTestCase)
    test_case.config
    test_case.columnTestType


def test_base_column_builder_build_test_case_results(
    mocked_base_column_builder, mocked_ge_column_result
):
    """Test test case results are built as expected"""
    mocked_base_column_builder(
        result=mocked_ge_column_result,
        ometa_conn="OMetaConnection",
        table_entity="TableEntity",
    )
    test_case_result = mocked_base_column_builder.build_test_case_results()

    assert isinstance(test_case_result, _TestCaseResult)
    test_case_result.executionTime
    test_case_result.testCaseStatus
    test_case_result.result


def test_base_column_builder_build_test_request(
    mocked_base_column_builder, mocked_ge_column_result
):
    """Test CreateTestRequest is built as expected"""
    mocked_base_column_builder(
        result=mocked_ge_column_result,
        ometa_conn="OMetaConnection",
        table_entity="TableEntity",
    )

    column_test_request = mocked_base_column_builder.build_test_request(
        config=columnValuesToBeNotNull.ColumnValuesToBeNotNull(),
        test_type=ColumnTestType.columnValuesToBeNotNull,
    )

    assert isinstance(column_test_request, CreateColumnTestRequest)
    column_test_request.columnName
    column_test_request.testCase
    column_test_request.result
    column_test_request.updatedAt


@mark.parametrize(
    "builder",
    [
        ColumnValuesToBeUniqueBuilder(),
        ColumnValuesToBeBetweenBuilder(),
        ColumnValuesToBeNotNullBuilder(),
        ColumnValuesToBeNotInSetBuilder(),
        ColumnValuesToMatchRegexBuilder(),
        ColumnValuesLengthsToBeBetweenBuilder(),
    ],
)
def test_column_custom_builders(mocked_ge_column_result, builder):
    """Test custom builders"""
    builder(
        result=mocked_ge_column_result,
        ometa_conn="OMetaConnection",
        table_entity="TableEntity",
    )

    builder_test_request = builder._build_test()

    assert isinstance(builder_test_request, CreateColumnTestRequest)
