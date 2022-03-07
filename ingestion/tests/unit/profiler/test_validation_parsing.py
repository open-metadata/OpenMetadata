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
Test that we can properly parse JSON definition
of validations
"""
from metadata.generated.schema.tests.column.columnValuesLengthsToBeBetween import (
    ColumnValueLengthsToBeBetween,
)
from metadata.generated.schema.tests.column.columnValuesMissingCountToBeEqual import (
    ColumnValuesMissingCount,
)
from metadata.generated.schema.tests.column.columnValuesToBeBetween import (
    ColumnValuesToBeBetween,
)
from metadata.generated.schema.tests.column.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSet,
)
from metadata.generated.schema.tests.column.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNull,
)
from metadata.generated.schema.tests.column.columnValuesToBeUnique import (
    ColumnValuesToBeUnique,
)
from metadata.generated.schema.tests.column.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegex,
)
from metadata.generated.schema.tests.columnTest import ColumnTestCase
from metadata.generated.schema.tests.table.tableColumnCountToEqual import (
    TableColumnCountToEqual,
)
from metadata.generated.schema.tests.table.tableRowCountToBeBetween import (
    TableRowCountToBeBetween,
)
from metadata.generated.schema.tests.table.tableRowCountToEqual import (
    TableRowCountToEqual,
)
from metadata.generated.schema.tests.tableTest import TableTestCase


def test_column_values_to_be_unique():
    """
    ColumnValuesToBeUnique
    """
    obj = {"config": {}, "columnTestType": "columnValuesToBeUnique"}

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValuesToBeUnique)


def test_column_values_to_be_not_null():
    """
    ColumnValuesToBeNotNull
    """
    obj = {"config": {}, "columnTestType": "columnValuesToBeNotNull"}

    test_case = ColumnTestCase.parse_obj(obj)

    # TODO: we should parse this properly
    # assert isinstance(test_case.config, ColumnValuesToBeNotNull)


def test_column_values_to_be_between():
    """
    ColumnValuesToBeBetween
    """
    obj = {
        "config": {"minValue": 6, "maxValue": 10},
        "columnTestType": "columnValuesToBeBetween",
    }

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValuesToBeBetween)


def test_column_value_length_to_be_between():
    """
    ColumnValueLengthsToBeBetween
    """
    obj = {
        "config": {"minLength": 6, "maxLength": 10},
        "columnTestType": "columnValueLengthsToBeBetween",
    }

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValueLengthsToBeBetween)


def test_column_values_not_in_set():
    """
    ColumnValuesToBeNotInSet
    """
    obj = {
        "config": {"forbiddenValues": ["random"]},
        "columnTestType": "columnValuesToBeNotInSet",
    }

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValuesToBeNotInSet)


def test_column_values_to_match_regex():
    """
    ColumnValuesToMatchRegex
    """
    obj = {
        "config": {"regex": "%regex%"},
        "columnTestType": "columnValuesToMatchRegex",
    }

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValuesToMatchRegex)


def test_column_values_missing_count_to_be_equal():
    """
    ColumnValuesMissingCount
    """
    obj = {
        "config": {"missingCountValue": 10, "missingValueMatch": ["N/A"]},
        "columnTestType": "columnValuesMissingCountToBeEqual",
    }

    test_case = ColumnTestCase.parse_obj(obj)

    assert isinstance(test_case.config, ColumnValuesMissingCount)


def test_table_row_count_to_equal():
    """
    TableRowCountToEqual
    """
    obj = {
        "config": {"value": 10},
        "tableTestType": "tableRowCountToEqual",
    }

    test_case = TableTestCase.parse_obj(obj)

    assert isinstance(test_case.config, TableRowCountToEqual)


def test_table_row_count_to_be_between():
    """
    TableRowCountToBeBetween
    """
    obj = {
        "config": {"minValue": 10, "maxValue": 100},
        "tableTestType": "tableRowCountToBeBetween",
    }

    test_case = TableTestCase.parse_obj(obj)

    assert isinstance(test_case.config, TableRowCountToBeBetween)


def test_table_column_count_to_equal():
    """
    TableColumnCountToEqual
    """
    obj = {
        "config": {"columnCount": 10},
        "tableTestType": "tableColumnCountToEqual",
    }

    test_case = TableTestCase.parse_obj(obj)

    assert isinstance(test_case.config, TableColumnCountToEqual)
