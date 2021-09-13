import datetime
from typing import Iterable

import numpy as np
from dateutil.parser import parse
from tqdm.auto import tqdm

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.dataset.util import build_categorical_partition_object
from great_expectations.exceptions import ProfilerError
from great_expectations.profile.base import ProfilerCardinality, ProfilerDataType
from great_expectations.profile.basic_dataset_profiler import (
    BasicDatasetProfilerBase,
    logger,
)


class BasicSuiteBuilderProfiler(BasicDatasetProfilerBase):
    """
    This profiler helps build coarse expectations for columns you care about.

    The goal of this profiler is to expedite the process of authoring an
    expectation suite by building possibly relevant exceptions for columns that
    you care about. You can then easily edit the suite and adjust or delete
    these expectations to hone your new suite.

    Ranges of acceptable values in the expectations created by this profiler
    (for example, the min/max of the value in
    expect_column_values_to_be_between) are created only to demonstrate the
    functionality and should not be taken as the actual ranges. You should
    definitely edit this coarse suite.

    Configuration is optional, and if not provided, this profiler will create
    expectations for all columns.

    Configuration is a dictionary with a `columns` key containing a list of the
    column names you want coarse expectations created for. This dictionary can
    also contain a `excluded_expectations` key with a list of expectation
    names you do not want created or a `included_expectations` key with a list
    of expectation names you want created (if applicable).

    For example, if you had a wide patients table and you want expectations on
    three columns, you'd do this:


    suite, validation_result = BasicSuiteBuilderProfiler().profile(
        dataset,
        {"columns": ["id", "username", "address"]}
    )

    For example, if you had a wide patients table and you want expectations on
    all columns, excluding three statistical expectations, you'd do this:


    suite, validation_result = BasicSuiteBuilderProfiler().profile(
        dataset,
        {
            "excluded_expectations":
            [
                "expect_column_mean_to_be_between",
                "expect_column_median_to_be_between",
                "expect_column_quantile_values_to_be_between",
            ],
        }
    )

    For example, if you had a wide patients table and you want only two types of
    expectations on all applicable columns you'd do this:


    suite, validation_result = BasicSuiteBuilderProfiler().profile(
        dataset,
        {
            "included_expectations":
            [
                "expect_column_to_not_be_null",
                "expect_column_values_to_be_in_set",
            ],
        }
    )

    It can also be used to generate an expectation suite that contains one
    instance of every interesting expectation type.

    When used in this "demo" mode, the suite is intended to demonstrate of the
    expressive power of expectations and provide a service similar to the one
    expectations glossary documentation page, but on a users' own data.

    suite, validation_result = BasicSuiteBuilderProfiler().profile(dataset, configuration="demo")
    """

    @classmethod
    def _get_column_type_with_caching(cls, dataset, column_name, cache):
        column_cache_entry = cache.get(column_name)
        if not column_cache_entry:
            column_cache_entry = {}
            cache[column_name] = column_cache_entry
        column_type = column_cache_entry.get("type")
        if not column_type:
            column_type = cls._get_column_type(dataset, column_name)
            column_cache_entry["type"] = column_type
            # remove the expectation
            # Does this change with different config format?
            dataset.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_values_to_be_in_type_list",
                    kwargs={"column": column_name},
                )
            )
            dataset.set_config_value("interactive_evaluation", True)

        return column_type

    @classmethod
    def _get_column_cardinality_with_caching(cls, dataset, column_name, cache):
        column_cache_entry = cache.get(column_name)
        if not column_cache_entry:
            column_cache_entry = {}
            cache[column_name] = column_cache_entry
        column_cardinality = column_cache_entry.get("cardinality")
        if not column_cardinality:
            column_cardinality = cls._get_column_cardinality(dataset, column_name)
            column_cache_entry["cardinality"] = column_cardinality
            # remove the expectations
            dataset.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_unique_value_count_to_be_between",
                    kwargs={"column": column_name},
                )
            )
            dataset.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_proportion_of_unique_values_to_be_between",
                    kwargs={"column": column_name},
                )
            )
            dataset.set_config_value("interactive_evaluation", True)

        return column_cardinality

    @classmethod
    def _create_expectations_for_low_card_column(
        cls,
        dataset,
        column,
        column_cache,
        excluded_expectations=None,
        included_expectations=None,
    ):
        cls._create_non_nullity_expectations(
            dataset,
            column,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )

        if (
            not excluded_expectations
            or "expect_column_distinct_values_to_be_in_set" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_distinct_values_to_be_in_set" in included_expectations
        ):
            value_set = dataset.expect_column_distinct_values_to_be_in_set(
                column, value_set=None, result_format="SUMMARY"
            ).result["observed_value"]
            dataset.expect_column_distinct_values_to_be_in_set(
                column, value_set=value_set, result_format="SUMMARY"
            )

        if (
            not excluded_expectations
            or "expect_column_kl_divergence_to_be_less_than"
            not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_kl_divergence_to_be_less_than" in included_expectations
        ):
            if cls._get_column_cardinality_with_caching(
                dataset, column, column_cache
            ) in [
                ProfilerCardinality.TWO,
                ProfilerCardinality.VERY_FEW,
            ]:
                partition_object = build_categorical_partition_object(dataset, column)
                dataset.expect_column_kl_divergence_to_be_less_than(
                    column,
                    partition_object=partition_object,
                    threshold=0.6,
                    catch_exceptions=True,
                )

    @classmethod
    def _create_non_nullity_expectations(
        cls, dataset, column, excluded_expectations=None, included_expectations=None
    ):
        if (
            not excluded_expectations
            or "expect_column_values_to_not_be_null" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_values_to_not_be_null" in included_expectations
        ):
            not_null_result = dataset.expect_column_values_to_not_be_null(column)
            if not not_null_result.success:
                unexpected_percent = float(not_null_result.result["unexpected_percent"])
                potential_mostly_value = (100.0 - unexpected_percent - 10) / 100.0
                safe_mostly_value = round(max(0.001, potential_mostly_value), 3)
                dataset.expect_column_values_to_not_be_null(
                    column, mostly=safe_mostly_value
                )

    @classmethod
    def _create_expectations_for_numeric_column(
        cls, dataset, column, excluded_expectations=None, included_expectations=None
    ):
        cls._create_non_nullity_expectations(
            dataset,
            column,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )

        if (
            not excluded_expectations
            or "expect_column_min_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_min_to_be_between" in included_expectations
        ):
            observed_min = dataset.expect_column_min_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not _is_nan(observed_min):
                dataset.expect_column_min_to_be_between(
                    column, min_value=observed_min - 1, max_value=observed_min + 1
                )
            else:
                logger.debug(
                    f"Skipping expect_column_min_to_be_between because observed value is nan: {observed_min}"
                )

        if (
            not excluded_expectations
            or "expect_column_max_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_max_to_be_between" in included_expectations
        ):
            observed_max = dataset.expect_column_max_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not _is_nan(observed_max):
                dataset.expect_column_max_to_be_between(
                    column, min_value=observed_max - 1, max_value=observed_max + 1
                )
            else:
                logger.debug(
                    f"Skipping expect_column_max_to_be_between because observed value is nan: {observed_max}"
                )

        if (
            not excluded_expectations
            or "expect_column_mean_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_mean_to_be_between" in included_expectations
        ):
            observed_mean = dataset.expect_column_mean_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not _is_nan(observed_mean):
                dataset.expect_column_mean_to_be_between(
                    column, min_value=observed_mean - 1, max_value=observed_mean + 1
                )
            else:
                logger.debug(
                    f"Skipping expect_column_mean_to_be_between because observed value is nan: {observed_mean}"
                )

        if (
            not excluded_expectations
            or "expect_column_median_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_median_to_be_between" in included_expectations
        ):
            observed_median = dataset.expect_column_median_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not _is_nan(observed_median):
                dataset.expect_column_median_to_be_between(
                    column, min_value=observed_median - 1, max_value=observed_median + 1
                )
            else:
                logger.debug(
                    f"Skipping expect_column_median_to_be_between because observed value is nan: {observed_median}"
                )

        allow_relative_error: bool = dataset.attempt_allowing_relative_error()

        if (
            not excluded_expectations
            or "expect_column_quantile_values_to_be_between"
            not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_quantile_values_to_be_between" in included_expectations
        ):
            quantile_result = dataset.expect_column_quantile_values_to_be_between(
                column,
                quantile_ranges={
                    "quantiles": [0.05, 0.25, 0.5, 0.75, 0.95],
                    "value_ranges": [
                        [None, None],
                        [None, None],
                        [None, None],
                        [None, None],
                        [None, None],
                    ],
                },
                allow_relative_error=allow_relative_error,
                result_format="SUMMARY",
                catch_exceptions=True,
            )
            if quantile_result.exception_info and (
                quantile_result.exception_info["exception_traceback"]
                or quantile_result.exception_info["exception_message"]
            ):
                # TODO quantiles are not implemented correctly on sqlite, and likely other sql dialects
                logger.debug(quantile_result.exception_info["exception_traceback"])
                logger.debug(quantile_result.exception_info["exception_message"])
            else:
                dataset.set_config_value("interactive_evaluation", False)
                dataset.expect_column_quantile_values_to_be_between(
                    column,
                    quantile_ranges={
                        "quantiles": quantile_result.result["observed_value"][
                            "quantiles"
                        ],
                        "value_ranges": [
                            [v - 1, v + 1]
                            for v in quantile_result.result["observed_value"]["values"]
                        ],
                    },
                    allow_relative_error=allow_relative_error,
                    catch_exceptions=True,
                )
                dataset.set_config_value("interactive_evaluation", True)

    @classmethod
    def _create_expectations_for_string_column(
        cls, dataset, column, excluded_expectations=None, included_expectations=None
    ):
        cls._create_non_nullity_expectations(
            dataset,
            column,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )
        if (
            not excluded_expectations
            or "expect_column_value_lengths_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_value_lengths_to_be_between" in included_expectations
        ):
            dataset.expect_column_value_lengths_to_be_between(column, min_value=1)

    @classmethod
    def _find_next_low_card_column(
        cls, dataset, columns, profiled_columns, column_cache
    ):
        for column in columns:
            if column in profiled_columns["low_card"]:
                continue
            cardinality = cls._get_column_cardinality_with_caching(
                dataset, column, column_cache
            )
            if cardinality in [
                ProfilerCardinality.TWO,
                ProfilerCardinality.VERY_FEW,
                ProfilerCardinality.FEW,
            ]:
                return column

        return None

    @classmethod
    def _find_next_numeric_column(
        cls, dataset, columns, profiled_columns, column_cache
    ):
        for column in columns:
            if column in profiled_columns["numeric"]:
                continue
            if (
                column.lower().strip() == "id"
                or column.lower().strip().find("_id") > -1
            ):
                continue

            cardinality = cls._get_column_cardinality_with_caching(
                dataset, column, column_cache
            )
            type = cls._get_column_type_with_caching(dataset, column, column_cache)

            if (
                cardinality
                in [
                    ProfilerCardinality.MANY,
                    ProfilerCardinality.VERY_MANY,
                    ProfilerCardinality.UNIQUE,
                ]
                and type in [ProfilerDataType.INT, ProfilerDataType.FLOAT]
            ):
                return column

        return None

    @classmethod
    def _find_next_string_column(cls, dataset, columns, profiled_columns, column_cache):
        for column in columns:
            if column in profiled_columns["string"]:
                continue

            cardinality = cls._get_column_cardinality_with_caching(
                dataset, column, column_cache
            )
            type = cls._get_column_type_with_caching(dataset, column, column_cache)

            if (
                cardinality
                in [
                    ProfilerCardinality.MANY,
                    ProfilerCardinality.VERY_MANY,
                    ProfilerCardinality.UNIQUE,
                ]
                and type in [ProfilerDataType.STRING, ProfilerDataType.UNKNOWN]
            ):
                return column

        return None

    @classmethod
    def _find_next_datetime_column(
        cls, dataset, columns, profiled_columns, column_cache
    ):
        for column in columns:
            if column in profiled_columns["datetime"]:
                continue

            cardinality = cls._get_column_cardinality_with_caching(
                dataset, column, column_cache
            )
            type = cls._get_column_type_with_caching(dataset, column, column_cache)

            if (
                cardinality
                in [
                    ProfilerCardinality.MANY,
                    ProfilerCardinality.VERY_MANY,
                    ProfilerCardinality.UNIQUE,
                ]
                and type in [ProfilerDataType.DATETIME]
            ):
                return column

        return None

    @classmethod
    def _create_expectations_for_datetime_column(
        cls, dataset, column, excluded_expectations=None, included_expectations=None
    ):
        cls._create_non_nullity_expectations(
            dataset,
            column,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )

        if (
            not excluded_expectations
            or "expect_column_min_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_min_to_be_between" in included_expectations
        ):
            min_value = dataset.expect_column_min_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]

            if min_value is not None:
                dataset.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_min_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                try:
                    min_value = parse(min_value)
                except TypeError:
                    pass

                try:
                    min_value = min_value + datetime.timedelta(days=-365)
                except OverflowError:
                    min_value = datetime.datetime.min

        if (
            not excluded_expectations
            or "expect_column_max_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_max_to_be_between" in included_expectations
        ):
            max_value = dataset.expect_column_max_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if max_value is not None:
                dataset.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_max_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                try:
                    max_value = parse(max_value)
                except TypeError:
                    pass

                try:
                    max_value = max_value + datetime.timedelta(days=365)
                except OverflowError:
                    max_value = datetime.datetime.max

        if (
            not excluded_expectations
            or "expect_column_min_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_column_min_to_be_between" in included_expectations
        ):
            if min_value is not None or max_value is not None:
                dataset.expect_column_values_to_be_between(
                    column, min_value, max_value, parse_strings_as_datetimes=True
                )

    @classmethod
    def _profile(cls, dataset, configuration=None):
        logger.debug(f"Running profiler with configuration: {configuration}")
        if configuration == "demo":
            return cls._demo_profile(dataset)

        existing_columns = dataset.get_table_columns()
        selected_columns = existing_columns
        included_expectations = []
        excluded_expectations = []

        if configuration:
            if (
                "included_expectations" in configuration
                and "excluded_expectations" in configuration
            ):
                raise ProfilerError(
                    "Please specify either `included_expectations` or `excluded_expectations`."
                )
            if "included_expectations" in configuration:
                included_expectations = configuration["included_expectations"]
                if included_expectations in [False, None, []]:
                    included_expectations = None
                _check_that_expectations_are_available(dataset, included_expectations)
            if "excluded_expectations" in configuration:
                excluded_expectations = configuration["excluded_expectations"]
                if excluded_expectations in [False, None, []]:
                    excluded_expectations = None
                _check_that_expectations_are_available(dataset, excluded_expectations)

            if (
                "included_columns" in configuration
                and "excluded_columns" in configuration
            ):
                raise ProfilerError(
                    "Please specify either `excluded_columns` or `included_columns`."
                )
            elif "included_columns" in configuration:
                selected_columns = configuration["included_columns"]
                if selected_columns in [False, None, []]:
                    selected_columns = []
            elif "excluded_columns" in configuration:
                excluded_columns = configuration["excluded_columns"]
                if excluded_columns in [False, None, []]:
                    excluded_columns = []
                selected_columns = set(existing_columns) - set(excluded_columns)

        _check_that_columns_exist(dataset, selected_columns)
        if included_expectations is None:
            suite = cls._build_column_description_metadata(dataset)
            # remove column exist expectations
            suite.expectations = []
            return suite

        dataset.set_default_expectation_argument("catch_exceptions", False)
        dataset = cls._build_table_row_count_expectation(
            dataset,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )
        dataset.set_config_value("interactive_evaluation", True)
        dataset = cls._build_table_column_expectations(
            dataset,
            excluded_expectations=excluded_expectations,
            included_expectations=included_expectations,
        )

        column_cache = {}
        if selected_columns:
            with tqdm(
                total=len(selected_columns), desc="Profiling Columns", delay=5
            ) as pbar:
                for column in selected_columns:
                    pbar.set_postfix_str(column)
                    cardinality = cls._get_column_cardinality_with_caching(
                        dataset, column, column_cache
                    )
                    column_type = cls._get_column_type_with_caching(
                        dataset, column, column_cache
                    )

                    if cardinality in [
                        ProfilerCardinality.TWO,
                        ProfilerCardinality.VERY_FEW,
                        ProfilerCardinality.FEW,
                    ]:
                        cls._create_expectations_for_low_card_column(
                            dataset, column, column_cache
                        )
                    elif cardinality in [
                        ProfilerCardinality.MANY,
                        ProfilerCardinality.VERY_MANY,
                        ProfilerCardinality.UNIQUE,
                    ]:
                        # TODO we will want to finesse the number and types of
                        #  expectations created here. The simple version is deny/allow list
                        #  and the more complex version is desired per column type and
                        #  cardinality. This deserves more thought on configuration.
                        dataset.expect_column_values_to_be_unique(column)

                        if column_type in [
                            ProfilerDataType.INT,
                            ProfilerDataType.FLOAT,
                        ]:
                            cls._create_expectations_for_numeric_column(dataset, column)
                        elif column_type in [ProfilerDataType.DATETIME]:
                            cls._create_expectations_for_datetime_column(
                                dataset,
                                column,
                                excluded_expectations=excluded_expectations,
                                included_expectations=included_expectations,
                            )
                        elif column_type in [ProfilerDataType.STRING]:
                            cls._create_expectations_for_string_column(
                                dataset,
                                column,
                                excluded_expectations=excluded_expectations,
                                included_expectations=included_expectations,
                            )
                        elif column_type in [ProfilerDataType.UNKNOWN]:
                            logger.debug(
                                f"Skipping expectation creation for column {column} of unknown type: {column_type}"
                            )
                    pbar.update()

        if excluded_expectations:
            # NOTE: we reach into a private member here because of an expected future
            # refactor that will make the suite directly accessible
            dataset._expectation_suite.remove_all_expectations_of_type(
                excluded_expectations
            )
        if included_expectations:
            for expectation in dataset.get_expectation_suite(
                discard_failed_expectations=False,
                suppress_logging=True,
            ).expectations:
                if expectation.expectation_type not in included_expectations:
                    try:
                        dataset.remove_expectation(
                            ExpectationConfiguration(
                                expectation_type=expectation.expectation_type,
                                kwargs=expectation.kwargs,
                            ),
                            match_type="domain",
                            remove_multiple_matches=True,
                        )
                    except ValueError:
                        logger.debug(
                            f"Attempted to remove {expectation}, which was not found."
                        )

        expectation_suite = cls._build_column_description_metadata(dataset)

        return expectation_suite

    @classmethod
    def _demo_profile(cls, dataset):
        dataset.set_default_expectation_argument("catch_exceptions", False)
        dataset = cls._build_table_row_count_expectation(dataset)
        dataset.set_config_value("interactive_evaluation", True)
        dataset = cls._build_table_column_expectations(dataset)

        columns = dataset.get_table_columns()

        column_cache = {}
        profiled_columns = {"numeric": [], "low_card": [], "string": [], "datetime": []}

        column = cls._find_next_low_card_column(
            dataset, columns, profiled_columns, column_cache
        )
        if column:
            cls._create_expectations_for_low_card_column(dataset, column, column_cache)
            profiled_columns["low_card"].append(column)

        column = cls._find_next_numeric_column(
            dataset, columns, profiled_columns, column_cache
        )
        if column:
            cls._create_expectations_for_numeric_column(dataset, column)
            profiled_columns["numeric"].append(column)

        column = cls._find_next_string_column(
            dataset, columns, profiled_columns, column_cache
        )
        if column:
            cls._create_expectations_for_string_column(dataset, column)
            profiled_columns["string"].append(column)

        column = cls._find_next_datetime_column(
            dataset, columns, profiled_columns, column_cache
        )
        if column:
            cls._create_expectations_for_datetime_column(dataset, column)
            profiled_columns["datetime"].append(column)

        expectation_suite = cls._build_column_description_metadata(dataset)

        expectation_suite.meta["notes"] = {
            "format": "markdown",
            "content": [
                """#### This is an _example_ suite

- This suite was made by quickly glancing at 1000 rows of your data.
- This is **not a production suite**. It is meant to show examples of expectations.
- Because this suite was auto-generated using a very basic profiler that does not know your data like you do, many of the expectations may not be meaningful.
"""
            ],
        }

        return expectation_suite

    # TODO: MIGRATE TO CLASS-FIRST STRUCTURE
    # Question: do Domain and Success kwargs need to be passed here as well?
    @classmethod
    def _build_table_row_count_expectation(
        cls,
        dataset,
        tolerance=0.1,
        excluded_expectations=None,
        included_expectations=None,
    ):
        assert tolerance >= 0, "Tolerance must be greater than zero"
        if (
            not excluded_expectations
            or "expect_table_row_count_to_be_between" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_table_row_count_to_be_between" in included_expectations
        ):
            value = dataset.expect_table_row_count_to_be_between(
                min_value=0, max_value=None
            ).result["observed_value"]
            min_value = max(0, int(value * (1 - tolerance)))
            max_value = int(value * (1 + tolerance))
            dataset.expect_table_row_count_to_be_between(
                min_value=min_value, max_value=max_value
            )
        return dataset

    @classmethod
    def _build_table_column_expectations(
        cls, dataset, excluded_expectations=None, included_expectations=None
    ):
        columns = dataset.get_table_columns()
        if (
            not excluded_expectations
            or "expect_table_column_count_to_equal" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_table_column_count_to_equal" in included_expectations
        ):
            dataset.expect_table_column_count_to_equal(len(columns))
        if (
            not excluded_expectations
            or "expect_table_columns_to_match_ordered_list" not in excluded_expectations
        ) and (
            not included_expectations
            or "expect_table_columns_to_match_ordered_list" in included_expectations
        ):
            dataset.expect_table_columns_to_match_ordered_list(columns)
        return dataset

    @classmethod
    def _build_column_description_metadata(cls, dataset):
        columns = dataset.get_table_columns()
        expectation_suite = dataset.get_expectation_suite(
            suppress_warnings=True, discard_failed_expectations=False
        )

        meta_columns = {}
        for column in columns:
            meta_columns[column] = {"description": ""}
        if not expectation_suite.meta:
            expectation_suite.meta = {"columns": meta_columns, "notes": {""}}
        else:
            expectation_suite.meta["columns"] = meta_columns

        return expectation_suite


def _check_that_expectations_are_available(dataset, expectations):
    if expectations:
        for expectation in expectations:
            if expectation not in dataset.list_available_expectation_types():
                raise ProfilerError(f"Expectation {expectation} is not available.")


def _check_that_columns_exist(dataset, columns):
    if columns:
        for column in columns:
            if column not in dataset.get_table_columns():
                raise ProfilerError(f"Column {column} does not exist.")


def _is_nan(value):
    try:
        return np.isnan(value)
    except TypeError:
        return False
