"""
Data quality validation utility functions.
"""

import json
import math
from ast import literal_eval
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, TypeVar
from urllib.parse import quote

from jinja2 import StrictUndefined, TemplateSyntaxError, UndefinedError, meta
from jinja2.exceptions import SecurityError
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import Boolean, Date, DateTime, Double, Float, Integer, Numeric, String, bindparam, text
from sqlalchemy.engine import URL
from sqlalchemy.sql.elements import TextClause
from sqlalchemy.sql.type_api import TypeEngine

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import TestDataType
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


def _normalize_test_data_type(data_type: Any) -> TestDataType | None:
    if isinstance(data_type, TestDataType):
        return data_type
    if isinstance(data_type, str):
        try:
            return TestDataType(data_type.upper())
        except ValueError:
            return None
    return None


def get_test_definition_param_types(test_definition: Any) -> dict[str, TestDataType]:
    """Build a mapping of parameter name to TestDataType from a TestDefinition."""
    if test_definition is None:
        return {}
    param_defs = getattr(test_definition, "parameterDefinition", None)
    if not isinstance(param_defs, (list, tuple)):
        return {}
    param_types: dict[str, TestDataType] = {}
    for param_def in param_defs:
        name = getattr(param_def, "name", None)
        resolved = _normalize_test_data_type(getattr(param_def, "dataType", None))
        if isinstance(name, str) and name and resolved is not None:
            param_types[name] = resolved
    return param_types


def _coerce_int(value: str, data_type: TestDataType, label: str) -> int:
    try:
        return int(value.strip())
    except ValueError as exc:
        raise ValueError(f"Invalid {data_type.value} value {value!r}{label}") from exc


def _coerce_float(value: str, data_type: TestDataType, label: str) -> float:
    try:
        parsed = float(value.strip())
    except ValueError as exc:
        raise ValueError(f"Invalid {data_type.value} value {value!r}{label}") from exc
    if not math.isfinite(parsed):
        raise ValueError(f"Non-finite {data_type.value} value {value!r}{label}")
    return parsed


def _coerce_decimal(value: str, data_type: TestDataType, label: str) -> Decimal:
    try:
        parsed = Decimal(value.strip())
    except InvalidOperation as exc:
        raise ValueError(f"Invalid {data_type.value} value {value!r}{label}") from exc
    if not parsed.is_finite():
        raise ValueError(f"Non-finite {data_type.value} value {value!r}{label}")
    return parsed


def _coerce_number(value: str, data_type: TestDataType, label: str) -> int | float:
    stripped = value.strip()
    try:
        return int(stripped)
    except ValueError:
        return _coerce_float(value, data_type, label)


def _coerce_boolean(value: str, data_type: TestDataType, label: str) -> bool:
    lowered = value.strip().lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    raise ValueError(f"Invalid {data_type.value} value {value!r}{label}: expected 'true' or 'false'")


def _coerce_date(value: str, data_type: TestDataType, label: str) -> date | str:
    stripped = value.strip()
    if "-" in stripped:
        try:
            return date.fromisoformat(stripped)
        except ValueError:
            pass
    logger.warning("Could not parse %s value %r%s as ISO-8601; keeping as string", data_type.value, value, label)
    return value


def _coerce_datetime(value: str, data_type: TestDataType, label: str) -> datetime | str:
    stripped = value.strip()
    # Python 3.10's datetime.fromisoformat does not accept a trailing 'Z' suffix.
    iso_candidate = f"{stripped[:-1]}+00:00" if stripped.endswith(("Z", "z")) else stripped
    if "-" in iso_candidate and any(sep in iso_candidate for sep in ("T", "t", " ")):
        try:
            return datetime.fromisoformat(iso_candidate)
        except ValueError:
            pass
    logger.warning("Could not parse %s value %r%s as ISO-8601; keeping as string", data_type.value, value, label)
    return value


_PARAM_COERCERS: dict[TestDataType, Callable[[str, TestDataType, str], Any]] = {
    TestDataType.INT: _coerce_int,
    TestDataType.FLOAT: _coerce_float,
    TestDataType.DOUBLE: _coerce_float,
    TestDataType.DECIMAL: _coerce_decimal,
    TestDataType.NUMBER: _coerce_number,
    TestDataType.BOOLEAN: _coerce_boolean,
    TestDataType.DATE: _coerce_date,
    TestDataType.DATETIME: _coerce_datetime,
    TestDataType.TIMESTAMP: _coerce_datetime,
}


