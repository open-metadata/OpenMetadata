from collections import deque

from pydantic import BaseModel


def assert_equal_pydantic_objects(
    expected: BaseModel, actual: BaseModel, ignore_none=True
):
    """Compare 2 pydantic objects recursively and raise an AssertionError if they are not equal along with all
    the differences by field. If `ignore_none` is set to True, expected None values will be ignored. This can be
    useful when comparing objects that are partially filled.

    Example:
        >>> from pydantic import BaseModel
        >>> class A(BaseModel):
        ...     a: int
        >>> class B(BaseModel):
        ...     b: A
        >>> a1 = A(a=1)
        >>> a2 = A(a=2)
        >>> b1 = B(b=a1)
        >>> b2 = B(b=a2)
        >>> assert_equal_pydantic_objects(a1, b1)
        Traceback (most recent call last):
        ```
        AssertionError: objects mismatched on type at : expected: [A], actual: [B]
        >>> assert_equal_pydantic_objects(a1, a2)
        Traceback (most recent call last):
        ```
        AssertionError: objects mismatched on field: [a], expected: [1], actual: [2]
        >>> assert_equal_pydantic_objects(b1, b2)
        Traceback (most recent call last):
        ```
        AssertionError: objects mismatched on field: [b.a], expected: [1], actual: [2]

    Args:
        expected (BaseModel): The expected pydantic object.
        actual (BaseModel): The actual pydantic object.
        ignore_none (bool, optional): Whether to ignore None values. Defaults to True.

    Raises:
        AssertionError: If the objects are not equal. The error message will contain all the differences.
    """
    errors = []
    queue = deque([(expected, actual, "")])
    while queue:
        expected, actual, current_key_prefix = queue.popleft()
        if not isinstance(expected, actual.__class__):
            errors.append(
                f"objects mismatched on type at {current_key_prefix}: "
                f"expected: [{type(expected).__name__}], actual: [{type(actual).__name__}]"
            )
            continue
        if issubclass(expected.__class__, BaseModel) and isinstance(
            expected.model_dump(), dict
        ):
            for key, expected_value in expected.model_dump().items():
                if expected_value is None and ignore_none:
                    continue
                actual_value = actual.model_dump().get(key)
                new_key_prefix = (
                    f"{current_key_prefix}.{key}" if current_key_prefix else key
                )
                if issubclass(getattr(expected, key).__class__, BaseModel):
                    queue.append(
                        (getattr(expected, key), getattr(actual, key), new_key_prefix)
                    )
                elif expected_value != actual_value:
                    errors.append(
                        f"objects mismatched on field: [{new_key_prefix}], expected: [{expected_value}], actual: [{actual_value}]"
                    )
        else:
            if expected != actual:
                errors.append(
                    f"mismatch at {current_key_prefix}: expected: [{expected}], actual: [{actual}]"
                )

    if errors:
        raise AssertionError("\n".join(errors))
