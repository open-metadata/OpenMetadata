from typing import Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.types import RenderedStringTemplateContent
from ...render.util import (
    num_to_str,
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)
from ..expectation import ColumnPairMapExpectation, InvalidExpectationConfigurationError


class ExpectColumnPairValuesAToBeGreaterThanB(ColumnPairMapExpectation):
    """
    Expect values in column A to be greater than column B.

    Args:
        column_A (str): The first column name
        column_B (str): The second column name
        or_equal (boolean or None): If True, then values can be equal, not strictly greater

    Keyword Args:
        allow_cross_type_comparisons (boolean or None): If True, allow comparisons between types (e.g. integer and \
            string). Otherwise, attempting such comparisons will raise an exception.

    Keyword Args:
        ignore_row_if (str): "both_values_are_missing", "either_value_is_missing", "neither

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

    map_metric = "column_pair_values.a_greater_than_b"
    success_keys = (
        "column_A",
        "column_B",
        "ignore_row_if",
        "parse_strings_as_datetimes",
        "allow_cross_type_comparisons",
        "or_equal",
        "mostly",
    )

    default_kwarg_values = {
        "mostly": 1.0,
        "parse_strings_as_datetimes": False,
        "allow_cross_type_comparisons": None,
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
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True

    @classmethod
    @renderer(renderer_type="renderer.prescriptive")
    @render_evaluation_parameter_string
    def _prescriptive_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(
            configuration.kwargs,
            [
                "column_A",
                "column_B",
                "parse_strings_as_datetimes",
                "ignore_row_if",
                "mostly",
                "or_equal",
                "row_condition",
                "condition_parser",
            ],
        )

        if (params["column_A"] is None) or (params["column_B"] is None):
            template_str = "$column has a bogus `expect_column_pair_values_A_to_be_greater_than_B` expectation."
            params["row_condition"] = None

        if params["mostly"] is None:
            if params["or_equal"] in [None, False]:
                template_str = "Values in $column_A must always be greater than those in $column_B."
            else:
                template_str = "Values in $column_A must always be greater than or equal to those in $column_B."
        else:
            params["mostly_pct"] = num_to_str(
                params["mostly"] * 100, precision=15, no_scientific=True
            )
            # params["mostly_pct"] = "{:.14f}".format(params["mostly"]*100).rstrip("0").rstrip(".")
            if params["or_equal"] in [None, False]:
                template_str = "Values in $column_A must be greater than those in $column_B, at least $mostly_pct % of the time."
            else:
                template_str = "Values in $column_A must be greater than or equal to those in $column_B, at least $mostly_pct % of the time."

        if params.get("parse_strings_as_datetimes"):
            template_str += " Values should be parsed as datetimes."

        if params["row_condition"] is not None:
            (
                conditional_template_str,
                conditional_params,
            ) = parse_row_condition_string_pandas_engine(params["row_condition"])
            template_str = (
                conditional_template_str
                + ", then "
                + template_str[0].lower()
                + template_str[1:]
            )
            params.update(conditional_params)

        return [
            RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": template_str,
                        "params": params,
                        "styling": styling,
                    },
                }
            )
        ]