def coerce_test_case_param_value(
    value: str,
    data_type: TestDataType | str | None,
    param_name: str | None = None,
) -> Any:
    """Coerce a raw string TestCaseParameterValue into the Python type matching its TestDataType.

    OpenMetadata stores every parameter value as a string. SQLAlchemy DBAPI drivers (such as
    PyAthena, BigQuery, Trino, and Databricks) infer the SQL bind type from the Python value's
    runtime type, so leaving numeric/boolean/temporal parameters as strings causes drivers to
    bind or quote them as VARCHAR/STRING. Unparseable or legacy values fall back to the raw
    string with a warning so existing test cases continue to run without aborting.
    """
    resolved_type = _normalize_test_data_type(data_type)
    coercer = _PARAM_COERCERS.get(resolved_type) if resolved_type is not None else None
    if coercer is None or resolved_type is None:
        return value
    label = f" for parameter '{param_name}'" if param_name else ""
    try:
        return coercer(value, resolved_type, label)
    except ValueError as exc:
        logger.warning("%s; keeping as string", exc)
        return value


def extract_rule_library_raw_user_params(
    parameter_values: list[TestCaseParameterValue] | None,
    reserved_params: set[str],
) -> dict[str, str]:
    """Extract raw string user-defined parameters for a Rule Library test case."""
    params: dict[str, str] = {}
    if not parameter_values:
        return params
    for param in parameter_values:
        if param.name and param.value and param.name not in reserved_params:  # noqa: SIM102
            if not param.name.endswith("RuntimeParameters"):
                params[param.name] = param.value
    return params


def extract_rule_library_user_params(
    parameter_values: list[TestCaseParameterValue] | None,
    reserved_params: set[str],
    param_types: dict[str, TestDataType] | None = None,
    only_params: set[str] | None = None,
) -> dict[str, Any]:
    """Extract and type-coerce user-defined parameters for a Rule Library test case."""
    raw_params = extract_rule_library_raw_user_params(parameter_values, reserved_params)
    resolved_types = param_types or {}
    return {
        name: coerce_test_case_param_value(raw_value, resolved_types.get(name), param_name=name)
        for name, raw_value in raw_params.items()
        if only_params is None or name in only_params
    }


def get_template_variables(sql_template: str) -> set[str] | None:
    """Return undeclared Jinja2 variable names referenced in ``sql_template``, or None on syntax error."""
    env = SandboxedEnvironment()
    try:
        return meta.find_undeclared_variables(env.parse(sql_template))
    except TemplateSyntaxError:
        return None


def _is_plain_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _sqla_number_type(value: Any) -> TypeEngine[Any] | None:
    if _is_plain_int(value):
        return Integer()
    return Float() if isinstance(value, float) else None


_SQLA_TYPE_BUILDERS: dict[TestDataType, Callable[[Any], TypeEngine[Any] | None]] = {
    TestDataType.INT: lambda v: Integer() if _is_plain_int(v) else None,
    TestDataType.FLOAT: lambda v: Float() if isinstance(v, float) else None,
    TestDataType.DOUBLE: lambda v: Double() if isinstance(v, float) else None,
    TestDataType.DECIMAL: lambda v: Numeric() if isinstance(v, Decimal) else None,
    TestDataType.NUMBER: _sqla_number_type,
    TestDataType.BOOLEAN: lambda v: Boolean() if isinstance(v, bool) else None,
    TestDataType.DATE: lambda v: Date() if isinstance(v, date) and not isinstance(v, datetime) else None,
    TestDataType.DATETIME: lambda v: DateTime(timezone=v.tzinfo is not None) if isinstance(v, datetime) else None,
    TestDataType.TIMESTAMP: lambda v: DateTime(timezone=v.tzinfo is not None) if isinstance(v, datetime) else None,
    TestDataType.STRING: lambda v: String() if isinstance(v, str) else None,
}


def _sqlalchemy_type_for_param(value: Any, data_type: TestDataType | None) -> TypeEngine[Any] | None:
    builder = _SQLA_TYPE_BUILDERS.get(data_type) if data_type is not None else None
    if builder is not None:
        return builder(value)
    return Numeric() if isinstance(value, Decimal) else None


def build_typed_text_clause(
    compiled_sql: str,
    bind_params: dict[str, Any],
    param_types: dict[str, TestDataType] | None = None,
) -> TextClause:
    """Attach explicit SQLAlchemy bind types to bound parameters present in a text() clause."""
    stmt = text(compiled_sql)
    present_binds = stmt._bindparams
    resolved_types = param_types or {}
    typed_binds = []
    for name, value in bind_params.items():
        if name not in present_binds:
            continue
        sa_type = _sqlalchemy_type_for_param(value, resolved_types.get(name))
        if sa_type is not None:
            typed_binds.append(bindparam(name, type_=sa_type))
    if typed_binds:
        stmt = stmt.bindparams(*typed_binds)
    return stmt


def render_sql_expression(sql_template: str, params: dict[str, Any]) -> str:
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
