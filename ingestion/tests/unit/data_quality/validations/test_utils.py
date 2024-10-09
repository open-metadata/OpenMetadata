import pytest

from metadata.data_quality.validations.utils import get_bool_test_case_param
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


@pytest.mark.parametrize(
    "test_case_param_vals, name, default, expected",
    [
        ([TestCaseParameterValue(name="param1", value="true")], "param1", None, True),
        ([TestCaseParameterValue(name="param1", value="false")], "param1", None, False),
        ([TestCaseParameterValue(name="param1", value="True")], "param1", None, True),
        ([TestCaseParameterValue(name="param1", value="False")], "param1", None, False),
        ([TestCaseParameterValue(name="param1", value="TRUE")], "param1", None, True),
        ([TestCaseParameterValue(name="param1", value="FALSE")], "param1", None, False),
        (
            [TestCaseParameterValue(name="param1", value="invalid")],
            "param1",
            None,
            False,
        ),
        ([], "param1", True, True),
        ([], "param1", False, False),
        ([TestCaseParameterValue(name="param2", value="true")], "param1", None, None),
        ([TestCaseParameterValue(name="param2", value="true")], "param1", True, True),
    ],
)
def test_get_bool_test_case_param(test_case_param_vals, name, default, expected):
    assert get_bool_test_case_param(test_case_param_vals, name, default) == expected
