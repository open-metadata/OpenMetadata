"""
Data quality validation utility functions.
"""

from typing import Any, Callable, List, Optional, TypeVar, Union  # noqa: UP035
from urllib.parse import quote

from sqlalchemy.engine import URL

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

T = TypeVar("T", bound=Callable)
R = TypeVar("R")

# Characters that terminate the userinfo (or the whole authority) while data-diff parses the URI.
# They must stay percent-encoded even though data-diff will not decode them back.
USERNAME_RESERVED_CHARACTERS = ":/?#"


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


def _encode_username_for_data_diff(username: str) -> str:
    """Percent-encode only what data-diff's URI parser needs to locate the userinfo boundaries."""
    return "".join(f"%{ord(char):02X}" if char in USERNAME_RESERVED_CHARACTERS else char for char in username)


def render_url_for_data_diff(url: URL) -> str:
    """Render `url` so that data-diff reads back the values it was built from.

    `URL.render_as_string` percent-encodes the username, but data-diff only decodes the password
    (`CustomParseResult`), the host and the query string when it parses a URI. An encoded username
    therefore reaches the driver still encoded, and `user@corp.com` tries to authenticate as
    `user%40corp.com`. We hand data-diff the decoded username and keep the password encoded, so that
    every component survives exactly one encode/decode round trip.
    """
    if url.username is None:
        return url.render_as_string(hide_password=False)

    userinfo = _encode_username_for_data_diff(url.username)
    if userinfo != url.username:
        logger.warning(
            "[Data Diff]: The username contains characters reserved by the connection URI (%s). "
            "data-diff does not decode them, so authentication may fail.",
            ", ".join(sorted(set(url.username) & set(USERNAME_RESERVED_CHARACTERS))),
        )
    if url.password is not None:
        userinfo += f":{quote(str(url.password), safe=' +')}"

    authority = URL.create(
        drivername=url.drivername,
        host=url.host,
        port=url.port,
        database=url.database,
        query=url.query,
    ).render_as_string(hide_password=False)
    scheme, _, rest = authority.partition("://")
    return f"{scheme}://{userinfo}@{rest}"


def casefold_if_string(value: Any) -> Any:
    """Case fold the value if it is a string.

    Args:
        value (Any): value to case fold
    Returns:
        Any: case folded value
    """
    return value.casefold() if isinstance(value, str) else value
