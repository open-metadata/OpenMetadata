"""
Data quality validation utility functions.
"""

from typing import Any, Callable, List, Optional, TypeVar, Union

from metadata.generated.schema.tests.testCase import TestCaseParameterValue

T = TypeVar("T", bound=Callable)
R = TypeVar("R")


def get_test_case_param_value(
    test_case_param_vals: List[TestCaseParameterValue],
    name: str,
    type_: T,
    default: Optional[R] = None,
    pre_processor: Optional[Callable] = None,
) -> Optional[Union[R, T]]:
    """Return a test case parameter value with the appropriate type casting for the test case definition.

    Args:
        test_case_param_vals: list of test case parameter values
        type_ (Union[float, int, str]): type for the value
        name (str): column name
        default (_type_, optional): Default value to return if column is not found
        pre_processor: pre processor function/type to use against the value before casting to type_
    """
    value = next(
        (param.value for param in test_case_param_vals if param.name == name), None
    )

    if not value:
        return default if default is not None else None

    if not pre_processor:
        return type_(value)

    pre_processed_value = pre_processor(value)
    return type_(pre_processed_value)


def get_bool_test_case_param(
    test_case_param_vals: List[TestCaseParameterValue],
    name: str,
) -> Optional[Union[R, T]]:
    """Return a test case parameter value as a boolean. Boolean values are always False by default.

    Args:
        test_case_param_vals: list of test case parameter values
        name (str): column name
    """
    str_val: str = get_test_case_param_value(test_case_param_vals, name, str, None)
    if str_val is None:
        return False
    return str_val.lower() == "true"


def casefold_if_string(value: Any) -> Any:
    """Case fold the value if it is a string.

    Args:
        value (Any): value to case fold
    Returns:
        Any: case folded value
    """
    return value.casefold() if isinstance(value, str) else value
