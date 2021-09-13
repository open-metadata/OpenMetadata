from typing import Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration

from ..expectation import ColumnPairMapExpectation, InvalidExpectationConfigurationError


class ExpectColumnPairValuesToBeInSet(ColumnPairMapExpectation):
    """
    Expect paired values from columns A and B to belong to a set of valid pairs.

    Args:
        column_A (str): The first column name
        column_B (str): The second column name
        value_pairs_set (list of tuples): All the valid pairs to be matched

    Keyword Args:
        ignore_row_if (str): "both_values_are_missing", "either_value_is_missing", "neither"

    Other Parameters:
        result_format (str or None): \
            Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`.
        include_config (boolean): \
            If True, then include the expectation config as part of the result object. \
        catch_exceptions (boolean or None): \
            If True, then catch exceptions and include them as part of the result object. \
        meta (dict or None): \
            A JSON-serializable dictionary (nesting allowed) that will be included in the output without modification.

    Returns:
        An ExpectationSuiteValidationResult
    """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": [
            "core expectation",
            "multi-column expectation",
            "needs migration to modular expectations api",
        ],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    map_metric = "column_pair_values.in_set"
    success_keys = ("value_pairs_set", "ignore_row_if", "mostly")

    default_kwarg_values = {
        "mostly": 1.0,
        "ignore_row_if": "both_values_are_missing",
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        if configuration is None:
            configuration = self.configuration
        try:
            assert (
                "column_A" in configuration.kwargs
                and "column_B" in configuration.kwargs
            ), "both columns must be provided"
            assert (
                "value_pairs_set" in configuration.kwargs
            ), "must provide value_pairs_set"
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True
