"""Rendering utility"""
import copy
import decimal
import locale
import re
import warnings

from great_expectations.data_context.types.resource_identifiers import (
    ValidationResultIdentifier,
)

DEFAULT_PRECISION = 4
# create a new context for this task
ctx = decimal.Context()
# Lowering precision from the system default (28) can allow additional control over display
ctx.prec = DEFAULT_PRECISION


def num_to_str(f, precision=DEFAULT_PRECISION, use_locale=False, no_scientific=False):
    """Convert the given float to a string, centralizing standards for precision and decisions about scientific
    notation. Adds an approximately equal sign in the event precision loss (e.g. rounding) has occurred.

    There's a good discussion of related issues here:
        https://stackoverflow.com/questions/38847690/convert-float-to-string-in-positional-format-without-scientific-notation-and-fa

    Args:
        f: the number to format
        precision: the number of digits of precision to display
        use_locale: if True, use locale-specific formatting (e.g. adding thousands separators)
        no_scientific: if True, print all available digits of precision without scientific notation. This may insert
            leading zeros before very small numbers, causing the resulting string to be longer than `precision`
            characters

    Returns:
        A string representation of the float, according to the desired parameters

    """
    assert not (use_locale and no_scientific)
    if precision != DEFAULT_PRECISION:
        local_context = decimal.Context()
        local_context.prec = precision
    else:
        local_context = ctx
    # We cast to string; we want to avoid precision issues, but format everything as though it were a float.
    # So, if it's not already a float, we will append a decimal point to the string representation
    s = repr(f)
    if not isinstance(f, float):
        s += locale.localeconv().get("decimal_point") + "0"
    d = local_context.create_decimal(s)
    if no_scientific:
        result = format(d, "f")
    elif use_locale:
        result = format(d, "n")
    else:
        result = format(d, "g")
    if f != locale.atof(result):
        # result = '≈' + result
        #  ≈  # \u2248
        result = "≈" + result
    decimal_char = locale.localeconv().get("decimal_point")
    if "e" not in result and "E" not in result and decimal_char in result:
        result = result.rstrip("0").rstrip(decimal_char)
    return result


SUFFIXES = {1: "st", 2: "nd", 3: "rd"}


def ordinal(num):
    """Convert a number to ordinal"""
    # Taken from https://codereview.stackexchange.com/questions/41298/producing-ordinal-numbers/41301
    # Consider a library like num2word when internationalization comes
    if 10 <= num % 100 <= 20:
        suffix = "th"
    else:
        # the second parameter is a default.
        suffix = SUFFIXES.get(num % 10, "th")
    return str(num) + suffix


def resource_key_passes_run_name_filter(resource_key, run_name_filter):
    if type(resource_key) == ValidationResultIdentifier:
        run_name = resource_key.run_id.run_name
    else:
        raise TypeError(
            "run_name_filter filtering is only implemented for ValidationResultResources."
        )

    if run_name_filter.get("equals"):
        return run_name_filter.get("equals") == run_name
    elif run_name_filter.get("not_equals"):
        return run_name_filter.get("not_equals") != run_name
    elif run_name_filter.get("includes"):
        return run_name_filter.get("includes") in run_name
    elif run_name_filter.get("not_includes"):
        return run_name_filter.get("not_includes") not in run_name
    elif run_name_filter.get("matches_regex"):
        regex = run_name_filter.get("matches_regex")
        regex_match = re.search(regex, run_name)
        return False if regex_match is None else True
    elif run_name_filter.get("eq"):
        warnings.warn(
            "The 'eq' key will be deprecated and renamed 'equals' - please update your code accordingly.",
            DeprecationWarning,
        )
        return run_name_filter.get("eq") == run_name
    elif run_name_filter.get("ne"):
        warnings.warn(
            "The 'ne' key will be deprecated and renamed 'not_equals' - please update your code accordingly.",
            DeprecationWarning,
        )
        return run_name_filter.get("ne") != run_name


def substitute_none_for_missing(kwargs, kwarg_list):
    """Utility function to plug Nones in when optional parameters are not specified in expectation kwargs.

    Example:
        Input:
            kwargs={"a":1, "b":2},
            kwarg_list=["c", "d"]

        Output: {"a":1, "b":2, "c": None, "d": None}

    This is helpful for standardizing the input objects for rendering functions.
    The alternative is lots of awkward `if "some_param" not in kwargs or kwargs["some_param"] == None:` clauses in renderers.
    """

    new_kwargs = copy.deepcopy(kwargs)
    for kwarg in kwarg_list:
        if kwarg not in new_kwargs:
            new_kwargs[kwarg] = None
    return new_kwargs


# NOTE: the method is pretty dirty
def parse_row_condition_string_pandas_engine(condition_string):
    if len(condition_string) == 0:
        condition_string = "True"

    template_str = "if "
    params = {}

    condition_string = (
        condition_string.replace("&", " AND ")
        .replace(" and ", " AND ")
        .replace("|", " OR ")
        .replace(" or ", " OR ")
        .replace("~", " NOT ")
        .replace(" not ", " NOT ")
    )
    condition_string = " ".join(condition_string.split())

    # replace tuples of values by lists of values
    tuples_list = re.findall(r"\([^\(\)]*,[^\(\)]*\)", condition_string)
    for value_tuple in tuples_list:
        value_list = value_tuple.replace("(", "[").replace(")", "]")
        condition_string = condition_string.replace(value_tuple, value_list)

    # divide the whole condition into smaller parts
    conditions_list = re.split(r"AND|OR|NOT(?! in)|\(|\)", condition_string)
    conditions_list = [
        condition.strip()
        for condition in conditions_list
        if condition != "" and condition != " "
    ]

    for i, condition in enumerate(conditions_list):
        params["row_condition__" + str(i)] = condition.replace(" NOT ", " not ")
        condition_string = condition_string.replace(
            condition, "$row_condition__" + str(i)
        )

    template_str += condition_string.lower()

    return template_str, params


def handle_strict_min_max(params: dict) -> (str, str):
    """
    Utility function for the at least and at most conditions based on strictness.

    Args:
        params: dictionary containing "strict_min" and "strict_max" booleans.

    Returns:
        tuple of strings to use for the at least condition and the at most condition
    """

    at_least_str = (
        "greater than"
        if params.get("strict_min") is True
        else "greater than or equal to"
    )
    at_most_str = (
        "less than" if params.get("strict_max") is True else "less than or equal to"
    )

    return at_least_str, at_most_str
