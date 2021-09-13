from typing import Dict, List, Optional, Union

from great_expectations.core.expectation_configuration import ExpectationConfiguration

from ..expectation import ColumnMapExpectation, InvalidExpectationConfigurationError
from ..metrics import ColumnValuesZScore


class ExpectColumnValueZScoresToBeLessThan(ColumnMapExpectation):
    """
    Expect the Z-scores of a columns values to be less than a given threshold

            expect_column_values_to_be_of_type is a :func:`column_map_expectation \
            <great_expectations.execution_engine.execution_engine.MetaExecutionEngine.column_map_expectation>` for
            typed-column backends,
            and also for PandasExecutionEngine where the column dtype and provided type_ are unambiguous constraints
            (any dtype except 'object' or dtype of 'object' with type_ specified as 'object').

            Parameters:
                column (str): \
                    The column name of a numerical column.
                threshold (number): \
                    A maximum Z-score threshold. All column Z-scores that are lower than this threshold will evaluate
                    successfully.


            Keyword Args:
                mostly (None or a float between 0 and 1): \
                    Return `"success": True` if at least mostly fraction of values match the expectation. \
                    For more detail, see :ref:`mostly`.
                double_sided (boolean): \
                    A True of False value indicating whether to evaluate double sidedly.
                    Example:
                    double_sided = True, threshold = 2 -> Z scores in non-inclusive interval(-2,2)
                    double_sided = False, threshold = 2 -> Z scores in non-inclusive interval (-infinity,2)


            Other Parameters:
                result_format (str or None): \
                    Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`.
                    For more detail, see :ref:`result_format <result_format>`.
                include_config (boolean): \
                    If True, then include the Expectation config as part of the result object. \
                    For more detail, see :ref:`include_config`.
                catch_exceptions (boolean or None): \
                    If True, then catch exceptions and include them as part of the result object. \
                    For more detail, see :ref:`catch_exceptions`.
                meta (dict or None): \
                    A JSON-serializable dictionary (nesting allowed) that will be included in the output without \
                    modification. For more detail, see :ref:`meta`.

            Returns:
                An ExpectationSuiteValidationResult

                Exact fields vary depending on the values passed to :ref:`result_format <result_format>` and
                :ref:`include_config`, :ref:`catch_exceptions`, and :ref:`meta`.
    """

    # This dictionary contains metadata for display in the public gallery
    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column map expectation"],
        "contributors": ["@great_expectations"],
        "requirements": [],
    }

    # Setting necessary computation metric dependencies and defining kwargs, as well as assigning kwargs default values\
    map_metric = "column_values.z_score.under_threshold"
    success_keys = ("threshold", "double_sided", "mostly")

    # Default values
    default_kwarg_values = {
        "row_condition": None,
        "condition_parser": None,
        "threshold": None,
        "double_sided": True,
        "mostly": 1,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": False,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        """
        Validates that a configuration has been set, and sets a configuration if it has yet to be set. Ensures that
        necessary configuration arguments have been provided for the validation of the expectation.

        Args:
            configuration (OPTIONAL[ExpectationConfiguration]): \
                An optional Expectation Configuration entry that will be used to configure the expectation
        Returns:
            True if the configuration has been validated successfully. Otherwise, raises an exception
        """

        # Setting up a configuration
        super().validate_configuration(configuration)
        if configuration is None:
            configuration = self.configuration
        try:
            # Ensuring Z-score Threshold metric has been properly provided
            assert (
                "threshold" in configuration.kwargs
            ), "A Z-score threshold must be provided"
            assert isinstance(
                configuration.kwargs["threshold"], (float, int, dict)
            ), "Provided threshold must be a number"
            if isinstance(configuration.kwargs["threshold"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["threshold"]
                ), 'Evaluation Parameter dict for threshold kwarg must have "$PARAMETER" key.'

            assert isinstance(
                configuration.kwargs["double_sided"], (bool, dict)
            ), "Double sided parameter must be a boolean value"
            if isinstance(configuration.kwargs["double_sided"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["double_sided"]
                ), 'Evaluation Parameter dict for double_sided kwarg must have "$PARAMETER" key.'
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True
