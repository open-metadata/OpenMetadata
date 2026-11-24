"""
Data quality validation utility functions.
"""

import json
from ast import literal_eval
from collections.abc import Callable
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation
from typing import Any, TypeVar
from urllib.parse import quote

from jinja2 import StrictUndefined, TemplateSyntaxError, UndefinedError
from jinja2.exceptions import SecurityError
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, Numeric, String, Time
from sqlalchemy.engine import URL
from sqlalchemy.sql.type_api import TypeEngine

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.profiler.orm.registry import is_boolean
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

T = TypeVar("T", bound=Callable)
R = TypeVar("R")

# Characters that terminate the userinfo (or the whole authority) while data-diff parses the URI.
# They must stay percent-encoded even though data-diff will not decode them back.
USERNAME_RESERVED_CHARACTERS = ":/?#"


def parse_set_values(raw: str, column_type) -> list:
    """Parse an allowed or forbidden set; on a boolean column "true"/"false" strings become booleans

    Only "true"/"false" (any case) are mapped: "1"/"0", "t"/"f" and "yes"/"no" stay as written.
    """
    values = _parse_literal(raw)
    if not isinstance(values, (list, tuple, set)):
        raise ValueError(f"A set of values must be a list, got {raw}")  # noqa: TRY004 the set validators abort on ValueError
    return [_as_boolean(value) for value in values] if is_boolean(column_type) else list(values)


def _parse_literal(raw: str) -> Any:
    """A Python literal, or JSON when literal_eval rejects it: JSON writes booleans and null in lowercase

    literal_eval runs first, so a value it read before reads the same. Its ValueError and
    SyntaxError fall through to JSON; any other error it raises propagates.
    """
    try:
        value = literal_eval(raw)
    except (ValueError, SyntaxError):
        value = json.loads(raw)
    return value


def _as_boolean(value):
    return {"true": True, "false": False}.get(value.lower(), value) if isinstance(value, str) else value


def get_test_case_param_value(
    test_case_param_vals: list[TestCaseParameterValue],
    name: str,
    type_: T,
    default: R | None = None,
    pre_processor: Callable | None = None,
) -> R | T | None:
    """Return a test case parameter value with the appropriate type casting for the test case definition.

    Args:
        test_case_param_vals: list of test case parameter values
        type_ (Union[float, int, str]): type for the value
        name (str): column name
        default (_type_, optional): Default value to return if column is not found
        pre_processor: pre processor function/type to use against the value before casting to type_
    """
    value = next((param.value for param in test_case_param_vals if param.name == name), None)

    if not value:
        return default if default is not None else None

    if not pre_processor:
        return type_(value)

    pre_processed_value = pre_processor(value)
    return type_(pre_processed_value)


def get_bool_test_case_param(
    test_case_param_vals: list[TestCaseParameterValue],
    name: str,
) -> R | T | None:
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


def render_sql_expression(sql_template: str, params: dict[str, str]) -> str:
    """Render a Rule Library SQL expression, raising ``ValueError`` on any template error.

    The expression is user-authored, so it is rendered sandboxed: a plain Template
    lets it reach Python internals and run code on the ingestion worker.
    """
    try:
        return SandboxedEnvironment(undefined=StrictUndefined).from_string(sql_template).render(**params)
    except TemplateSyntaxError as e:
        raise ValueError(f"Invalid Jinja2 syntax in SQL expression: {e.message}") from e
    except SecurityError as e:
        raise ValueError(f"Unsafe operation in SQL expression: {e}") from e
    except UndefinedError as e:
        raise ValueError(
            f"Undefined variable in SQL expression: {e.message}. Available parameters: {list(params.keys())}"
        ) from e


def _normalize_test_data_type(data_type: Any) -> str | None:
    """Normalize a TestDataType enum or string to its uppercase name."""
    if data_type is None:
        return None
    raw = getattr(data_type, "value", data_type)
    return raw.upper() if isinstance(raw, str) else None


def get_rule_library_param_types(test_definition: Any) -> dict[str, Any]:
    """Return a mapping of parameter name -> declared TestDataType from a TestDefinition."""
    param_defs = getattr(test_definition, "parameterDefinition", None)
    if not isinstance(param_defs, (list, tuple)):
        return {}
    return {
        defn.name: defn.dataType
        for defn in param_defs
        if getattr(defn, "name", None) and getattr(defn, "dataType", None) is not None
    }


def coerce_rule_library_param_value(raw_value: str, data_type: Any) -> Any:
    """Coerce a Rule Library parameter string to the Python type matching its TestDataType."""
    if not isinstance(raw_value, str):
        return raw_value

    type_name = _normalize_test_data_type(data_type)
    if not type_name or type_name in {"STRING", "ARRAY", "MAP", "SET"}:
        return raw_value

    stripped = raw_value.strip()
    try:
        if type_name == "INT":
            return int(stripped)
        if type_name in {"FLOAT", "DOUBLE"}:
            return float(stripped)
        if type_name == "NUMBER":
            try:
                return int(stripped)
            except ValueError:
                return float(stripped)
        if type_name == "DECIMAL":
            return Decimal(stripped)
        if type_name == "BOOLEAN":
            lowered = stripped.lower()
            if lowered == "true":
                return True
            if lowered == "false":
                return False
            raise ValueError(f"Invalid boolean literal: {raw_value!r}")
        if type_name == "DATE":
            return date.fromisoformat(stripped)
        if type_name == "TIME":
            return time.fromisoformat(stripped)
        if type_name in {"DATETIME", "TIMESTAMP"}:
            iso = f"{stripped[:-1]}+00:00" if stripped.endswith(("Z", "z")) else stripped
            return datetime.fromisoformat(iso)
    except (ValueError, TypeError, InvalidOperation):
        logger.warning(
            "Failed to coerce rule library parameter value %r as %s; keeping raw string.",
            raw_value,
            type_name,
        )
        return raw_value

    return raw_value


def get_sqlalchemy_bind_type(data_type: Any) -> TypeEngine | None:
    """Return the SQLAlchemy TypeEngine corresponding to a TestDataType, if applicable."""
    type_name = _normalize_test_data_type(data_type)
    if not type_name:
        return None
    mapping: dict[str, Callable[[], TypeEngine]] = {
        "INT": Integer,
        "FLOAT": Float,
        "DOUBLE": Float,
        "NUMBER": Float,
        "DECIMAL": Numeric,
        "BOOLEAN": Boolean,
        "DATE": Date,
        "TIME": Time,
        "DATETIME": DateTime,
        "TIMESTAMP": DateTime,
        "STRING": String,
    }
    factory = mapping.get(type_name)
    return factory() if factory else None
