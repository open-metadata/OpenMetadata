from ast import literal_eval

import pytest

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


@pytest.mark.parametrize(
    "param_values, name, type_, default, expected",
    [
        ([TestCaseParameterValue(name="str", value="test")], "str", str, None, "test"),
        (
            [TestCaseParameterValue(name="param", value="[1, 2, 3]")],
            "param",
            literal_eval,
            None,
            [1, 2, 3],
        ),
        ([TestCaseParameterValue(name="param", value="123")], "param", int, None, 123),
        (
            [TestCaseParameterValue(name="param", value=None)],
            "param",
            str,
            "default",
            "default",
        ),
    ],
)
def test_get_test_case_param_value(param_values, name, type_, default, expected):
    result = BaseTestValidator.get_test_case_param_value(
        param_values, name, type_, default
    )
    assert result == expected
