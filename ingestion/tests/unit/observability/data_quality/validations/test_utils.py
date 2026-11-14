from datetime import datetime

import pytest
import sqlalchemy as sqa

from metadata.data_quality.validations import utils
from metadata.data_quality.validations.checkers.between_bounds_checker import (
    is_unbounded,
)
from metadata.data_quality.validations.utils import get_bool_test_case_param
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.profiler.orm.registry import is_boolean


@pytest.mark.parametrize(
    "test_case_param_vals, name, expected",
    [
        ([TestCaseParameterValue(name="param1", value="true")], "param1", True),
        ([TestCaseParameterValue(name="param1", value="false")], "param1", False),
        ([TestCaseParameterValue(name="param1", value="True")], "param1", True),
        ([TestCaseParameterValue(name="param1", value="False")], "param1", False),
        ([TestCaseParameterValue(name="param1", value="TRUE")], "param1", True),
        ([TestCaseParameterValue(name="param1", value="FALSE")], "param1", False),
        ([TestCaseParameterValue(name="param1", value="invalid")], "param1", False),
        ([], "param1", False),
        ([TestCaseParameterValue(name="param2", value="true")], "param1", False),
    ],
)
def test_get_bool_test_case_param(test_case_param_vals, name, expected):
    assert get_bool_test_case_param(test_case_param_vals, name) == expected


@pytest.mark.parametrize(
    "bound, unbounded",
    [
        (None, True),
        (float("-inf"), True),
        (float("inf"), True),
        (3, False),
        (3.5, False),
        (datetime(2021, 7, 1), False),
    ],
)
def test_is_unbounded(bound, unbounded):
    assert is_unbounded(bound) is unbounded


@pytest.mark.parametrize("column_type", [sqa.Boolean(), DataType.BOOLEAN])
def test_true_and_false_strings_become_booleans_on_a_boolean_column(column_type):
    assert utils.parse_set_values(raw='["true", "False"]', column_type=column_type) == [True, False]


@pytest.mark.parametrize("column_type", [sqa.Boolean(), DataType.BOOLEAN])
def test_python_literals_on_a_boolean_column_are_kept(column_type):
    assert utils.parse_set_values(raw="[True, False]", column_type=column_type) == [True, False]


@pytest.mark.parametrize("column_type", [sqa.String(), DataType.VARCHAR, None])
def test_strings_on_a_string_or_unknown_column_stay_strings(column_type):
    assert utils.parse_set_values(raw='["true", "false"]', column_type=column_type) == ["true", "false"]


@pytest.mark.parametrize(
    "raw, column_type, expected",
    [
        ("[false]", sqa.Boolean(), [False]),
        ("[true, false]", DataType.BOOLEAN, [True, False]),
        ("[null]", sqa.String(), [None]),
        ('["a", 1.5]', None, ["a", 1.5]),
    ],
)
def test_a_json_written_set_is_read_like_a_python_one(raw, column_type, expected):
    """The UI and generated tests write JSON, where booleans and null are lowercase"""
    assert utils.parse_set_values(raw=raw, column_type=column_type) == expected


def test_a_set_that_is_neither_python_nor_json_is_rejected():
    with pytest.raises(ValueError):
        utils.parse_set_values(raw="[OPEN, CLOSED]", column_type=sqa.String())


def test_a_set_that_is_not_a_collection_is_rejected():
    with pytest.raises(ValueError, match="must be a list"):
        utils.parse_set_values(raw='"true"', column_type=sqa.Boolean())


def test_is_boolean_reads_both_type_systems():
    assert is_boolean(sqa.Boolean()) and is_boolean(DataType.BOOLEAN)
    assert not is_boolean(sqa.Integer()) and not is_boolean(DataType.INT)
