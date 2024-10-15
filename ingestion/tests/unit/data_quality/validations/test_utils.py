import pytest

from metadata.data_quality.validations.utils import get_bool_test_case_param
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


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
