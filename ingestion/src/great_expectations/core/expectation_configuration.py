import json
import logging
from copy import deepcopy
from typing import Any, Dict

import jsonpatch

from great_expectations.core.evaluation_parameters import (
    _deduplicate_evaluation_parameter_dependencies,
    build_evaluation_parameters,
    find_evaluation_parameter_dependencies,
)
from great_expectations.core.urn import ge_urn
from great_expectations.core.util import (
    convert_to_json_serializable,
    ensure_json_serializable,
    nested_update,
)
from great_expectations.exceptions import (
    InvalidExpectationConfigurationError,
    InvalidExpectationKwargsError,
    ParserError,
)
from great_expectations.expectations.registry import get_expectation_impl
from great_expectations.marshmallow__shade import (
    Schema,
    ValidationError,
    fields,
    post_load,
)
from great_expectations.types import SerializableDictDot

logger = logging.getLogger(__name__)


def parse_result_format(result_format):
    """This is a simple helper utility that can be used to parse a string result_format into the dict format used
    internally by great_expectations. It is not necessary but allows shorthand for result_format in cases where
    there is no need to specify a custom partial_unexpected_count."""
    if isinstance(result_format, str):
        result_format = {"result_format": result_format, "partial_unexpected_count": 20}
    else:
        if "partial_unexpected_count" not in result_format:
            result_format["partial_unexpected_count"] = 20

    return result_format


