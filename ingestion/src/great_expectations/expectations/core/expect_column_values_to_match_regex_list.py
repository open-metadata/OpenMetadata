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


class ExpectColumnValuesToMatchRegexList(ColumnMapExpectation):
    """Expect the column entries to be strings that can be matched to either any of or all of a list of regular
    expressions. Matches can be anywhere in the string.

    expect_column_values_to_match_regex_list is a \
    :func:`column_map_expectation <great_expectations.execution_engine.execution_engine.MetaExecutionEngine
    .column_map_expectation>`.

    Args:
        column (str): \
            The column name.
        regex_list (list): \
            The list of regular expressions which the column entries should match

    Keyword Args:
        match_on= (string): \
            "any" or "all".
            Use "any" if the value should match at least one regular expression in the list.
            Use "all" if it should match each regular expression in the list.
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
        :func:`expect_column_values_to_match_regex \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_values_to_match_regex>`

        :func:`expect_column_values_to_not_match_regex \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine
        .expect_column_values_to_not_match_regex>`

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

    map_metric = "column_values.match_regex_list"
    success_keys = (
        "regex_list",
        "match_on",
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
            assert "regex_list" in configuration.kwargs, "regex_list is required"
            assert isinstance(
                configuration.kwargs["regex_list"], (list, dict)
            ), "regex_list must be a list of regexes"
            if (
                not isinstance(configuration.kwargs["regex_list"], dict)
                and len(configuration.kwargs["regex_list"]) > 0
            ):
                for i in configuration.kwargs["regex_list"]:
                    assert isinstance(i, str), "regexes in list must be strings"
            if isinstance(configuration.kwargs["regex_list"], dict):
                assert (
                    "$PARAMETER" in configuration.kwargs["regex_list"]
                ), 'Evaluation Parameter dict for regex_list kwarg must have "$PARAMETER" key.'
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
                "column",
                "regex_list",
                "mostly",
                "match_on",
                "row_condition",
                "condition_parser",
            ],
        )

        if not params.get("regex_list") or len(params.get("regex_list")) == 0:
            values_string = "[ ]"
        else:
            for i, v in enumerate(params["regex_list"]):
                params["v__" + str(i)] = v
            values_string = " ".join(
                ["$v__" + str(i) for i, v in enumerate(params["regex_list"])]
            )

        if params.get("match_on") == "all":
            template_str = (
                "values must match all of the following regular expressions: "
                + values_string
            )
        else:
            template_str = (
                "values must match any of the following regular expressions: "
                + values_string
            )

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
