from pyparsing import (
    CaselessLiteral,
    Combine,
    Literal,
    ParseException,
    Regex,
    Suppress,
    Word,
    alphanums,
    alphas,
    oneOf,
)

from great_expectations.exceptions import GreatExpectationsError

try:
    import pyspark.sql.functions as F
except ImportError:
    F = None

try:
    import sqlalchemy as sa
except ImportError:
    sa = None


def _set_notnull(s, l, t):
    t["notnull"] = True


column_name = Combine(
    Suppress(Literal('col("'))
    + Word(alphas, alphanums + "_.").setResultsName("column")
    + Suppress(Literal('")'))
)
gt = Literal(">")
lt = Literal("<")
ge = Literal(">=")
le = Literal("<=")
eq = Literal("==")
ops = (gt ^ lt ^ ge ^ le ^ eq).setResultsName("op")
fnumber = Regex(r"[+-]?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?").setResultsName("fnumber")
condition_value = Suppress('"') + Word(alphanums + ".").setResultsName(
    "condition_value"
) + Suppress('"') ^ Suppress("'") + Word(alphanums + ".").setResultsName(
    "condition_value"
) + Suppress(
    "'"
)
not_null = CaselessLiteral(".notnull()").setResultsName("notnull")
condition = (column_name + not_null).setParseAction(_set_notnull) ^ (
    column_name + ops + (fnumber ^ condition_value)
)


class ConditionParserError(GreatExpectationsError):
    pass


def _parse_great_expectations_condition(row_condition: str):
    try:
        return condition.parseString(row_condition)
    except ParseException:
        raise ConditionParserError(f"unable to parse condition: {row_condition}")


def parse_condition_to_spark(row_condition: str) -> "pyspark.sql.Column":
    parsed = _parse_great_expectations_condition(row_condition)
    column = parsed["column"]
    if "condition_value" in parsed:
        if parsed["op"] == "==":
            return F.col(column) == parsed["condition_value"]
        else:
            raise ConditionParserError(
                f"Invalid operator: {parsed['op']} for string literal spark condition."
            )
    elif "fnumber" in parsed:
        try:
            num = int(parsed["fnumber"])
        except ValueError:
            num = float(parsed["fnumber"])
        op = parsed["op"]
        if op == ">":
            return F.col(column) > num
        elif op == "<":
            return F.col(column) < num
        elif op == ">=":
            return F.col(column) >= num
        elif op == "<=":
            return F.col(column) <= num
        elif op == "==":
            return F.col(column) == num
    elif "notnull" in parsed and parsed["notnull"] is True:
        return F.col(column).isNotNull()
    else:
        raise ConditionParserError(f"unrecognized column condition: {row_condition}")


def parse_condition_to_sqlalchemy(
    row_condition: str,
) -> "sqlalchemy.sql.expression.ColumnElement":
    parsed = _parse_great_expectations_condition(row_condition)
    column = parsed["column"]
    if "condition_value" in parsed:
        if parsed["op"] == "==":
            return sa.column(column) == parsed["condition_value"]
        else:
            raise ConditionParserError(
                f"Invalid operator: {parsed['op']} for string literal spark condition."
            )
    elif "fnumber" in parsed:
        try:
            num = int(parsed["fnumber"])
        except ValueError:
            num = float(parsed["fnumber"])
        op = parsed["op"]
        if op == ">":
            return sa.column(column) > num
        elif op == "<":
            return sa.column(column) < num
        elif op == ">=":
            return sa.column(column) >= num
        elif op == "<=":
            return sa.column(column) <= num
        elif op == "==":
            return sa.column(column) == num
    elif "notnull" in parsed and parsed["notnull"] is True:
        return sa.not_(sa.column(column).is_(None))
    else:
        raise ConditionParserError(f"unrecognized column condition: {row_condition}")
