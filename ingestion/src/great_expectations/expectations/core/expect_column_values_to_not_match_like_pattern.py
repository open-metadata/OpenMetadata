from typing import Optional

from great_expectations.core.expectation_configuration import ExpectationConfiguration
from great_expectations.expectations.util import render_evaluation_parameter_string

from ...render.renderer.renderer import renderer
from ...render.util import substitute_none_for_missing
from ..expectation import ColumnMapExpectation, InvalidExpectationConfigurationError


class ExpectColumnValuesToNotMatchLikePattern(ColumnMapExpectation):
    """Expect column entries to be strings that do NOT match a given like pattern expression.

    expect_column_values_to_not_match_like_pattern_list is a \
    :func:`column_map_expectation <great_expectations.execution_engine.execution_engine.MetaExecutionEngine
    .column_map_expectation>`.

    Args:
        column (str): \
            The column name.
        like_pattern (str): \
            The like pattern expression the column entries should NOT match.

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
        :func:`expect_column_values_to_match_regex \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_values_to_match_regex>`

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

    map_metric = "column_values.not_match_like_pattern"
    success_keys = (
        "mostly",
        "like_pattern",
    )

    default_kwarg_values = {
        "like_pattern": None,
        "row_condition": None,
        "condition_parser": None,  # we expect this to be explicitly set whenever a row_condition is passed
        "mostly": 1,
        "result_format": "BASIC",
        "include_config": True,
        "catch_exceptions": True,
    }

    def validate_configuration(self, configuration: Optional[ExpectationConfiguration]):
        super().validate_configuration(configuration)
        try:
            assert "like_pattern" in configuration.kwargs, "Must provide like_pattern"
            assert isinstance(
                configuration.kwargs.get("like_pattern"), (str, dict)
            ), "like_pattern must be a string"
            if isinstance(configuration.kwargs.get("like_pattern"), dict):
                assert "$PARAMETER" in configuration.kwargs.get(
                    "like_pattern"
                ), 'Evaluation Parameter dict for like_pattern kwarg must have "$PARAMETER" key.'
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
            ["column", "mostly", "row_condition", "condition_parser"],
        )
