import logging
import math

import numpy as np
from dateutil.parser import parse

from great_expectations.core import ExpectationSuite
from great_expectations.core.batch import Batch
from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.dataset import Dataset, PandasDataset
from great_expectations.exceptions import ProfilerError
from great_expectations.execution_engine import (
    PandasExecutionEngine,
    SparkDFExecutionEngine,
    SqlAlchemyExecutionEngine,
)
from great_expectations.expectations.metrics.util import attempt_allowing_relative_error
from great_expectations.profile.base import (
    OrderedProfilerCardinality,
    ProfilerTypeMapping,
    profiler_data_types_with_mapping,
    profiler_semantic_types,
)
from great_expectations.validator.validation_graph import MetricConfiguration
from great_expectations.validator.validator import Validator

logger = logging.getLogger(__name__)

from tqdm.auto import tqdm


class UserConfigurableProfiler:

    """
    The UserConfigurableProfiler is used to build an expectation suite from a dataset. The expectations built are
    strict - they can be used to determine whether two tables are the same.

    The profiler may be instantiated with or without a number of configuration arguments. Once a profiler is
    instantiated, if these arguments change, a new profiler will be needed.

    A profiler is used to build a suite without a config as follows:

    profiler = UserConfigurableProfiler(dataset)
    suite = profiler.build_suite()


    A profiler is used to build a suite with a semantic_types dict, as follows:

    semantic_types_dict = {
                "numeric": ["c_acctbal"],
                "string": ["c_address","c_custkey"],
                "value_set": ["c_nationkey","c_mktsegment", 'c_custkey', 'c_name', 'c_address', 'c_phone'],
            }

    profiler = UserConfigurableProfiler(dataset, semantic_types_dict=semantic_types_dict)
    suite = profiler.build_suite()
    """

    def __init__(
        self,
        profile_dataset,
        excluded_expectations: list = None,
        ignored_columns: list = None,
        not_null_only: bool = False,
        primary_or_compound_key: list = False,
        semantic_types_dict: dict = None,
        table_expectations_only: bool = False,
        value_set_threshold: str = "MANY",
    ):
        """
        The UserConfigurableProfiler is used to build an expectation suite from a dataset. The profiler may be
        instantiated with or without a config. The config may contain a semantic_types dict or not. Once a profiler is
        instantiated, if config items change, a new profiler will be needed.

        Write an entry on how to use the profiler for the GE docs site
                Args:
                    profile_dataset: A Great Expectations Dataset or Validator object
                    excluded_expectations: A list of expectations to not include in the suite
                    ignored_columns: A list of columns for which you would like to NOT create expectations
                    not_null_only: Boolean, default False. By default, each column is evaluated for nullity. If the column
                        values contain fewer than 50% null values, then the profiler will add
                        `expect_column_values_to_not_be_null`; if greater than 50% it will add
                        `expect_column_values_to_be_null`. If not_null_only is set to True, the profiler will add a
                        not_null expectation irrespective of the percent nullity (and therefore will not add an
                        `expect_column_values_to_be_null`
                    primary_or_compound_key: A list containing one or more columns which are a dataset's primary or
                        compound key. This will create an `expect_column_values_to_be_unique` or
                        `expect_compound_columns_to_be_unique` expectation. This will occur even if one or more of the
                        primary_or_compound_key columns are specified in ignored_columns
                    semantic_types_dict: A dictionary where the keys are available semantic_types (see profiler.base.profiler_semantic_types)
                        and the values are lists of columns for which you would like to create semantic_type specific
                        expectations e.g.:
                        "semantic_types": { "value_set": ["state","country"], "numeric":["age", "amount_due"]}
                    table_expectations_only: Boolean, default False. If True, this will only create the two table level expectations
                        available to this profiler (`expect_table_columns_to_match_ordered_list` and
                        `expect_table_row_count_to_be_between`). If a primary_or_compound key is specified, it will create
                        a uniqueness expectation for that column as well
                    value_set_threshold: Takes a string from the following ordered list - "none", "one", "two",
                        "very_few", "few", "many", "very_many", "unique". When the profiler runs without a semantic_types
                        dict, each column is profiled for cardinality. This threshold determines the greatest cardinality
                        for which to add `expect_column_values_to_be_in_set`. For example, if value_set_threshold is set to
                        "unique", it will add a value_set expectation for every included column. If set to "few", it will
                        add a value_set expectation for columns whose cardinality is one of "one", "two", "very_few" or
                        "few". The default value is "many". For the purposes of comparing whether two tables are identical,
                        it might make the most sense to set this to "unique"
        """
        self.column_info = {}
        self.profile_dataset = profile_dataset
        assert isinstance(self.profile_dataset, (Dataset, Validator, Batch))

        if isinstance(self.profile_dataset, Batch):
            self.profile_dataset = Validator(
                execution_engine=self.profile_dataset.data.execution_engine,
                batches=[self.profile_dataset],
            )
            self.all_table_columns = self.profile_dataset.get_metric(
                MetricConfiguration("table.columns", {})
            )
        elif isinstance(self.profile_dataset, Validator):
            self.all_table_columns = self.profile_dataset.get_metric(
                MetricConfiguration("table.columns", {})
            )
        else:
            self.all_table_columns = self.profile_dataset.get_table_columns()

        self.semantic_types_dict = semantic_types_dict
        assert isinstance(self.semantic_types_dict, (dict, type(None)))

        self.ignored_columns = ignored_columns or []
        assert isinstance(self.ignored_columns, list)

        self.excluded_expectations = excluded_expectations or []
        assert isinstance(self.excluded_expectations, list)

        assert isinstance(
            value_set_threshold, str
        ), "value_set_threshold must be a string"
        self.value_set_threshold = value_set_threshold.upper()
        assert (
            self.value_set_threshold in OrderedProfilerCardinality.__members__
        ), f"value_set_threshold must be one of {[i for i in OrderedProfilerCardinality.__members__]}"

        self.not_null_only = not_null_only
        assert isinstance(self.not_null_only, bool)

        self.table_expectations_only = table_expectations_only
        assert isinstance(self.table_expectations_only, bool)
        if self.table_expectations_only is True:
            logger.info(
                "table_expectations_only is set to True. When used to build a suite, this profiler will ignore all"
                "columns and create expectations only at the table level. If you would also like to create expectations "
                "at the column level, you can instantiate a new profiler with table_expectations_only set to False"
            )

        self.primary_or_compound_key = primary_or_compound_key or []
        assert isinstance(self.primary_or_compound_key, list)

        if self.table_expectations_only:
            self.ignored_columns = self.all_table_columns

        if self.primary_or_compound_key:
            for column in self.primary_or_compound_key:
                if column not in self.all_table_columns:
                    raise ValueError(
                        f"Column {column} not found. Please ensure that this column is in the {type(profile_dataset).__name__} "
                        f"if you would like to use it as a primary_or_compound_key."
                    )

        included_columns = [
            column_name
            for column_name in self.all_table_columns
            if column_name not in self.ignored_columns
        ]

        for column_name in included_columns:
            self._add_column_cardinality_to_column_info(
                self.profile_dataset, column_name
            )
            self._add_column_type_to_column_info(self.profile_dataset, column_name)

        if self.semantic_types_dict is not None:
            self._validate_semantic_types_dict(self.profile_dataset)
            for column_name in included_columns:
                self._add_semantic_types_by_column_from_config_to_column_info(
                    column_name
                )
        self.semantic_type_functions = {
            "DATETIME": self._build_expectations_datetime,
            "NUMERIC": self._build_expectations_numeric,
            "STRING": self._build_expectations_string,
            "VALUE_SET": self._build_expectations_value_set,
            "BOOLEAN": self._build_expectations_value_set,
        }

    def build_suite(self):
        """
        User-facing expectation-suite building function. Works with an instantiated UserConfigurableProfiler object.
        Args:

        Returns:
            An expectation suite built either with or without a semantic_types dict

        """
        if len(self.profile_dataset.get_expectation_suite().expectations) > 0:
            # noinspection PyProtectedMember
            suite_name = self.profile_dataset._expectation_suite.expectation_suite_name
            self.profile_dataset._expectation_suite = ExpectationSuite(suite_name)

        if self.semantic_types_dict:
            return self._build_expectation_suite_from_semantic_types_dict()

        return self._profile_and_build_expectation_suite()

    def _build_expectation_suite_from_semantic_types_dict(self):
        """
        Uses a semantic_type dict to determine which expectations to add to the suite, then builds the suite
        Args:

        Returns:
            An expectation suite built from a semantic_types dict
        """
        if not self.semantic_types_dict:
            raise ValueError(
                "A config with a semantic_types dict must be included in order to use this profiler."
            )
        self._build_expectations_table(self.profile_dataset)

        if self.value_set_threshold:
            logger.info(
                "Using this profiler with a semantic_types dict will ignore the value_set_threshold parameter. If "
                "you would like to include value_set expectations, you can include a 'value_set' entry in your "
                "semantic_types dict with any columns for which you would like a value_set expectation, or you can "
                "remove the semantic_types dict from the config."
            )

        if self.primary_or_compound_key:
            self._build_expectations_primary_or_compound_key(
                self.profile_dataset, self.primary_or_compound_key
            )

        with tqdm(
            desc="Profiling Columns", total=len(self.column_info), delay=5
        ) as pbar:
            for column_name, column_info in self.column_info.items():
                pbar.set_postfix_str(f"Column={column_name}")
                semantic_types = column_info.get("semantic_types")
                for semantic_type in semantic_types:
                    semantic_type_fn = self.semantic_type_functions.get(semantic_type)
                    semantic_type_fn(
                        profile_dataset=self.profile_dataset, column=column_name
                    )
                self._build_expectations_for_all_column_types(
                    self.profile_dataset, column_name
                )
                pbar.update()

        expectation_suite = self._build_column_description_metadata(
            self.profile_dataset
        )
        self._display_suite_by_column(suite=expectation_suite)
        return expectation_suite

    def _profile_and_build_expectation_suite(self):
        """
        Profiles the provided dataset to determine which expectations to add to the suite, then builds the suite
        Args:

        Returns:
            An expectation suite built after profiling the dataset
        """
        if self.primary_or_compound_key:
            self._build_expectations_primary_or_compound_key(
                profile_dataset=self.profile_dataset,
                column_list=self.primary_or_compound_key,
            )
        self._build_expectations_table(profile_dataset=self.profile_dataset)
        with tqdm(desc="Profiling", total=len(self.column_info), delay=5) as pbar:
            for column_name, column_info in self.column_info.items():
                pbar.set_postfix_str(f"Column={column_name}")
                data_type = column_info.get("type")
                cardinality = column_info.get("cardinality")

                if data_type in ("FLOAT", "INT", "NUMERIC"):
                    self._build_expectations_numeric(
                        profile_dataset=self.profile_dataset,
                        column=column_name,
                    )

                if data_type == "DATETIME":
                    self._build_expectations_datetime(
                        profile_dataset=self.profile_dataset,
                        column=column_name,
                    )

                if (
                    OrderedProfilerCardinality[self.value_set_threshold]
                    >= OrderedProfilerCardinality[cardinality]
                ):
                    self._build_expectations_value_set(
                        profile_dataset=self.profile_dataset, column=column_name
                    )

                self._build_expectations_for_all_column_types(
                    profile_dataset=self.profile_dataset, column=column_name
                )
                pbar.update()

        expectation_suite = self._build_column_description_metadata(
            self.profile_dataset
        )
        self._display_suite_by_column(
            suite=expectation_suite
        )  # include in the actual profiler
        return expectation_suite

    def _validate_semantic_types_dict(self, profile_dataset):
        """
        Validates a semantic_types dict to ensure correct formatting, that all semantic_types are recognized, and that
        the semantic_types align with the column data types
        Args:
            profile_dataset: A GE dataset
            config: A config dictionary

        Returns:
            The validated semantic_types dictionary

        """
        if not isinstance(self.semantic_types_dict, dict):
            raise ValueError(
                f"The semantic_types dict in the config must be a dictionary, but is currently a "
                f"{type(self.semantic_types_dict)}. Please reformat."
            )
        for k, v in self.semantic_types_dict.items():
            assert isinstance(v, list), (
                "Entries in semantic type dict must be lists of column names e.g. "
                "{'semantic_types': {'numeric': ['number_of_transactions']}}"
            )
            if k.upper() not in profiler_semantic_types:
                raise ValueError(
                    f"{k} is not a recognized semantic_type. Please only include one of "
                    f"{profiler_semantic_types}"
                )

        selected_columns = [
            column
            for column_list in self.semantic_types_dict.values()
            for column in column_list
        ]
        if selected_columns:
            for column in selected_columns:
                if column not in self.all_table_columns:
                    raise ProfilerError(f"Column {column} does not exist.")
                elif column in self.ignored_columns:
                    raise ValueError(
                        f"Column {column} is specified in both the semantic_types_dict and the list of "
                        f"ignored columns. Please remove one of these entries to proceed."
                    )

        for semantic_type, column_list in self.semantic_types_dict.items():
            for column_name in column_list:
                processed_column = self.column_info.get(column_name)
                if semantic_type == "datetime":
                    assert processed_column.get("type") in ("DATETIME", "STRING",), (
                        f"Column {column_name} must be a datetime column or a string but appears to be "
                        f"{processed_column.get('type')}"
                    )
                elif semantic_type == "numeric":
                    assert processed_column.get("type") in (
                        "INT",
                        "FLOAT",
                        "NUMERIC",
                    ), f"Column {column_name} must be an int or a float but appears to be {processed_column.get('type')}"
                elif semantic_type in ("STRING", "VALUE_SET"):
                    pass
        return self.semantic_types_dict

    def _add_column_type_to_column_info(self, profile_dataset, column_name):
        """
        Adds the data type of a column to the column_info dictionary on self
        Args:
            profile_dataset: A GE dataset
            column_name: The name of the column for which to retrieve the data type

        Returns:
            The type of the column
        """
        if "expect_column_values_to_be_in_type_list" in self.excluded_expectations:
            logger.info(
                "expect_column_values_to_be_in_type_list is in the excluded_expectations list. This"
                "expectation is required to establish column data, so it will be run and then removed from the"
                "expectation suite."
            )
        column_info_entry = self.column_info.get(column_name)
        if not column_info_entry:
            column_info_entry = {}
            self.column_info[column_name] = column_info_entry
        column_type = column_info_entry.get("type")
        if not column_type:
            column_type = self._get_column_type(profile_dataset, column_name)
            column_info_entry["type"] = column_type

        return column_type

    def _get_column_type(self, profile_dataset, column):
        """
        Determines the data type of a column by evaluating the success of `expect_column_values_to_be_in_type_list`.
        In the case of type Decimal, this data type is returned as NUMERIC, which contains the type lists for both INTs
        and FLOATs.

        The type_list expectation used here is removed, since it will need to be built once the build_suite function is
        actually called. This is because calling build_suite wipes any existing expectations, so expectations called
        during the init of the profiler do not persist.

        Args:
            profile_dataset: A GE dataset
            column: The column for which to get the data type

        Returns:
            The data type of the specified column
        """
        # list of types is used to support pandas and sqlalchemy
        type_ = None
        try:

            if (
                profile_dataset.expect_column_values_to_be_in_type_list(
                    column, type_list=sorted(list(ProfilerTypeMapping.INT_TYPE_NAMES))
                ).success
                and profile_dataset.expect_column_values_to_be_in_type_list(
                    column, type_list=sorted(list(ProfilerTypeMapping.FLOAT_TYPE_NAMES))
                ).success
            ):
                type_ = "NUMERIC"

            elif profile_dataset.expect_column_values_to_be_in_type_list(
                column, type_list=sorted(list(ProfilerTypeMapping.INT_TYPE_NAMES))
            ).success:
                type_ = "INT"

            elif profile_dataset.expect_column_values_to_be_in_type_list(
                column, type_list=sorted(list(ProfilerTypeMapping.FLOAT_TYPE_NAMES))
            ).success:
                type_ = "FLOAT"

            elif profile_dataset.expect_column_values_to_be_in_type_list(
                column, type_list=sorted(list(ProfilerTypeMapping.STRING_TYPE_NAMES))
            ).success:
                type_ = "STRING"

            elif profile_dataset.expect_column_values_to_be_in_type_list(
                column, type_list=sorted(list(ProfilerTypeMapping.BOOLEAN_TYPE_NAMES))
            ).success:
                type_ = "BOOLEAN"

            elif profile_dataset.expect_column_values_to_be_in_type_list(
                column, type_list=sorted(list(ProfilerTypeMapping.DATETIME_TYPE_NAMES))
            ).success:
                type_ = "DATETIME"

            else:
                type_ = "UNKNOWN"
        except NotImplementedError:
            type_ = "unknown"

        if type_ == "NUMERIC":
            profile_dataset.expect_column_values_to_be_in_type_list(
                column,
                type_list=sorted(list(ProfilerTypeMapping.INT_TYPE_NAMES))
                + sorted(list(ProfilerTypeMapping.FLOAT_TYPE_NAMES)),
            )

        profile_dataset._expectation_suite.remove_expectation(
            ExpectationConfiguration(
                expectation_type="expect_column_values_to_be_in_type_list",
                kwargs={"column": column},
            )
        )
        return type_

    def _add_column_cardinality_to_column_info(self, profile_dataset, column_name):
        """
        Adds the cardinality of a column to the column_info dictionary on self
        Args:
            profile_dataset: A GE Dataset
            column_name: The name of the column for which to add cardinality

        Returns:
            The cardinality of the column
        """
        column_info_entry = self.column_info.get(column_name)
        if not column_info_entry:
            column_info_entry = {}
            self.column_info[column_name] = column_info_entry
        column_cardinality = column_info_entry.get("cardinality")
        if not column_cardinality:
            column_cardinality = self._get_column_cardinality(
                profile_dataset, column_name
            )
            column_info_entry["cardinality"] = column_cardinality
            # remove the expectations
            profile_dataset._expectation_suite.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_unique_value_count_to_be_between",
                    kwargs={"column": column_name},
                )
            )
            profile_dataset._expectation_suite.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_proportion_of_unique_values_to_be_between",
                    kwargs={"column": column_name},
                )
            )

        return column_cardinality

    def _get_column_cardinality(self, profile_dataset, column):
        """
        Determines the cardinality of a column using the get_basic_column_cardinality method from
        OrderedProfilerCardinality
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to get cardinality

        Returns:
            The cardinality of the specified column
        """
        num_unique = None
        pct_unique = None

        try:
            num_unique = profile_dataset.expect_column_unique_value_count_to_be_between(
                column, None, None
            ).result["observed_value"]
            pct_unique = (
                profile_dataset.expect_column_proportion_of_unique_values_to_be_between(
                    column, None, None
                ).result["observed_value"]
            )
        except KeyError:  # if observed_value value is not set
            logger.error(
                "Failed to get cardinality of column {:s} - continuing...".format(
                    column
                )
            )
        # Previously, if we had 25 possible categories out of 1000 rows, this would comes up as many, because of its
        #  percentage, so it was tweaked here, but is still experimental.
        cardinality = OrderedProfilerCardinality.get_basic_column_cardinality(
            num_unique, pct_unique
        )

        return cardinality.name

    def _add_semantic_types_by_column_from_config_to_column_info(self, column_name):
        """
        Adds the semantic type of a column to the column_info dict on self, for display purposes after suite creation
        Args:
            column_name: The name of the column

        Returns:
            A list of semantic_types for a given column
        """
        column_info_entry = self.column_info.get(column_name)
        if not column_info_entry:
            column_info_entry = {}
            self.column_info[column_name] = column_info_entry

        semantic_types = column_info_entry.get("semantic_types")

        if not semantic_types:
            assert isinstance(
                self.semantic_types_dict, dict
            ), f"The semantic_types dict in the config must be a dictionary, but is currently a {type(self.semantic_types_dict)}. Please reformat."
            semantic_types = []
            for semantic_type, column_list in self.semantic_types_dict.items():
                if column_name in column_list:
                    semantic_types.append(semantic_type.upper())
            column_info_entry["semantic_types"] = semantic_types
            if all(
                i in column_info_entry.get("semantic_types")
                for i in ["BOOLEAN", "VALUE_SET"]
            ):
                logger.info(
                    f"Column {column_name} has both 'BOOLEAN' and 'VALUE_SET' specified as semantic_types."
                    f"As these are currently the same in function, the 'VALUE_SET' type will be removed."
                )
                column_info_entry["semantic_types"].remove("VALUE_SET")

        self.column_info[column_name] = column_info_entry

        return semantic_types

    def _build_column_description_metadata(self, profile_dataset):
        """
        Adds column description metadata to the suite on a Dataset object
        Args:
            profile_dataset: A GE Dataset

        Returns:
            An expectation suite with column description metadata
        """
        columns = self.all_table_columns
        expectation_suite = profile_dataset.get_expectation_suite(
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

    def _display_suite_by_column(self, suite):
        """
        Displays the expectations of a suite by column, along with the column cardinality, and semantic or data type so
        that a user can easily see which expectations were created for which columns
        Args:
            suite: An ExpectationSuite

        Returns:
            The ExpectationSuite
        """
        expectations = suite.expectations
        expectations_by_column = {}
        for expectation in expectations:
            domain = expectation["kwargs"].get("column") or "table_level_expectations"
            if expectations_by_column.get(domain) is None:
                expectations_by_column[domain] = [expectation]
            else:
                expectations_by_column[domain].append(expectation)

        if not expectations_by_column:
            print("No expectations included in suite.")
        else:
            print("Creating an expectation suite with the following expectations:\n")

        if "table_level_expectations" in expectations_by_column:
            table_level_expectations = expectations_by_column.pop(
                "table_level_expectations"
            )
            print("Table-Level Expectations")
            for expectation in sorted(
                table_level_expectations, key=lambda x: x.expectation_type
            ):
                print(expectation.expectation_type)

        if expectations_by_column:
            print("\nExpectations by Column")

        contains_semantic_types = [
            v for v in self.column_info.values() if v.get("semantic_types")
        ]
        for column in sorted(expectations_by_column):
            info_column = self.column_info.get(column) or {}

            semantic_types = info_column.get("semantic_types") or "not_specified"
            type_ = info_column.get("type")
            cardinality = info_column.get("cardinality")

            if len(contains_semantic_types) > 0:
                type_string = f" | Semantic Type: {semantic_types[0] if len(semantic_types)==1 else semantic_types}"
            elif type_:
                type_string = f" | Column Data Type: {type_}"
            else:
                type_string = ""

            if cardinality:
                cardinality_string = f" | Cardinality: {cardinality}"
            else:
                cardinality_string = ""

            column_string = (
                f"Column Name: {column}{type_string or ''}{cardinality_string or ''}"
            )
            print(column_string)

            for expectation in sorted(
                expectations_by_column.get(column), key=lambda x: x.expectation_type
            ):
                print(expectation.expectation_type)
            print("\n")

        return True

    def _build_expectations_value_set(self, profile_dataset, column, **kwargs):
        """
        Adds a value_set expectation for a given column
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to add an expectation
            **kwargs:

        Returns:
            The GE Dataset
        """
        if "expect_column_values_to_be_in_set" not in self.excluded_expectations:
            value_set = profile_dataset.expect_column_distinct_values_to_be_in_set(
                column, value_set=None, result_format="SUMMARY"
            ).result["observed_value"]

            profile_dataset._expectation_suite.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_distinct_values_to_be_in_set",
                    kwargs={"column": column},
                ),
                match_type="domain",
            )

            profile_dataset.expect_column_values_to_be_in_set(
                column, value_set=value_set
            )
        return profile_dataset

    def _build_expectations_numeric(self, profile_dataset, column, **kwargs):
        """
        Adds a set of numeric expectations for a given column
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to add expectations
            **kwargs:

        Returns:
            The GE Dataset
        """

        # min
        if "expect_column_min_to_be_between" not in self.excluded_expectations:
            observed_min = profile_dataset.expect_column_min_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not self._is_nan(observed_min):

                profile_dataset.expect_column_min_to_be_between(
                    column,
                    min_value=observed_min,
                    max_value=observed_min,
                )

            else:
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_min_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                logger.debug(
                    f"Skipping expect_column_min_to_be_between because observed value is nan: {observed_min}"
                )

        # max
        if "expect_column_max_to_be_between" not in self.excluded_expectations:
            observed_max = profile_dataset.expect_column_max_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not self._is_nan(observed_max):
                profile_dataset.expect_column_max_to_be_between(
                    column,
                    min_value=observed_max,
                    max_value=observed_max,
                )

            else:
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_max_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                logger.debug(
                    f"Skipping expect_column_max_to_be_between because observed value is nan: {observed_max}"
                )

        # mean
        if "expect_column_mean_to_be_between" not in self.excluded_expectations:
            observed_mean = profile_dataset.expect_column_mean_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not self._is_nan(observed_mean):
                profile_dataset.expect_column_mean_to_be_between(
                    column,
                    min_value=observed_mean,
                    max_value=observed_mean,
                )

            else:
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_mean_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                logger.debug(
                    f"Skipping expect_column_mean_to_be_between because observed value is nan: {observed_mean}"
                )

        # median
        if "expect_column_median_to_be_between" not in self.excluded_expectations:
            observed_median = profile_dataset.expect_column_median_to_be_between(
                column, min_value=None, max_value=None, result_format="SUMMARY"
            ).result["observed_value"]
            if not self._is_nan(observed_median):

                profile_dataset.expect_column_median_to_be_between(
                    column,
                    min_value=observed_median,
                    max_value=observed_median,
                )

            else:
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_median_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                logger.debug(
                    f"Skipping expect_column_median_to_be_between because observed value is nan: {observed_median}"
                )

        if (
            "expect_column_quantile_values_to_be_between"
            not in self.excluded_expectations
        ):
            if isinstance(profile_dataset, Dataset):
                if isinstance(profile_dataset, PandasDataset):
                    allow_relative_error = "lower"
                else:
                    allow_relative_error = (
                        profile_dataset.attempt_allowing_relative_error()
                    )
            elif isinstance(profile_dataset, Validator):
                if isinstance(profile_dataset.execution_engine, PandasExecutionEngine):
                    allow_relative_error = "lower"
                if isinstance(profile_dataset.execution_engine, SparkDFExecutionEngine):
                    allow_relative_error = 0.0
                if isinstance(
                    profile_dataset.execution_engine, SqlAlchemyExecutionEngine
                ):
                    allow_relative_error = attempt_allowing_relative_error(
                        profile_dataset.execution_engine.engine.dialect
                    )

            quantile_result = profile_dataset.expect_column_quantile_values_to_be_between(
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
                # TODO: <Alex>ALEX -- Tal, could you please fix the issue in the next line?</Alex>
                allow_relative_error=allow_relative_error,
                result_format="SUMMARY",
            )
            if quantile_result.exception_info and (
                quantile_result.exception_info["exception_traceback"]
                or quantile_result.exception_info["exception_message"]
            ):
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_quantile_values_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )
                logger.debug(quantile_result.exception_info["exception_traceback"])
                logger.debug(quantile_result.exception_info["exception_message"])
            else:

                profile_dataset.expect_column_quantile_values_to_be_between(
                    column,
                    quantile_ranges={
                        "quantiles": quantile_result.result["observed_value"][
                            "quantiles"
                        ],
                        "value_ranges": [
                            [v, v]
                            for v in quantile_result.result["observed_value"]["values"]
                        ],
                    },
                    allow_relative_error=allow_relative_error,
                )
        return profile_dataset

    def _build_expectations_primary_or_compound_key(
        self, profile_dataset, column_list, **kwargs
    ):
        """
        Adds a uniqueness expectation for a given column or set of columns
        Args:
            profile_dataset: A GE Dataset
            column_list: A list containing one or more columns for which to add a uniqueness expectation
            **kwargs:

        Returns:
            The GE Dataset
        """
        # uniqueness
        if (
            len(column_list) > 1
            and "expect_compound_columns_to_be_unique" not in self.excluded_expectations
        ):
            profile_dataset.expect_compound_columns_to_be_unique(column_list)
        elif len(column_list) < 1:
            raise ValueError(
                "When specifying a primary or compound key, column_list must not be empty"
            )
        else:
            [column] = column_list
            if "expect_column_values_to_be_unique" not in self.excluded_expectations:
                profile_dataset.expect_column_values_to_be_unique(column)
        return profile_dataset

    def _build_expectations_string(self, profile_dataset, column, **kwargs):
        """
        Adds a set of string expectations for a given column. Currently does not do anything.
        With the 0.12 API there isn't a quick way to introspect for value_lengths - if we did that, we could build a
        potentially useful value_lengths expectation here.
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to add expectations
            **kwargs:

        Returns:
            The GE Dataset
        """

        if (
            "expect_column_value_lengths_to_be_between"
            not in self.excluded_expectations
        ):

            pass
        return profile_dataset

    def _build_expectations_datetime(self, profile_dataset, column, **kwargs):
        """
        Adds `expect_column_values_to_be_between` for a given column
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to add the expectation
            **kwargs:

        Returns:
            The GE Dataset
        """

        if "expect_column_values_to_be_between" not in self.excluded_expectations:
            min_value = profile_dataset.expect_column_min_to_be_between(
                column,
                min_value=None,
                max_value=None,
                result_format="SUMMARY",
                parse_strings_as_datetimes=True,
            ).result["observed_value"]

            if min_value is not None:
                try:
                    min_value = parse(min_value)
                except TypeError:
                    pass

            profile_dataset._expectation_suite.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_min_to_be_between",
                    kwargs={"column": column},
                ),
                match_type="domain",
            )

            max_value = profile_dataset.expect_column_max_to_be_between(
                column,
                min_value=None,
                max_value=None,
                result_format="SUMMARY",
                parse_strings_as_datetimes=True,
            ).result["observed_value"]
            if max_value is not None:
                try:
                    max_value = parse(max_value)
                except TypeError:
                    pass

            profile_dataset._expectation_suite.remove_expectation(
                ExpectationConfiguration(
                    expectation_type="expect_column_max_to_be_between",
                    kwargs={"column": column},
                ),
                match_type="domain",
            )
            if min_value is not None or max_value is not None:
                profile_dataset.expect_column_values_to_be_between(
                    column,
                    min_value=min_value,
                    max_value=max_value,
                    parse_strings_as_datetimes=True,
                )
        return profile_dataset

    def _build_expectations_for_all_column_types(
        self, profile_dataset, column, **kwargs
    ):
        """
        Adds these expectations for all included columns irrespective of type. Includes:
            - `expect_column_values_to_not_be_null` (or `expect_column_values_to_be_null`)
            - `expect_column_proportion_of_unique_values_to_be_between`
            - `expect_column_values_to_be_in_type_list`
        Args:
            profile_dataset: A GE Dataset
            column: The column for which to add the expectations
            **kwargs:

        Returns:
            The GE Dataset
        """
        if "expect_column_values_to_not_be_null" not in self.excluded_expectations:
            not_null_result = profile_dataset.expect_column_values_to_not_be_null(
                column
            )
            if not not_null_result.success:
                unexpected_percent = float(not_null_result.result["unexpected_percent"])
                if unexpected_percent >= 50 and not self.not_null_only:
                    potential_mostly_value = math.floor(unexpected_percent) / 100.0
                    # A safe_mostly_value of 0.001 gives us a rough way of ensuring that we don't wind up with a mostly
                    # value of 0 when we round
                    safe_mostly_value = max(0.001, potential_mostly_value)
                    profile_dataset._expectation_suite.remove_expectation(
                        ExpectationConfiguration(
                            expectation_type="expect_column_values_to_not_be_null",
                            kwargs={"column": column},
                        ),
                        match_type="domain",
                    )
                    if (
                        "expect_column_values_to_be_null"
                        not in self.excluded_expectations
                    ):
                        profile_dataset.expect_column_values_to_be_null(
                            column, mostly=safe_mostly_value
                        )
                else:
                    potential_mostly_value = (
                        100.0 - math.ceil(unexpected_percent)
                    ) / 100.0

                    # A safe_mostly_value of 0.001 gives us a rough way of ensuring that we don't wind up with a mostly
                    # value of 0 when we round
                    safe_mostly_value = max(0.001, potential_mostly_value)
                    profile_dataset.expect_column_values_to_not_be_null(
                        column, mostly=safe_mostly_value
                    )
        if (
            "expect_column_proportion_of_unique_values_to_be_between"
            not in self.excluded_expectations
        ):
            pct_unique = (
                profile_dataset.expect_column_proportion_of_unique_values_to_be_between(
                    column, None, None
                ).result["observed_value"]
            )

            if not self._is_nan(pct_unique):
                profile_dataset.expect_column_proportion_of_unique_values_to_be_between(
                    column, min_value=pct_unique, max_value=pct_unique
                )
            else:
                # noinspection PyProtectedMember
                profile_dataset._expectation_suite.remove_expectation(
                    ExpectationConfiguration(
                        expectation_type="expect_column_proportion_of_unique_values_to_be_between",
                        kwargs={"column": column},
                    ),
                    match_type="domain",
                )

                logger.debug(
                    f"Skipping expect_column_proportion_of_unique_values_to_be_between because observed value is nan: {pct_unique}"
                )

        if "expect_column_values_to_be_in_type_list" not in self.excluded_expectations:
            col_type = self.column_info.get(column).get("type")
            if col_type != "UNKNOWN":
                type_list = profiler_data_types_with_mapping.get(col_type)
                profile_dataset.expect_column_values_to_be_in_type_list(
                    column, type_list=type_list
                )
            else:
                logger.info(
                    f"Column type for column {column} is unknown. "
                    f"Skipping expect_column_values_to_be_in_type_list for this column."
                )

    def _build_expectations_table(self, profile_dataset, **kwargs):
        """
        Adds two table level expectations to the dataset
        Args:
            profile_dataset: A GE Dataset
            **kwargs:

        Returns:
            The GE Dataset
        """

        if (
            "expect_table_columns_to_match_ordered_list"
            not in self.excluded_expectations
        ):
            columns = self.all_table_columns
            profile_dataset.expect_table_columns_to_match_ordered_list(columns)

        if "expect_table_row_count_to_be_between" not in self.excluded_expectations:
            row_count = profile_dataset.expect_table_row_count_to_be_between(
                min_value=0, max_value=None
            ).result["observed_value"]
            min_value = max(0, int(row_count))
            max_value = int(row_count)

            profile_dataset.expect_table_row_count_to_be_between(
                min_value=min_value, max_value=max_value
            )

    def _is_nan(self, value):
        """
        If value is an array, test element-wise for NaN and return result as a boolean array.
        If value is a scalar, return boolean.
        Args:
            value: The value to test

        Returns:
            The results of the test
        """
        try:
            return np.isnan(value)
        except TypeError:
            return True
