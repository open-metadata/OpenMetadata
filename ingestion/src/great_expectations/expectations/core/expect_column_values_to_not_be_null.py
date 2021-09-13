from typing import Dict

from great_expectations.core import ExpectationConfiguration
from great_expectations.core.expectation_configuration import parse_result_format
from great_expectations.execution_engine import ExecutionEngine
from great_expectations.expectations.expectation import (
    ColumnMapExpectation,
    _format_map_output,
)
from great_expectations.expectations.util import render_evaluation_parameter_string
from great_expectations.render.renderer.renderer import renderer
from great_expectations.render.types import RenderedStringTemplateContent
from great_expectations.render.util import (
    num_to_str,
    parse_row_condition_string_pandas_engine,
    substitute_none_for_missing,
)


class ExpectColumnValuesToNotBeNull(ColumnMapExpectation):
    """Expect column values to not be null.

    To be counted as an exception, values must be explicitly null or missing, such as a NULL in PostgreSQL or an
    np.NaN in pandas. Empty strings don't count as null unless they have been coerced to a null type.

    expect_column_values_to_not_be_null is a \
    :func:`column_map_expectation <great_expectations.execution_engine.execution_engine.MetaExecutionEngine
    .column_map_expectation>`.

    Args:
        column (str): \
            The column name.

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
        :func:`expect_column_values_to_be_null \
        <great_expectations.execution_engine.execution_engine.ExecutionEngine.expect_column_values_to_be_null>`

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

    map_metric = "column_values.nonnull"

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

        if params["mostly"] is not None:
            params["mostly_pct"] = num_to_str(
                params["mostly"] * 100, precision=15, no_scientific=True
            )
            # params["mostly_pct"] = "{:.14f}".format(params["mostly"]*100).rstrip("0").rstrip(".")
            if include_column_name:
                template_str = "$column values must not be null, at least $mostly_pct % of the time."
            else:
                template_str = (
                    "values must not be null, at least $mostly_pct % of the time."
                )
        else:
            if include_column_name:
                template_str = "$column values must never be null."
            else:
                template_str = "values must never be null."

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

    @classmethod
    @renderer(renderer_type="renderer.diagnostic.observed_value")
    def _diagnostic_observed_value_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        result_dict = result.result

        try:
            null_percent = result_dict["unexpected_percent"]
            return (
                num_to_str(100 - null_percent, precision=5, use_locale=True)
                + "% not null"
            )
        except KeyError:
            return "unknown % not null"
        except TypeError:
            return "NaN% not null"
        return "--"

    @classmethod
    @renderer(
        renderer_type="renderer.descriptive.column_properties_table.missing_count_row"
    )
    def _descriptive_column_properties_table_missing_count_row_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        assert result, "Must pass in result."
        return [
            RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": "Missing (n)",
                        "tooltip": {"content": "expect_column_values_to_not_be_null"},
                    },
                }
            ),
            result.result["unexpected_count"]
            if "unexpected_count" in result.result
            and result.result["unexpected_count"] is not None
            else "--",
        ]

    @classmethod
    @renderer(
        renderer_type="renderer.descriptive.column_properties_table.missing_percent_row"
    )
    def _descriptive_column_properties_table_missing_percent_row_renderer(
        cls,
        configuration=None,
        result=None,
        language=None,
        runtime_configuration=None,
        **kwargs
    ):
        assert result, "Must pass in result."
        return [
            RenderedStringTemplateContent(
                **{
                    "content_block_type": "string_template",
                    "string_template": {
                        "template": "Missing (%)",
                        "tooltip": {"content": "expect_column_values_to_not_be_null"},
                    },
                }
            ),
            "%.1f%%" % result.result["unexpected_percent"]
            if "unexpected_percent" in result.result
            and result.result["unexpected_percent"] is not None
            else "--",
        ]

    def _validate(
        self,
        configuration: ExpectationConfiguration,
        metrics: Dict,
        runtime_configuration: dict = None,
        execution_engine: ExecutionEngine = None,
    ):
        if runtime_configuration:
            result_format = runtime_configuration.get(
                "result_format",
                configuration.kwargs.get(
                    "result_format", self.default_kwarg_values.get("result_format")
                ),
            )
        else:
            result_format = configuration.kwargs.get(
                "result_format", self.default_kwarg_values.get("result_format")
            )
        mostly = self.get_success_kwargs().get(
            "mostly", self.default_kwarg_values.get("mostly")
        )
        total_count = metrics.get("table.row_count")
        unexpected_count = metrics.get(self.map_metric + ".unexpected_count")

        if total_count is None or total_count == 0:
            # Vacuously true
            success = True
        else:
            success_ratio = (total_count - unexpected_count) / total_count
            success = success_ratio >= mostly

        nonnull_count = None

        return _format_map_output(
            result_format=parse_result_format(result_format),
            success=success,
            element_count=metrics.get("table.row_count"),
            nonnull_count=nonnull_count,
            unexpected_count=metrics.get(self.map_metric + ".unexpected_count"),
            unexpected_list=metrics.get(self.map_metric + ".unexpected_values"),
            unexpected_index_list=metrics.get(
                self.map_metric + ".unexpected_index_list"
            ),
        )
