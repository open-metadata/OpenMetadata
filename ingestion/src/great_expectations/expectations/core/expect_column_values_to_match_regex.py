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
from ..expectation import ColumnMapExpectation, InvalidExpectationConfigurationError


class ExpectColumnValuesToMatchRegex(ColumnMapExpectation):
    """Expect column entries to be strings that match a given regular expression.

    Valid matches can be found \
    anywhere in the string, for example "[at]+" will identify the following strings as expected: "cat", "hat", \
    "aa", "a", and "t", and the following strings as unexpected: "fish", "dog".

    expect_column_values_to_match_regex is a \
    :func:`column_map_expectation <great_expectations.execution_engine.execution_engine.MetaExecutionEngine
    .column_map_expectation>`.

    Args:
        column (str): \
            The column name.
        regex (str): \
            The regular expression the column entries should match.

    Keyword Args:
        mostly (None or a float between 0 and 1): \
            Return `"success": True` if at least mostly fraction of values match the expectation. \
            For more detail, see :ref:`mostly`.

    Other Parameters:
        result_format (str or None): \
            Which output mode to use: `BOOLEAN_ONLY`, `BASIC`, `COMPLETE`, or `SUMMARY`.
            For more detail, see :ref:`result_format <result_format>`.
        include_config (boolean): \
            If True, then include the expectation config as part of the result object. \
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

    See Also:
        :func:`expect_column_values_to_not_match_regex \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine
        .expect_column_values_to_not_match_regex>`

        :func:`expect_column_values_to_match_regex_list \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine
        .expect_column_values_to_match_regex_list>`

    """

    library_metadata = {
        "maturity": "production",
        "package": "great_expectations",
        "tags": ["core expectation", "column map expectation"],
        "contributors": [
            "@great_expectations",
        ],
        "requirements": [],
    }

    map_metric = "column_values.match_regex"
    success_keys = (
        "regex",
        "mostly",
    )

    default_kwarg_values = {
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "mostly": 1,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": True,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        if configuration is None:
            configuration = self.configuration
        try:
            assert "regex" in configuration.kwargs, "regex is required"
            assert isinstance(
                configuration.kwargs["regex"], (str, dict)
            ), "regex must be a string"
            if isinstance(configuration.kwargs["regex"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["regex"]
                ), 'Evaluation Parameter dict for regex kwarg must have "$PARAMETER" key.'
        except AssertionError as e:
            raise InvalidExpectationConfigurationError(str(e))
        return True

    @classmethod
    @renderer(renderer_type="renderer.question")
    def _question_renderer(
        cls, configuration, result=None, language=None, runtime_configuration=None
    ):
        column = configuration.kwargs.get("column")
        mostly = configuration.kwargs.get("mostly")
        regex = configuration.kwargs.get("regex")

        return f'Do at least {mostly * 100}% of values in column "{column}" match the regular expression {regex}?'

    @classmethod
    @renderer(renderer_type="renderer.answer")
    def _answer_renderer(
        cls, configuration=None, result=None, language=None, runtime_configuration=None
    ):
        column = result.expectation_config.kwargs.get("column")
        mostly = result.expectation_config.kwargs.get("mostly")
        regex = result.expectation_config.kwargs.get("regex")
        if result.success:
            return f'At least {mostly * 100}% of values in column "{column}" match the regular expression {regex}.'
        else:
            return f'Less than {mostly * 100}% of values in column "{column}" match the regular expression {regex}.'

    @classmethod
    @renderer(renderer_type="renderer.prescriptive")
    @render_evaluation_parameter_string
    def _prescriptive_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs,
    ):
        runtime_configuration = runtime_configuration or {}
        include_column_name = runtime_configuration.get("include_column_name", True)
        include_column_name = (
            include_column_name if include_column_name is not None else True
        )
        styling = runtime_configuration.get("styling")
        params = substitute_none_for_missing(
            configuration.kwargs,
            ["column", "regex", "mostly", "row_condition", "condition_parser"],
        )

        if not params.get("regex"):
            template_str = (
                "values must match a regular expression but none was specified."
            )
        else:
            template_str = "values must match this regular expression: $regex"
            if params["mostly"] is not None:
                params["mostly_pct"] = num_to_str(
                    params["mostly"] * 100, precision=15, no_scientific=True
                )
                # params["mostly_pct"] = "{:.14f}".format(params["mostly"]*100).rstrip("0").rstrip(".")
                template_str += ", at least $mostly_pct % of the time."
            else:
                template_str += "."

        if include_column_name:
            template_str = "$column " + template_str

        if params["row_condition"] is not None:
            (
                conditional_template_str,
                conditional_params,
            ) = parse_row_condition_string_pandas_engine(params["row_condition"])
            template_str = conditional_template_str + ", then " + template_str
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

    examples = [
        {
            "data": {
                "a": ["aaa", "abb", "acc", "add", "bee"],
                "b": ["aaa", "abb", "acc", "bdd", None],
                "column_name with space": ["aaa", "abb", "acc", "add", "bee"],
            },
            "tests": [
                {
                    "title": "negative_test_insufficient_mostly_and_one_non_matching_value",
                    "exact_match_out": False,
                    "in": {"column": "a", "regex": "^a", "mostly": 0.9},
                    "out": {
                        "success": False,
                        "unexpected_index_list": [4],
                        "unexpected_list": ["bee"],
                    },
                    "include_in_gallery": True,
                    "suppress_test_for": ["sqlite", "mssql"],
                },
                {
                    "title": "positive_test_exact_mostly_w_one_non_matching_value",
                    "exact_match_out": False,
                    "in": {"column": "a", "regex": "^a", "mostly": 0.8},
                    "out": {
                        "success": True,
                        "unexpected_index_list": [4],
                        "unexpected_list": ["bee"],
                    },
                    "include_in_gallery": True,
                    "suppress_test_for": ["sqlite", "mssql"],
                },
            ],
        }
    ]
