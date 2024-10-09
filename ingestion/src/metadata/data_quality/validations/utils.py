from typing import Callable, TypeVar, Optional, Union

from metadata.generated.schema.tests.testCase import TestCaseParameterValue

T = TypeVar("T", bound=Callable)
R = TypeVar("R")


def get_test_case_param_value(
    test_case_param_vals: list[TestCaseParameterValue],
    name: str,
    type_: T,
    default: Optional[R] = None,
    pre_processor: Optional[Callable] = None,
) -> Optional[Union[R, T]]:
    """Give a column and a type return the value with the appropriate type casting for the
    test case definition.

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