class ExpectationConfiguration(SerializableDictDot):
    """ExpectationConfiguration defines the parameters and name of a specific expectation."""

    kwarg_lookup_dict = {
        "expect_column_to_exist": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["column_index"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "column_index": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_table_columns_to_match_ordered_list": {
            "domain_kwargs": [],
            "success_kwargs": ["column_list"],
            "default_kwarg_values": {
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_table_columns_to_match_set": {
            "domain_kwargs": [],
            "success_kwargs": ["column_set", "exact_match"],
            "default_kwarg_values": {
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "exact_match": True,
            },
        },
        "expect_table_column_count_to_be_between": {
            "domain_kwargs": [],
            "success_kwargs": ["min_value", "max_value"],
            "default_kwarg_values": {
                "min_value": None,
                "max_value": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_table_column_count_to_equal": {
            "domain_kwargs": [],
            "success_kwargs": ["value"],
            "default_kwarg_values": {
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_table_row_count_to_be_between": {
            "domain_kwargs": [],
            "success_kwargs": ["min_value", "max_value"],
            "default_kwarg_values": {
                "min_value": None,
                "max_value": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_table_row_count_to_equal": {
            "domain_kwargs": [],
            "success_kwargs": ["value"],
            "default_kwarg_values": {
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_unique": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_not_be_null": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_compound_columns_to_be_unique": {
            "domain_kwargs": ["column_list", "row_condition", "condition_parser"],
            "success_kwargs": ["ignore_row_if"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ignore_row_if": "all_values_are_missing",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_null": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_of_type": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_in_type_list": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_list", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_in_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "mostly", "parse_strings_as_datetimes"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "parse_strings_as_datetimes": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_not_be_in_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "mostly", "parse_strings_as_datetimes"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "parse_strings_as_datetimes": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": [
                "min_value",
                "max_value",
                "strict_min",
                "strict_max",
                "allow_cross_type_comparisons",
                "parse_strings_as_datetimes",
                "output_strftime_format",
                "mostly",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "allow_cross_type_comparisons": None,
                "parse_strings_as_datetimes": None,
                "output_strftime_format": None,
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_increasing": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["strictly", "parse_strings_as_datetimes", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "strictly": None,
                "parse_strings_as_datetimes": None,
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_decreasing": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["strictly", "parse_strings_as_datetimes", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "strictly": None,
                "parse_strings_as_datetimes": None,
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_value_lengths_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_value_lengths_to_equal": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_match_regex": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["regex", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_not_match_regex": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["regex", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_match_regex_list": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["regex_list", "match_on", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "match_on": "any",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_not_match_regex_list": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["regex_list", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_match_strftime_format": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["strftime_format", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_dateutil_parseable": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_be_json_parseable": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_values_to_match_json_schema": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["json_schema", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["distribution", "p_value", "params"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "p_value": 0.05,
                "params": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_distinct_values_to_be_in_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "parse_strings_as_datetimes"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "parse_strings_as_datetimes": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_distinct_values_to_equal_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "parse_strings_as_datetimes"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "parse_strings_as_datetimes": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_distinct_values_to_contain_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "parse_strings_as_datetimes"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "parse_strings_as_datetimes": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_mean_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "strict_min", "strict_max"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_median_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "strict_min", "strict_max"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_quantile_values_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["quantile_ranges", "allow_relative_error"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "allow_relative_error": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_stdev_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "strict_min", "strict_max"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_unique_value_count_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_proportion_of_unique_values_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "strict_min", "strict_max"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_most_common_value_to_be_in_set": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["value_set", "ties_okay"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ties_okay": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_sum_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["min_value", "max_value", "strict_min", "strict_max"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_min_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": [
                "min_value",
                "max_value",
                "strict_min",
                "strict_max",
                "parse_strings_as_datetimes",
                "output_strftime_format",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "parse_strings_as_datetimes": None,
                "output_strftime_format": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_max_to_be_between": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": [
                "min_value",
                "max_value",
                "strict_min",
                "strict_max",
                "parse_strings_as_datetimes",
                "output_strftime_format",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "min_value": None,
                "max_value": None,
                "strict_min": False,
                "strict_max": False,
                "parse_strings_as_datetimes": None,
                "output_strftime_format": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_chisquare_test_p_value_to_be_greater_than": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["partition_object", "p", "tail_weight_holdout"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "partition_object": None,
                "p": 0.05,
                "tail_weight_holdout": 0,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": [
                "partition_object",
                "p",
                "bootstrap_samples",
                "bootstrap_sample_size",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "partition_object": None,
                "p": 0.05,
                "bootstrap_samples": None,
                "bootstrap_sample_size": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_kl_divergence_to_be_less_than": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": [
                "partition_object",
                "threshold",
                "tail_weight_holdout",
                "internal_weight_holdout",
                "bucketize_data",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "partition_object": None,
                "threshold": None,
                "tail_weight_holdout": 0,
                "internal_weight_holdout": 0,
                "bucketize_data": True,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_pair_values_to_be_equal": {
            "domain_kwargs": [
                "column_A",
                "column_B",
                "row_condition",
                "condition_parser",
            ],
            "success_kwargs": ["ignore_row_if"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ignore_row_if": "both_values_are_missing",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_pair_values_A_to_be_greater_than_B": {
            "domain_kwargs": [
                "column_A",
                "column_B",
                "row_condition",
                "condition_parser",
            ],
            "success_kwargs": [
                "or_equal",
                "parse_strings_as_datetimes",
                "allow_cross_type_comparisons",
                "ignore_row_if",
            ],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "or_equal": None,
                "parse_strings_as_datetimes": None,
                "allow_cross_type_comparisons": None,
                "ignore_row_if": "both_values_are_missing",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_pair_values_to_be_in_set": {
            "domain_kwargs": [
                "column_A",
                "column_B",
                "row_condition",
                "condition_parser",
            ],
            "success_kwargs": ["value_pairs_set", "ignore_row_if", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ignore_row_if": "both_values_are_missing",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_multicolumn_values_to_be_unique": {
            "domain_kwargs": ["column_list", "row_condition", "condition_parser"],
            "success_kwargs": ["ignore_row_if"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ignore_row_if": "all_values_are_missing",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_multicolumn_sum_to_equal": {
            "domain_kwargs": ["column_list", "row_condition", "condition_parser"],
            "success_kwargs": ["sum_total", "ignore_row_if"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "ignore_row_if": "all_values_are_missing",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "_expect_column_values_to_be_of_type__aggregate": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "_expect_column_values_to_be_of_type__map": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "_expect_column_values_to_be_in_type_list__aggregate": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_list", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "_expect_column_values_to_be_in_type_list__map": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["type_list", "mostly"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_column_value_z_scores_to_be_less_than": {
            "domain_kwargs": ["column", "row_condition", "condition_parser"],
            "success_kwargs": ["threshold", "mostly", "double_sided"],
            "default_kwarg_values": {
                "row_condition": None,
                "condition_parser": "pandas",
                "mostly": 1,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
            },
        },
        "expect_file_line_regex_match_count_to_be_between": {
            "domain_kwargs": [],
            "success_kwargs": [
                "regex",
                "expected_min_count",
                "expected_max_count",
                "skip",
            ],
            "default_kwarg_values": {
                "expected_min_count": 0,
                "expected_max_count": None,
                "skip": None,
                "mostly": 1,
                "nonnull_lines_regex": r"^\s*$",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
                "_lines": None,
            },
        },
        "expect_file_line_regex_match_count_to_equal": {
            "domain_kwargs": [],
            "success_kwargs": ["regex", "expected_count", "skip"],
            "default_kwarg_values": {
                "expected_count": 0,
                "skip": None,
                "mostly": 1,
                "nonnull_lines_regex": r"^\s*$",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
                "_lines": None,
            },
        },
        "expect_file_hash_to_equal": {
            "domain_kwargs": [],
            "success_kwargs": ["value", "hash_alg"],
            "default_kwarg_values": {
                "hash_alg": "md5",
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
            },
        },
        "expect_file_size_to_be_between": {
            "domain_kwargs": [],
            "success_kwargs": ["minsize", "maxsize"],
            "default_kwarg_values": {
                "minsize": 0,
                "maxsize": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
            },
        },
        "expect_file_to_exist": {
            "domain_kwargs": [],
            "success_kwargs": ["filepath"],
            "default_kwarg_values": {
                "filepath": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
            },
        },
        "expect_file_to_have_valid_table_header": {
            "domain_kwargs": [],
            "success_kwargs": ["regex", "skip"],
            "default_kwarg_values": {
                "skip": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
            },
        },
        "expect_file_to_be_valid_json": {
            "domain_kwargs": [],
            "success_kwargs": ["schema"],
            "default_kwarg_values": {
                "schema": None,
                "result_format": "BASIC",
                "include_config": True,
                "catch_exceptions": False,
                "meta": None,
            },
        },
    }

    runtime_kwargs = ["result_format", "include_config", "catch_exceptions"]

    def __init__(self, expectation_type, kwargs, meta=None, success_on_last_run=None):
        if not isinstance(expectation_type, str):
            raise InvalidExpectationConfigurationError(
                "expectation_type must be a string"
            )
        self._expectation_type = expectation_type
        if not isinstance(kwargs, dict):
            raise InvalidExpectationConfigurationError(
                "expectation configuration kwargs must be a dict."
            )
        self._kwargs = kwargs
        self._raw_kwargs = None  # the kwargs before evaluation parameters are evaluated
        if meta is None:
            meta = {}
        # We require meta information to be serializable, but do not convert until necessary
        ensure_json_serializable(meta)
        self.meta = meta
        self.success_on_last_run = success_on_last_run

    def process_evaluation_parameters(
        self, evaluation_parameters, interactive_evaluation=True, data_context=None
    ):
        if self._raw_kwargs is not None:
            logger.debug(
                "evaluation_parameters have already been built on this expectation"
            )

        (evaluation_args, substituted_parameters,) = build_evaluation_parameters(
            self._kwargs,
            evaluation_parameters,
            interactive_evaluation,
            data_context,
        )

        self._raw_kwargs = self._kwargs
        self._kwargs = evaluation_args
        if len(substituted_parameters) > 0:
            self.meta["substituted_parameters"] = substituted_parameters

    def get_raw_configuration(self):
        # return configuration without substituted evaluation parameters
        raw_config = deepcopy(self)
        if raw_config._raw_kwargs is not None:
            raw_config._kwargs = raw_config._raw_kwargs
            raw_config._raw_kwargs = None

        return raw_config

    def patch(self, op: str, path: str, value: Any) -> "ExpectationConfiguration":
        """

        Args:
            op: A jsonpatch operation. One of 'add', 'replace', or 'remove'
            path: A jsonpatch path for the patch operation
            value: The value to patch

        Returns:
            The patched ExpectationConfiguration object
        """
        if op not in ["add", "replace", "remove"]:
            raise ValueError("Op must be either 'add', 'replace', or 'remove'")

        try:
            valid_path = path.split("/")[1]
        except IndexError:
            raise IndexError(
                "Ensure you have a valid jsonpatch path of the form '/path/foo' "
                "(see http://jsonpatch.com/)"
            )

        if valid_path not in self.get_runtime_kwargs().keys():
            raise ValueError("Path not available in kwargs (see http://jsonpatch.com/)")

        # TODO: Call validate_kwargs when implemented
        patch = jsonpatch.JsonPatch([{"op": op, "path": path, "value": value}])

        patch.apply(self.kwargs, in_place=True)
        return self

    @property
    def expectation_type(self):
        return self._expectation_type

    @property
    def kwargs(self):
        return self._kwargs

    def _get_default_custom_kwargs(self):
        # NOTE: this is a holdover until class-first expectations control their
        # defaults, and so defaults are inherited.
        if self.expectation_type.startswith("expect_column_pair"):
            return {
                "domain_kwargs": [
                    "column_A",
                    "column_B",
                    "row_condition",
                    "condition_parser",
                ],
                # NOTE: this is almost certainly incomplete; subclasses should override
                "success_kwargs": [],
                "default_kwarg_values": {
                    "column_A": None,
                    "column_B": None,
                    "row_condition": None,
                    "condition_parser": None,
                },
            }
        elif self.expectation_type.startswith("expect_column"):
            return {
                "domain_kwargs": ["column", "row_condition", "condition_parser"],
                # NOTE: this is almost certainly incomplete; subclasses should override
                "success_kwargs": [],
                "default_kwarg_values": {
                    "column": None,
                    "row_condition": None,
                    "condition_parser": None,
                },
            }

        logger.warning("Requested kwargs for an unrecognized expectation.")
        return {
            "domain_kwargs": [],
            # NOTE: this is almost certainly incomplete; subclasses should override
            "success_kwargs": [],
            "default_kwarg_values": {},
        }

    def get_domain_kwargs(self):
        expectation_kwargs_dict = self.kwarg_lookup_dict.get(
            self.expectation_type, None
        )
        if expectation_kwargs_dict is None:
            impl = get_expectation_impl(self.expectation_type)
            if impl is not None:
                domain_keys = impl.domain_keys
                default_kwarg_values = impl.default_kwarg_values
            else:
                expectation_kwargs_dict = self._get_default_custom_kwargs()
                default_kwarg_values = expectation_kwargs_dict.get(
                    "default_kwarg_values", {}
                )
                domain_keys = expectation_kwargs_dict["domain_kwargs"]
        else:
            default_kwarg_values = expectation_kwargs_dict.get(
                "default_kwarg_values", {}
            )
            domain_keys = expectation_kwargs_dict["domain_kwargs"]
        domain_kwargs = {
            key: self.kwargs.get(key, default_kwarg_values.get(key))
            for key in domain_keys
        }
        missing_kwargs = set(domain_keys) - set(domain_kwargs.keys())
        if missing_kwargs:
            raise InvalidExpectationKwargsError(
                f"Missing domain kwargs: {list(missing_kwargs)}"
            )
        return domain_kwargs

    def get_success_kwargs(self):
        expectation_kwargs_dict = self.kwarg_lookup_dict.get(
            self.expectation_type, None
        )
        if expectation_kwargs_dict is None:
            impl = get_expectation_impl(self.expectation_type)
            if impl is not None:
                success_keys = impl.success_keys
                default_kwarg_values = impl.default_kwarg_values
            else:
                expectation_kwargs_dict = self._get_default_custom_kwargs()
                default_kwarg_values = expectation_kwargs_dict.get(
                    "default_kwarg_values", {}
                )
                success_keys = expectation_kwargs_dict["success_kwargs"]
        else:
            default_kwarg_values = expectation_kwargs_dict.get(
                "default_kwarg_values", {}
            )
            success_keys = expectation_kwargs_dict["success_kwargs"]
        domain_kwargs = self.get_domain_kwargs()
        success_kwargs = {
            key: self.kwargs.get(key, default_kwarg_values.get(key))
            for key in success_keys
        }
        success_kwargs.update(domain_kwargs)
        return success_kwargs

    def get_runtime_kwargs(self, runtime_configuration=None):
        expectation_kwargs_dict = self.kwarg_lookup_dict.get(
            self.expectation_type, None
        )
        if expectation_kwargs_dict is None:
            impl = get_expectation_impl(self.expectation_type)
            if impl is not None:
                runtime_keys = impl.runtime_keys
                default_kwarg_values = impl.default_kwarg_values
            else:
                expectation_kwargs_dict = self._get_default_custom_kwargs()
                default_kwarg_values = expectation_kwargs_dict.get(
                    "default_kwarg_values", {}
                )
                runtime_keys = self.runtime_kwargs
        else:
            default_kwarg_values = expectation_kwargs_dict.get(
                "default_kwarg_values", {}
            )
            runtime_keys = self.runtime_kwargs

        success_kwargs = self.get_success_kwargs()
        lookup_kwargs = deepcopy(self.kwargs)
        if runtime_configuration:
            lookup_kwargs.update(runtime_configuration)
        runtime_kwargs = {
            key: lookup_kwargs.get(key, default_kwarg_values.get(key))
            for key in runtime_keys
        }
        runtime_kwargs["result_format"] = parse_result_format(
            runtime_kwargs["result_format"]
        )
        runtime_kwargs.update(success_kwargs)
        return runtime_kwargs

    def applies_to_same_domain(self, other_expectation_configuration):
        if (
            not self.expectation_type
            == other_expectation_configuration.expectation_type
        ):
            return False
        return (
            self.get_domain_kwargs()
            == other_expectation_configuration.get_domain_kwargs()
        )

    def isEquivalentTo(self, other, match_type="success"):
        """ExpectationConfiguration equivalence does not include meta, and relies on *equivalence* of kwargs."""
        if not isinstance(other, self.__class__):
            if isinstance(other, dict):
                try:
                    other = expectationConfigurationSchema.load(other)
                except ValidationError:
                    logger.debug(
                        "Unable to evaluate equivalence of ExpectationConfiguration object with dict because "
                        "dict other could not be instantiated as an ExpectationConfiguration"
                    )
                    return NotImplemented
            else:
                # Delegate comparison to the other instance
                return NotImplemented
        if match_type == "domain":
            return all(
                (
                    self.expectation_type == other.expectation_type,
                    self.get_domain_kwargs() == other.get_domain_kwargs(),
                )
            )

        elif match_type == "success":
            return all(
                (
                    self.expectation_type == other.expectation_type,
                    self.get_success_kwargs() == other.get_success_kwargs(),
                )
            )

        elif match_type == "runtime":
            return all(
                (
                    self.expectation_type == other.expectation_type,
                    self.kwargs == other.kwargs,
                )
            )

    def __eq__(self, other):
        """ExpectationConfiguration equality does include meta, but ignores instance identity."""
        if not isinstance(other, self.__class__):
            # Delegate comparison to the other instance's __eq__.
            return NotImplemented
        this_kwargs: dict = convert_to_json_serializable(self.kwargs)
        other_kwargs: dict = convert_to_json_serializable(other.kwargs)
        this_meta: dict = convert_to_json_serializable(self.meta)
        other_meta: dict = convert_to_json_serializable(other.meta)
        return all(
            (
                self.expectation_type == other.expectation_type,
                this_kwargs == other_kwargs,
                this_meta == other_meta,
            )
        )

    def __ne__(self, other):
        # By using the == operator, the returned NotImplemented is handled correctly.
        return not self == other

    def __repr__(self):
        return json.dumps(self.to_json_dict())

    def __str__(self):
        return json.dumps(self.to_json_dict(), indent=2)

    def to_json_dict(self):
        myself = expectationConfigurationSchema.dump(self)
        # NOTE - JPC - 20191031: migrate to expectation-specific schemas that subclass result with properly-typed
        # schemas to get serialization all-the-way down via dump
        myself["kwargs"] = convert_to_json_serializable(myself["kwargs"])
        return myself

    def get_evaluation_parameter_dependencies(self):
        parsed_dependencies = {}
        for key, value in self.kwargs.items():
            if isinstance(value, dict) and "$PARAMETER" in value:
                param_string_dependencies = find_evaluation_parameter_dependencies(
                    value["$PARAMETER"]
                )
                nested_update(parsed_dependencies, param_string_dependencies)

        dependencies = {}
        urns = parsed_dependencies.get("urns", [])
        for string_urn in urns:
            try:
                urn = ge_urn.parseString(string_urn)
            except ParserError:
                logger.warning(
                    "Unable to parse great_expectations urn {}".format(
                        value["$PARAMETER"]
                    )
                )
                continue

            if not urn.get("metric_kwargs"):
                nested_update(
                    dependencies,
                    {urn["expectation_suite_name"]: [urn["metric_name"]]},
                )
            else:
                nested_update(
                    dependencies,
                    {
                        urn["expectation_suite_name"]: [
                            {
                                "metric_kwargs_id": {
                                    urn["metric_kwargs"]: [urn["metric_name"]]
                                }
                            }
                        ]
                    },
                )

        dependencies = _deduplicate_evaluation_parameter_dependencies(dependencies)
        return dependencies

    def _get_expectation_impl(self):
        return get_expectation_impl(self.expectation_type)

    def validate(
        self,
        validator,
        runtime_configuration=None,
    ):
        expectation_impl = self._get_expectation_impl()
        return expectation_impl(self).validate(
            validator=validator,
            runtime_configuration=runtime_configuration,
        )

    def metrics_validate(
        self,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine=None,
    ):
        expectation_impl = self._get_expectation_impl()
        return expectation_impl(self).metrics_validate(
            metrics,
            runtime_configuration=runtime_configuration,
            execution_engine=execution_engine,
        )


class ExpectationConfigurationSchema(Schema):
    expectation_type = fields.Str(
        required=True,
        error_messages={
            "required": "expectation_type missing in expectation configuration"
        },
    )
    kwargs = fields.Dict()
    meta = fields.Dict()

    # noinspection PyUnusedLocal
    @post_load
    def make_expectation_configuration(self, data, **kwargs):
        return ExpectationConfiguration(**data)


expectationConfigurationSchema = ExpectationConfigurationSchema()
